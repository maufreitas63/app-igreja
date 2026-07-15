import {
  ackPttConversationMessages,
  ackPttMessage,
  conversationIdFromPttRow,
  endPttConversation,
  getPttConversation,
  listOpenPttConversations,
  listPendingPttMessages,
  listPttConversationMessages,
  markPttDelivered,
  payloadFromPttRow,
  replyPttConversation,
  type PttMessageRow,
} from '@/lib/pttApi';
import { PTT_OPEN_CONVERSATION_EVENT, type PttOpenConversationDetail } from '@/lib/pttEvents';
import {
  preparePttAudioFromSession,
  startPttRecording,
  type PttRecordingSession,
} from '@/lib/pttRecordSend';
import { subscribePttSocket } from '@/lib/pttSocket';
import { resolveEffectiveProfileId } from '@/lib/sessionProfile';
import { supabase } from '@/lib/supabase';
import { FontAwesome } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';

type DialoguePhase = 'idle' | 'recording' | 'sending' | 'caption';

type PendingCaption = {
  audioUrl: string;
  audioPath: string;
};

/**
 * Mantém o diálogo PTT ativo nas duas pontas até Encerrar conversa.
 */
export function PttInboxListener() {
  const [profileId, setProfileId] = useState<string | null>(null);
  const [profileName, setProfileName] = useState('Voluntário');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [otherName, setOtherName] = useState('Contato');
  const [status, setStatus] = useState<'open' | 'ended' | string>('open');
  const [messages, setMessages] = useState<PttMessageRow[]>([]);
  const [phase, setPhase] = useState<DialoguePhase>('idle');
  const [captionDraft, setCaptionDraft] = useState('');
  const [pendingCaption, setPendingCaption] = useState<PendingCaption | null>(null);
  const [ending, setEnding] = useState(false);

  const sessionRef = useRef<PttRecordingSession | null>(null);
  const getTranscriptRef = useRef<() => string>(() => '');
  const actionLockRef = useRef(false);
  const conversationIdRef = useRef<string | null>(null);
  const seenMessageIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

  const refreshMessages = useCallback(async (id: string) => {
    const rows = await listPttConversationMessages(id);
    setMessages(rows);
    for (const row of rows) {
      if (row.id) seenMessageIdsRef.current.add(row.id);
    }
    await ackPttConversationMessages(id);
  }, []);

  const openConversation = useCallback(
    async (id: string, opts?: { toast?: boolean }) => {
      const trimmed = id.trim();
      if (!trimmed) return;

      const meta = await getPttConversation(trimmed);
      if (!meta) {
        Toast.show({
          type: 'error',
          text1: 'Walkie-Talkie',
          text2: 'Conversa não encontrada. Execute o SQL de diálogos no Supabase.',
          visibilityTime: 6000,
        });
        return;
      }

      setConversationId(meta.id);
      setOtherName(meta.other_name || 'Contato');
      setStatus(meta.status || 'open');
      await refreshMessages(meta.id);

      if (opts?.toast !== false) {
        Toast.show({
          type: 'info',
          text1: 'Diálogo PTT',
          text2: `Conversa com ${meta.other_name || 'contato'}`,
          visibilityTime: 2800,
        });
      }
    },
    [refreshMessages]
  );

  const closePanel = useCallback(() => {
    setConversationId(null);
    setMessages([]);
    setPhase('idle');
    setPendingCaption(null);
    setCaptionDraft('');
    sessionRef.current = null;
    getTranscriptRef.current = () => '';
    actionLockRef.current = false;
  }, []);

  const handleIncomingMessage = useCallback(
    async (row: PttMessageRow) => {
      if (!row?.id || seenMessageIdsRef.current.has(row.id)) {
        return;
      }
      seenMessageIdsRef.current.add(row.id);
      void markPttDelivered(row.id);

      const convId = conversationIdFromPttRow(row);
      if (!convId) {
        // Legado sem conversa: ack simples
        Toast.show({
          type: 'info',
          text1: `PTT · ${row.setor}`,
          text2: `${row.remetente}: ${row.texto_transcrito || 'Áudio recebido'}`,
          visibilityTime: 5000,
        });
        await ackPttMessage(row.id);
        return;
      }

      const payload = payloadFromPttRow(row);
      Toast.show({
        type: 'info',
        text1: `PTT · ${payload.setor}`,
        text2: `${payload.remetente}: ${payload.texto_transcrito || 'Áudio recebido'}`,
        visibilityTime: 4500,
      });

      if (conversationIdRef.current === convId) {
        await refreshMessages(convId);
        return;
      }

      await openConversation(convId, { toast: false });
    },
    [openConversation, refreshMessages]
  );

  const drainPending = useCallback(async () => {
    const opens = await listOpenPttConversations();
    const withUnread = opens.find((c) => Number(c.unread_count) > 0) ?? opens[0];
    if (withUnread && !conversationIdRef.current) {
      await openConversation(withUnread.id, { toast: Number(withUnread.unread_count) > 0 });
      return;
    }

    const rows = await listPendingPttMessages();
    for (const row of rows) {
      await handleIncomingMessage(row);
    }
  }, [handleIncomingMessage, openConversation]);

  useEffect(() => {
    let cancelled = false;
    let msgChannel: ReturnType<typeof supabase.channel> | null = null;
    let convChannel: ReturnType<typeof supabase.channel> | null = null;
    let unsubscribeSocket: (() => void) | null = null;

    const boot = async () => {
      const id = await resolveEffectiveProfileId();
      if (cancelled || !id) return;
      setProfileId(id);

      try {
        const { data } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', id)
          .maybeSingle();
        const name = String(data?.full_name ?? '').trim();
        if (name) setProfileName(name);
      } catch {
        /* ignore */
      }

      await drainPending();

      msgChannel = supabase
        .channel(`ptt-dialogue-msg-${id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'ptt_messages',
            filter: `recipient_profile_id=eq.${id}`,
          },
          (payload) => {
            void handleIncomingMessage(payload.new as PttMessageRow);
          }
        )
        .subscribe();

      convChannel = supabase
        .channel(`ptt-dialogue-conv-${id}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'ptt_conversations',
          },
          (payload) => {
            const row = payload.new as {
              id?: string;
              status?: string;
              initiator_profile_id?: string;
              peer_profile_id?: string;
            };
            if (!row?.id) return;
            if (row.initiator_profile_id !== id && row.peer_profile_id !== id) return;
            if (conversationIdRef.current !== row.id) return;
            setStatus(row.status || 'open');
            if (row.status === 'ended') {
              Toast.show({
                type: 'info',
                text1: 'Conversa encerrada',
                text2: 'O diálogo PTT foi finalizado.',
                visibilityTime: 4000,
              });
              closePanel();
            }
          }
        )
        .subscribe();

      unsubscribeSocket = subscribePttSocket(id, (payload) => {
        const msgId = typeof (payload as { id?: string }).id === 'string' ? payload.id : undefined;
        const convId =
          typeof (payload as { conversation_id?: string }).conversation_id === 'string'
            ? (payload as { conversation_id: string }).conversation_id
            : undefined;
        if (convId) {
          void openConversation(convId);
          return;
        }
        if (msgId) {
          void drainPending();
        }
      });
    };

    void boot();

    const onOpenEvent = (event: Event) => {
      const detail = (event as CustomEvent<PttOpenConversationDetail>).detail;
      if (detail?.conversationId) {
        void openConversation(detail.conversationId);
      }
    };

    const onVisible = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        if (conversationIdRef.current) {
          void refreshMessages(conversationIdRef.current);
        } else {
          void drainPending();
        }
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener(PTT_OPEN_CONVERSATION_EVENT, onOpenEvent as EventListener);
    }
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisible);
    }

    return () => {
      cancelled = true;
      if (msgChannel) void supabase.removeChannel(msgChannel);
      if (convChannel) void supabase.removeChannel(convChannel);
      unsubscribeSocket?.();
      if (typeof window !== 'undefined') {
        window.removeEventListener(PTT_OPEN_CONVERSATION_EVENT, onOpenEvent as EventListener);
      }
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisible);
      }
    };
  }, [closePanel, drainPending, handleIncomingMessage, openConversation, refreshMessages]);

  const resetReplyIdle = useCallback(() => {
    sessionRef.current = null;
    getTranscriptRef.current = () => '';
    actionLockRef.current = false;
    setPendingCaption(null);
    setCaptionDraft('');
    setPhase('idle');
  }, []);

  const startReply = useCallback(async () => {
    if (actionLockRef.current || phase !== 'idle' || status !== 'open' || !profileId) return;
    actionLockRef.current = true;
    try {
      const started = await startPttRecording();
      sessionRef.current = started.session;
      getTranscriptRef.current = started.getTranscript;
      setPhase('recording');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Não foi possível acessar o microfone.';
      Toast.show({ type: 'error', text1: 'Walkie-Talkie', text2: message, visibilityTime: 5000 });
      resetReplyIdle();
    } finally {
      actionLockRef.current = false;
    }
  }, [phase, profileId, resetReplyIdle, status]);

  const cancelReply = useCallback(async () => {
    if (actionLockRef.current || phase !== 'recording') return;
    actionLockRef.current = true;
    try {
      await sessionRef.current?.stop();
    } catch {
      /* ignore */
    }
    resetReplyIdle();
  }, [phase, resetReplyIdle]);

  const sendPreparedReply = useCallback(
    async (audioUrl: string, audioPath: string, texto: string) => {
      const convId = conversationIdRef.current;
      if (!convId) return;
      const result = await replyPttConversation({
        conversationId: convId,
        remetente: profileName,
        audioUrl,
        audioPath,
        textoTranscrito: texto,
      });
      if (!result.ok) {
        Toast.show({
          type: 'error',
          text1: 'Walkie-Talkie',
          text2: result.message,
          visibilityTime: 7000,
        });
        return;
      }
      await refreshMessages(convId);
      Toast.show({
        type: 'success',
        text1: 'Resposta enviada',
        text2: 'Diálogo ativo — aguarde ou encerre quando terminar.',
        visibilityTime: 3000,
      });
    },
    [profileName, refreshMessages]
  );

  const stopAndSendReply = useCallback(async () => {
    if (actionLockRef.current || phase !== 'recording' || !profileId) return;
    const session = sessionRef.current;
    if (!session) {
      resetReplyIdle();
      return;
    }

    actionLockRef.current = true;
    setPhase('sending');
    sessionRef.current = null;

    try {
      const prepared = await preparePttAudioFromSession({
        profileId,
        session,
        getTranscript: getTranscriptRef.current,
      });

      if (!prepared.texto) {
        setPendingCaption({
          audioUrl: prepared.audioUrl,
          audioPath: prepared.audioPath,
        });
        setCaptionDraft('');
        setPhase('caption');
        return;
      }

      await sendPreparedReply(prepared.audioUrl, prepared.audioPath, prepared.texto);
      resetReplyIdle();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao responder.';
      Toast.show({ type: 'error', text1: 'Walkie-Talkie', text2: message, visibilityTime: 6000 });
      resetReplyIdle();
    } finally {
      actionLockRef.current = false;
    }
  }, [phase, profileId, resetReplyIdle, sendPreparedReply]);

  const confirmCaption = useCallback(async () => {
    if (!pendingCaption || actionLockRef.current) return;
    const texto = captionDraft.trim();
    if (!texto) {
      Toast.show({
        type: 'error',
        text1: 'Walkie-Talkie',
        text2: 'Escreva o texto da resposta.',
      });
      return;
    }
    actionLockRef.current = true;
    setPhase('sending');
    try {
      await sendPreparedReply(pendingCaption.audioUrl, pendingCaption.audioPath, texto);
      resetReplyIdle();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao responder.';
      Toast.show({ type: 'error', text1: 'Walkie-Talkie', text2: message, visibilityTime: 6000 });
      setPhase('caption');
    } finally {
      actionLockRef.current = false;
    }
  }, [captionDraft, pendingCaption, resetReplyIdle, sendPreparedReply]);

  const onEndConversation = useCallback(async () => {
    const convId = conversationIdRef.current;
    if (!convId || ending) return;
    setEnding(true);
    try {
      const result = await endPttConversation(convId);
      if (!result.ok) {
        Toast.show({
          type: 'error',
          text1: 'Walkie-Talkie',
          text2: result.message,
          visibilityTime: 6000,
        });
        return;
      }
      Toast.show({
        type: 'success',
        text1: 'Conversa encerrada',
        visibilityTime: 2500,
      });
      closePanel();
    } finally {
      setEnding(false);
    }
  }, [closePanel, ending]);

  const playAudio = (url: string | null | undefined) => {
    const audioUrl = url?.trim();
    if (!audioUrl || Platform.OS !== 'web' || typeof Audio === 'undefined') return;
    try {
      void new Audio(audioUrl).play();
    } catch (error) {
      console.warn('PTT play audio', error);
    }
  };

  if (!conversationId) {
    return null;
  }

  const isRecording = phase === 'recording';
  const isSending = phase === 'sending';
  const isOpen = status === 'open';

  return (
    <>
      <Modal transparent animationType="fade" visible onRequestClose={closePanel}>
        <View style={styles.backdrop}>
          <View style={styles.card}>
            <View style={styles.header}>
              <FontAwesome name="comments" size={18} color="#0F172A" />
              <View style={styles.headerText}>
                <Text style={styles.title}>Diálogo PTT</Text>
                <Text style={styles.meta}>
                  Com {otherName}
                  {isOpen ? ' · ativo' : ' · encerrado'}
                </Text>
              </View>
              <Pressable onPress={closePanel} hitSlop={10} accessibilityLabel="Minimizar diálogo">
                <FontAwesome name="minus" size={16} color="#64748B" />
              </Pressable>
            </View>

            <ScrollView style={styles.thread} contentContainerStyle={styles.threadContent}>
              {messages.length === 0 ? (
                <Text style={styles.empty}>Aguardando mensagens…</Text>
              ) : (
                messages.map((msg) => {
                  const mine = !!profileId && msg.sender_profile_id === profileId;
                  const payload = payloadFromPttRow(msg);
                  return (
                    <View
                      key={msg.id}
                      style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}
                    >
                      <Text style={styles.bubbleMeta}>
                        {payload.remetente}
                        {payload.timestamp ? ` · ${payload.timestamp}` : ''}
                      </Text>
                      <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>
                        {payload.texto_transcrito || 'Áudio sem legenda'}
                      </Text>
                      {payload.audio_url ? (
                        <Pressable
                          style={styles.playBtn}
                          onPress={() => playAudio(payload.audio_url)}
                        >
                          <FontAwesome name="play" size={12} color={mine ? '#E0F2FE' : '#0F172A'} />
                          <Text style={[styles.playText, mine && styles.playTextMine]}>Ouvir</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  );
                })
              )}
            </ScrollView>

            {isOpen ? (
              <View style={styles.composer}>
                <Pressable
                  style={[
                    styles.replyBtn,
                    isRecording && styles.replyBtnRecording,
                    isSending && styles.btnDisabled,
                  ]}
                  disabled={isSending || phase === 'caption'}
                  onPress={() => {
                    if (phase === 'idle') void startReply();
                    else if (phase === 'recording') void stopAndSendReply();
                  }}
                >
                  {isSending ? (
                    <ActivityIndicator color="#020617" />
                  ) : (
                    <>
                      <FontAwesome
                        name={isRecording ? 'send' : 'microphone'}
                        size={16}
                        color={isRecording ? '#FEF2F2' : '#020617'}
                      />
                      <Text style={[styles.replyText, isRecording && styles.replyTextRecording]}>
                        {isRecording ? 'Enviar resposta' : 'Responder'}
                      </Text>
                    </>
                  )}
                </Pressable>
                {isRecording ? (
                  <Pressable style={styles.cancelReply} onPress={() => void cancelReply()}>
                    <Text style={styles.cancelReplyText}>Cancelar</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            <View style={styles.footer}>
              <Pressable style={styles.minimizeBtn} onPress={closePanel}>
                <Text style={styles.minimizeText}>Minimizar</Text>
              </Pressable>
              {isOpen ? (
                <Pressable
                  style={[styles.endBtn, ending && styles.btnDisabled]}
                  disabled={ending}
                  onPress={() => void onEndConversation()}
                >
                  <Text style={styles.endText}>{ending ? 'Encerrando…' : 'Encerrar conversa'}</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={phase === 'caption' && !!pendingCaption}
        transparent
        animationType="fade"
        onRequestClose={resetReplyIdle}
      >
        <View style={styles.captionBackdrop}>
          <View style={styles.captionCard}>
            <Text style={styles.captionTitle}>Texto da resposta</Text>
            <TextInput
              style={styles.captionInput}
              value={captionDraft}
              onChangeText={setCaptionDraft}
              placeholder="O que você falou?"
              placeholderTextColor="#94A3B8"
              multiline
              autoFocus
            />
            <View style={styles.captionActions}>
              <Pressable onPress={resetReplyIdle}>
                <Text style={styles.minimizeText}>Cancelar</Text>
              </Pressable>
              <Pressable style={styles.endBtn} onPress={() => void confirmCaption()}>
                <Text style={styles.endText}>Enviar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
    padding: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    maxHeight: '88%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  meta: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '600',
  },
  thread: {
    maxHeight: 360,
    minHeight: 160,
  },
  threadContent: {
    gap: 8,
    paddingVertical: 4,
  },
  empty: {
    color: '#64748B',
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 24,
  },
  bubble: {
    borderRadius: 12,
    padding: 10,
    gap: 4,
    maxWidth: '92%',
  },
  bubbleMine: {
    alignSelf: 'flex-end',
    backgroundColor: '#0369A1',
  },
  bubbleTheirs: {
    alignSelf: 'flex-start',
    backgroundColor: '#E2E8F0',
  },
  bubbleMeta: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
  },
  bubbleText: {
    fontSize: 15,
    color: '#0F172A',
    lineHeight: 20,
  },
  bubbleTextMine: {
    color: '#F8FAFC',
  },
  playBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  playText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  playTextMine: {
    color: '#E0F2FE',
  },
  composer: {
    gap: 6,
  },
  replyBtn: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: '#E2E8F0',
    borderWidth: 1,
    borderColor: '#3A96DD',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  replyBtnRecording: {
    backgroundColor: '#DC2626',
    borderColor: '#991B1B',
  },
  replyText: {
    fontWeight: '800',
    color: '#020617',
    fontSize: 14,
  },
  replyTextRecording: {
    color: '#FEF2F2',
  },
  cancelReply: {
    alignSelf: 'center',
    padding: 4,
  },
  cancelReplyText: {
    color: '#64748B',
    fontWeight: '700',
    fontSize: 12,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    marginTop: 2,
  },
  minimizeBtn: {
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  minimizeText: {
    color: '#64748B',
    fontWeight: '700',
    fontSize: 14,
  },
  endBtn: {
    backgroundColor: '#0F172A',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  endText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  btnDisabled: {
    opacity: 0.7,
  },
  captionBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.55)',
    justifyContent: 'center',
    padding: 20,
  },
  captionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    gap: 12,
  },
  captionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  captionInput: {
    minHeight: 80,
    borderWidth: 1,
    borderColor: '#94A3B8',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#0F172A',
    textAlignVertical: 'top',
  },
  captionActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 14,
  },
});

import {
  listOpenPttConversations,
  listPttDirectoryPeers,
  sendPttDirectoryMessage,
  type PttDirectoryPeer,
} from '@/lib/pttApi';
import { requestOpenPttConversation } from '@/lib/pttEvents';
import {
  preparePttAudioFromSession,
  startPttRecording,
  type PttRecordingSession,
} from '@/lib/pttRecordSend';
import { FontAwesome } from '@expo/vector-icons';
import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Toast from 'react-native-toast-message';

type Props = {
  senderProfileId: string | null | undefined;
  senderName: string | null | undefined;
  setor?: string;
  style?: StyleProp<ViewStyle>;
  /** Exibe o botão em largura total (menu Configurações). */
  fullWidth?: boolean;
};

type Phase = 'idle' | 'picking' | 'recording' | 'sending';

/**
 * Walkie: Gravar → escolher destinatário do diretório → gravar áudio → enviar.
 */
export function PttWalkieTalkieButton({
  senderProfileId,
  senderName,
  setor = 'Walkie-Talkie',
  style,
  fullWidth = false,
}: Props) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [peers, setPeers] = useState<PttDirectoryPeer[]>([]);
  const [selectedPeer, setSelectedPeer] = useState<PttDirectoryPeer | null>(null);
  const [loadingPeers, setLoadingPeers] = useState(false);
  const sessionRef = useRef<PttRecordingSession | null>(null);
  const getTranscriptRef = useRef<() => string>(() => '');
  const selectedPeerRef = useRef<PttDirectoryPeer | null>(null);
  const actionLockRef = useRef(false);

  const resetIdle = useCallback(() => {
    sessionRef.current = null;
    getTranscriptRef.current = () => '';
    actionLockRef.current = false;
    selectedPeerRef.current = null;
    setSelectedPeer(null);
    setPeers([]);
    setPhase('idle');
  }, []);

  const beginRecordingWithPeer = useCallback(
    async (peer: PttDirectoryPeer) => {
      if (!senderProfileId?.trim()) {
        Toast.show({
          type: 'error',
          text1: 'Walkie-Talkie',
          text2: 'Perfil não identificado. Faça login novamente.',
        });
        return;
      }

      actionLockRef.current = true;
      selectedPeerRef.current = peer;
      setSelectedPeer(peer);
      try {
        const started = await startPttRecording();
        sessionRef.current = started.session;
        getTranscriptRef.current = started.getTranscript;
        setPhase('recording');
        Toast.show({
          type: 'info',
          text1: `Gravando para ${peer.full_name}`,
          text2: 'Toque em Enviar para concluir.',
          visibilityTime: 2500,
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Não foi possível acessar o microfone.';
        Toast.show({ type: 'error', text1: 'Walkie-Talkie', text2: message, visibilityTime: 5000 });
        resetIdle();
      } finally {
        actionLockRef.current = false;
      }
    },
    [resetIdle, senderProfileId]
  );

  const openPeerPicker = useCallback(async () => {
    if (actionLockRef.current || phase !== 'idle') {
      return;
    }
    if (!senderProfileId?.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Walkie-Talkie',
        text2: 'Perfil não identificado. Faça login novamente.',
      });
      return;
    }

    actionLockRef.current = true;
    setLoadingPeers(true);
    setPhase('picking');
    try {
      const open = await listOpenPttConversations();
      if (open[0]?.id) {
        // Continua a conversa aberta sem novo picker
        const peer: PttDirectoryPeer = {
          profile_id: open[0].other_profile_id,
          full_name: open[0].other_name || 'Contato',
        };
        await beginRecordingWithPeer(peer);
        return;
      }

      const list = await listPttDirectoryPeers();
      setPeers(list.filter((p) => p.profile_id && p.profile_id !== senderProfileId.trim()));
      if (list.length === 0) {
        Toast.show({
          type: 'error',
          text1: 'Walkie-Talkie',
          text2:
            'Nenhum contato na lista. Peça ao super admin para cadastrar usuários em Configurações.',
          visibilityTime: 7000,
        });
        resetIdle();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao carregar contatos.';
      Toast.show({ type: 'error', text1: 'Walkie-Talkie', text2: message, visibilityTime: 6000 });
      resetIdle();
    } finally {
      setLoadingPeers(false);
      actionLockRef.current = false;
    }
  }, [beginRecordingWithPeer, phase, resetIdle, senderProfileId]);

  const deliverMessage = useCallback(
    async (audioUrl: string, audioPath: string, textoTranscrito: string) => {
      const peer = selectedPeerRef.current;
      const open = await listOpenPttConversations();
      const activeWithPeer =
        peer
          ? open.find(
              (c) =>
                c.other_profile_id === peer.profile_id
                || c.peer_profile_id === peer.profile_id
                || c.initiator_profile_id === peer.profile_id
            )
          : open[0];

      const result = await sendPttDirectoryMessage({
        remetente: senderName?.trim() || 'Voluntário',
        setor,
        audioUrl,
        audioPath,
        textoTranscrito,
        conversationId: activeWithPeer?.id ?? null,
        peerProfileId: peer?.profile_id ?? null,
      });

      if (!result.ok) {
        Toast.show({
          type: 'error',
          text1: 'Walkie-Talkie',
          text2: result.message,
          visibilityTime: 7000,
        });
        return false;
      }

      const conversationId = result.conversationId ?? result.conversationIds[0] ?? null;
      if (conversationId) {
        requestOpenPttConversation(conversationId);
      }

      Toast.show({
        type: 'success',
        text1: 'Mensagem enviada',
        text2: peer ? `Diálogo com ${peer.full_name}` : 'Diálogo ativo',
        visibilityTime: 4000,
      });
      return true;
    },
    [senderName, setor]
  );

  const stopAndSend = useCallback(async () => {
    if (actionLockRef.current || phase !== 'recording') {
      return;
    }

    const session = sessionRef.current;
    const profileId = senderProfileId?.trim();
    if (!session || !profileId) {
      resetIdle();
      return;
    }

    actionLockRef.current = true;
    setPhase('sending');
    sessionRef.current = null;

    Toast.show({
      type: 'info',
      text1: 'Transcrevendo…',
      text2: 'Gerando o texto automático do áudio.',
      visibilityTime: 4000,
    });

    try {
      const prepared = await preparePttAudioFromSession({
        profileId,
        session,
        getTranscript: getTranscriptRef.current,
      });

      await deliverMessage(prepared.audioUrl, prepared.audioPath, prepared.texto);
      resetIdle();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao enviar o Walkie-Talkie.';
      Toast.show({ type: 'error', text1: 'Walkie-Talkie', text2: message, visibilityTime: 7000 });
      resetIdle();
    } finally {
      actionLockRef.current = false;
      sessionRef.current = null;
      getTranscriptRef.current = () => '';
    }
  }, [deliverMessage, phase, resetIdle, senderProfileId]);

  const cancelRecording = useCallback(async () => {
    if (actionLockRef.current || phase !== 'recording') {
      return;
    }
    actionLockRef.current = true;
    const session = sessionRef.current;
    sessionRef.current = null;
    try {
      await session?.stop();
    } catch {
      /* ignore */
    }
    Toast.show({
      type: 'info',
      text1: 'Gravação cancelada',
      visibilityTime: 2000,
    });
    resetIdle();
  }, [phase, resetIdle]);

  const onPrimaryPress = () => {
    if (phase === 'idle') {
      void openPeerPicker();
      return;
    }
    if (phase === 'recording') {
      void stopAndSend();
    }
  };

  const isRecording = phase === 'recording';
  const isSending = phase === 'sending';
  const isPicking = phase === 'picking';

  return (
    <View style={[styles.wrap, fullWidth && styles.wrapFull, style]}>
      <Pressable
        style={[
          styles.button,
          fullWidth && styles.buttonFull,
          isRecording && styles.buttonRecording,
          (isSending || isPicking) && styles.buttonDisabled,
        ]}
        onPress={onPrimaryPress}
        disabled={isSending || isPicking}
        accessibilityRole="button"
        accessibilityLabel={
          isRecording
            ? 'Enviar mensagem do Walkie-Talkie'
            : 'Gravar mensagem do Walkie-Talkie'
        }
        accessibilityHint="Toque para escolher o contato e gravar."
      >
        <View style={styles.inner} pointerEvents="none">
          {isSending || isPicking ? (
            <ActivityIndicator color="#020617" />
          ) : (
            <FontAwesome
              name={isRecording ? 'send' : 'microphone'}
              size={18}
              color={isRecording ? '#FEF2F2' : '#020617'}
            />
          )}
          <Text style={[styles.text, isRecording && styles.textRecording]}>
            {isSending
              ? 'Transcrevendo…'
              : isPicking
                ? 'Escolhendo…'
                : isRecording
                  ? 'Enviar'
                  : 'Gravar'}
          </Text>
        </View>
      </Pressable>

      {isRecording ? (
        <Text style={styles.peerHint} numberOfLines={1}>
          Para: {selectedPeer?.full_name || 'contato'}
        </Text>
      ) : null}

      {isRecording ? (
        <Pressable
          style={styles.cancelButton}
          onPress={() => void cancelRecording()}
          accessibilityRole="button"
          accessibilityLabel="Cancelar gravação"
        >
          <Text style={styles.cancelText}>Cancelar</Text>
        </Pressable>
      ) : null}

      <Modal
        visible={isPicking && !loadingPeers && peers.length > 0}
        transparent
        animationType="fade"
        onRequestClose={resetIdle}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Com quem falar?</Text>
            <Text style={styles.modalHint}>
              Escolha um usuário da lista do Walkie-Talkie para iniciar o diálogo.
            </Text>
            <ScrollView style={styles.peerList} keyboardShouldPersistTaps="handled">
              {peers.map((peer) => (
                <Pressable
                  key={peer.profile_id}
                  style={styles.peerRow}
                  onPress={() => void beginRecordingWithPeer(peer)}
                >
                  <FontAwesome name="user" size={16} color="#0F172A" />
                  <Text style={styles.peerName}>{peer.full_name}</Text>
                  <FontAwesome name="chevron-right" size={12} color="#94A3B8" />
                </Pressable>
              ))}
            </ScrollView>
            <Pressable style={styles.modalCancel} onPress={resetIdle}>
              <Text style={styles.cancelText}>Cancelar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  wrapFull: {
    flex: 0,
    width: '100%',
  },
  button: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: '#E2E8F0',
    borderWidth: 1,
    borderColor: '#3A96DD',
  },
  buttonFull: {
    width: '100%',
  },
  buttonRecording: {
    backgroundColor: '#DC2626',
    borderColor: '#991B1B',
  },
  buttonDisabled: {
    opacity: 0.75,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  text: {
    color: '#020617',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
    flexShrink: 1,
    textAlign: 'center',
  },
  textRecording: {
    color: '#FEF2F2',
  },
  peerHint: {
    textAlign: 'center',
    color: '#475569',
    fontSize: 12,
    fontWeight: '700',
  },
  cancelButton: {
    alignSelf: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  cancelText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.55)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    gap: 10,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  modalTitle: {
    color: '#0F172A',
    fontSize: 17,
    fontWeight: '800',
  },
  modalHint: {
    color: '#475569',
    fontSize: 13,
    lineHeight: 18,
  },
  peerList: {
    maxHeight: 320,
  },
  peerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  peerName: {
    flex: 1,
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '700',
  },
  modalCancel: {
    alignSelf: 'center',
    paddingVertical: 8,
  },
});

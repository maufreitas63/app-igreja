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
import { MINIMAL_ICON, MINIMAL_TYPO, MINIMAL_UI } from '@/lib/minimalUiTheme';
import { FontAwesome } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
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
  fullWidth?: boolean;
  /** Destinatário já escolhido (fluxo Configurações). */
  lockedPeer?: PttDirectoryPeer | null;
};

type Phase = 'idle' | 'recording' | 'sending';

/**
 * Gravar → Enviar (transcrição automática).
 * Com `lockedPeer`, não abre picker.
 */
export function PttWalkieTalkieButton({
  senderProfileId,
  senderName,
  setor = 'Walkie-Talkie',
  style,
  fullWidth = false,
  lockedPeer = null,
}: Props) {
  const [phase, setPhase] = useState<Phase>('idle');
  const sessionRef = useRef<PttRecordingSession | null>(null);
  const getTranscriptRef = useRef<() => string>(() => '');
  const selectedPeerRef = useRef<PttDirectoryPeer | null>(lockedPeer);
  const actionLockRef = useRef(false);

  useEffect(() => {
    selectedPeerRef.current = lockedPeer;
  }, [lockedPeer]);

  const resetIdle = useCallback(() => {
    sessionRef.current = null;
    getTranscriptRef.current = () => '';
    actionLockRef.current = false;
    selectedPeerRef.current = lockedPeer;
    setPhase('idle');
  }, [lockedPeer]);

  const startRecording = useCallback(async () => {
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

    let peer = lockedPeer ?? selectedPeerRef.current;
    if (!peer) {
      const open = await listOpenPttConversations();
      if (open[0]) {
        peer = {
          profile_id: open[0].other_profile_id,
          full_name: open[0].other_name || 'Contato',
        };
      } else {
        const peers = await listPttDirectoryPeers();
        const first = peers.find((p) => p.profile_id !== senderProfileId.trim());
        if (!first) {
          Toast.show({
            type: 'error',
            text1: 'Walkie-Talkie',
            text2: 'Escolha um contato antes de gravar.',
          });
          return;
        }
        peer = first;
      }
    }

    actionLockRef.current = true;
    selectedPeerRef.current = peer;
    try {
      const started = await startPttRecording();
      sessionRef.current = started.session;
      getTranscriptRef.current = started.getTranscript;
      setPhase('recording');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Não foi possível acessar o microfone.';
      Toast.show({ type: 'error', text1: 'Walkie-Talkie', text2: message, visibilityTime: 5000 });
      resetIdle();
    } finally {
      actionLockRef.current = false;
    }
  }, [lockedPeer, phase, resetIdle, senderProfileId]);

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
        text1: 'Enviado',
        text2: peer ? peer.full_name : undefined,
        visibilityTime: 3000,
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

    try {
      const prepared = await preparePttAudioFromSession({
        profileId,
        session,
        getTranscript: getTranscriptRef.current,
      });

      await deliverMessage(prepared.audioUrl, prepared.audioPath, prepared.texto);
      resetIdle();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao enviar.';
      Toast.show({ type: 'error', text1: 'Walkie-Talkie', text2: message, visibilityTime: 7000 });
      resetIdle();
    } finally {
      actionLockRef.current = false;
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
    resetIdle();
  }, [phase, resetIdle]);

  const onPrimaryPress = () => {
    if (phase === 'idle') {
      void startRecording();
      return;
    }
    if (phase === 'recording') {
      void stopAndSend();
    }
  };

  const isRecording = phase === 'recording';
  const isSending = phase === 'sending';

  return (
    <View style={[styles.wrap, fullWidth && styles.wrapFull, style]}>
      <Pressable
        style={[
          styles.button,
          isRecording && styles.buttonRecording,
          isSending && styles.buttonDisabled,
        ]}
        onPress={onPrimaryPress}
        disabled={isSending}
        accessibilityRole="button"
        accessibilityLabel={isRecording ? 'Enviar' : 'Gravar'}
      >
        <View style={styles.inner} pointerEvents="none">
          {isSending ? (
            <ActivityIndicator color={MINIMAL_UI.icon} />
          ) : (
            <FontAwesome
              name={isRecording ? 'send' : 'microphone'}
              size={MINIMAL_ICON.action}
              color={isRecording ? MINIMAL_UI.onDark : MINIMAL_UI.icon}
            />
          )}
          <Text style={[styles.text, isRecording && styles.textRecording]}>
            {isSending ? 'Enviando…' : isRecording ? 'Enviar' : 'Gravar'}
          </Text>
        </View>
      </Pressable>

      {isRecording ? (
        <Pressable style={styles.cancelButton} onPress={() => void cancelRecording()}>
          <Text style={styles.cancelText}>Cancelar</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    minWidth: 0,
    gap: 8,
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
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: MINIMAL_UI.divider,
    backgroundColor: MINIMAL_UI.background,
  },
  buttonRecording: {
    backgroundColor: MINIMAL_UI.blueDark,
    borderBottomColor: MINIMAL_UI.blueDark,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  text: {
    ...MINIMAL_TYPO.menuItem,
    fontWeight: '700',
  },
  textRecording: {
    color: MINIMAL_UI.onDark,
  },
  cancelButton: {
    alignSelf: 'center',
    paddingVertical: 6,
  },
  cancelText: {
    ...MINIMAL_TYPO.inboxPreview,
    fontWeight: '600',
  },
});

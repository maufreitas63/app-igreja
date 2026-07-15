import { listOpenPttConversations, sendPttEstacionamentoMessage } from '@/lib/pttApi';
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
};

type Phase = 'idle' | 'recording' | 'sending';

/**
 * Walkie em 2 etapas com transcrição automática (sem digitação).
 */
export function PttWalkieTalkieButton({
  senderProfileId,
  senderName,
  setor = 'Estacionamento',
  style,
}: Props) {
  const [phase, setPhase] = useState<Phase>('idle');
  const sessionRef = useRef<PttRecordingSession | null>(null);
  const getTranscriptRef = useRef<() => string>(() => '');
  const actionLockRef = useRef(false);

  const resetIdle = useCallback(() => {
    sessionRef.current = null;
    getTranscriptRef.current = () => '';
    actionLockRef.current = false;
    setPhase('idle');
  }, []);

  const deliverMessage = useCallback(
    async (audioUrl: string, audioPath: string, textoTranscrito: string) => {
      const open = await listOpenPttConversations();
      const activeId = open[0]?.id ?? null;

      const result = await sendPttEstacionamentoMessage({
        remetente: senderName?.trim() || 'Voluntário',
        setor,
        audioUrl,
        audioPath,
        textoTranscrito,
        conversationId: activeId,
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

      const conversationId = result.conversationId ?? result.conversationIds[0] ?? activeId;
      if (conversationId) {
        requestOpenPttConversation(conversationId);
      }

      Toast.show({
        type: 'success',
        text1: activeId ? 'Mensagem no diálogo' : 'Diálogo iniciado',
        text2: activeId
          ? 'Áudio + texto enviados.'
          : `Chamada ao Ministério De Acolhimento (${result.recipientCount}).`,
        visibilityTime: 4000,
      });
      return true;
    },
    [senderName, setor]
  );

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

    actionLockRef.current = true;
    try {
      const started = await startPttRecording();
      sessionRef.current = started.session;
      getTranscriptRef.current = started.getTranscript;
      setPhase('recording');
      Toast.show({
        type: 'info',
        text1: 'Gravando',
        text2: 'Fale com clareza. Toque em Enviar para concluir.',
        visibilityTime: 2500,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Não foi possível acessar o microfone.';
      Toast.show({ type: 'error', text1: 'Walkie-Talkie', text2: message, visibilityTime: 5000 });
      resetIdle();
      return;
    } finally {
      actionLockRef.current = false;
    }
  }, [phase, resetIdle, senderProfileId]);

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
    <View style={[styles.wrap, style]}>
      <Pressable
        style={[
          styles.button,
          isRecording && styles.buttonRecording,
          isSending && styles.buttonDisabled,
        ]}
        onPress={onPrimaryPress}
        disabled={isSending}
        accessibilityRole="button"
        accessibilityLabel={
          isRecording
            ? 'Enviar mensagem do Walkie-Talkie'
            : 'Gravar mensagem do Walkie-Talkie'
        }
        accessibilityHint="Toque para gravar. Toque de novo para enviar."
      >
        <View style={styles.inner} pointerEvents="none">
          {isSending ? (
            <ActivityIndicator color="#020617" />
          ) : (
            <FontAwesome
              name={isRecording ? 'send' : 'microphone'}
              size={18}
              color={isRecording ? '#FEF2F2' : '#020617'}
            />
          )}
          <Text style={[styles.text, isRecording && styles.textRecording]}>
            {isSending ? 'Transcrevendo…' : isRecording ? 'Enviar' : 'Gravar'}
          </Text>
        </View>
      </Pressable>

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
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    minWidth: 0,
    gap: 6,
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
});

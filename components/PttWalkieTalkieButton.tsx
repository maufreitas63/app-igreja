import {
  sendPttEstacionamentoMessage,
  transcribePttAudioViaEdge,
  uploadPttAudioBlob,
} from '@/lib/pttApi';
import { blobToBase64, startPttRecording, type PttRecordingSession } from '@/lib/pttRecording';
import { FontAwesome } from '@expo/vector-icons';
import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
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

type HoldPhase = 'idle' | 'starting' | 'holding' | 'sending';

/**
 * Push-to-talk: segurar grava; soltar envia uma única vez.
 * Protege contra pressIn/pressOut duplicados no web e release durante o start async.
 */
export function PttWalkieTalkieButton({
  senderProfileId,
  senderName,
  setor = 'Estacionamento',
  style,
}: Props) {
  const [isHolding, setIsHolding] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const phaseRef = useRef<HoldPhase>('idle');
  const sessionRef = useRef<PttRecordingSession | null>(null);
  const getTranscriptRef = useRef<() => string>(() => '');
  const generationRef = useRef(0);
  const releaseRequestedRef = useRef(false);

  const resetIdle = useCallback(() => {
    phaseRef.current = 'idle';
    sessionRef.current = null;
    getTranscriptRef.current = () => '';
    releaseRequestedRef.current = false;
    setIsHolding(false);
    setIsSending(false);
  }, []);

  const sendRecording = useCallback(
    async (session: PttRecordingSession, profileId: string) => {
      if (phaseRef.current === 'sending') {
        return;
      }
      phaseRef.current = 'sending';
      setIsHolding(false);
      setIsSending(true);
      sessionRef.current = null;

      try {
        const recorded = await session.stop();
        const speechText = getTranscriptRef.current()?.trim() ?? '';
        const uploaded = await uploadPttAudioBlob(
          profileId,
          recorded.blob,
          recorded.extension,
          recorded.mimeType
        );

        let texto = speechText;
        if (!texto) {
          const base64 = await blobToBase64(recorded.blob);
          texto =
            (await transcribePttAudioViaEdge(uploaded.publicUrl, base64, recorded.mimeType))
            ?? '';
        }
        if (!texto) {
          texto = '(áudio sem transcrição automática)';
        }

        const result = await sendPttEstacionamentoMessage({
          remetente: senderName?.trim() || 'Voluntário',
          setor,
          audioUrl: uploaded.publicUrl,
          audioPath: uploaded.path,
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

        Toast.show({
          type: 'success',
          text1: 'Mensagem enviada',
          text2: `Roteada ao Ministério De Acolhimento (${result.recipientCount}).`,
          visibilityTime: 4000,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Falha ao enviar o Walkie-Talkie.';
        Toast.show({ type: 'error', text1: 'Walkie-Talkie', text2: message, visibilityTime: 6000 });
      } finally {
        resetIdle();
      }
    },
    [resetIdle, senderName, setor]
  );

  const beginHold = useCallback(async () => {
    if (phaseRef.current !== 'idle') {
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

    const generation = generationRef.current + 1;
    generationRef.current = generation;
    phaseRef.current = 'starting';
    releaseRequestedRef.current = false;

    try {
      const started = await startPttRecording();

      // Soltou durante a permissão/start → envia o trecho gravado (ou aborta se vazio).
      if (generation !== generationRef.current) {
        try {
          await started.session.stop();
        } catch {
          /* ignore */
        }
        resetIdle();
        return;
      }

      sessionRef.current = started.session;
      getTranscriptRef.current = started.getTranscript;

      if (releaseRequestedRef.current) {
        await sendRecording(started.session, senderProfileId.trim());
        return;
      }

      phaseRef.current = 'holding';
      setIsHolding(true);
    } catch (error) {
      if (generation === generationRef.current) {
        const message =
          error instanceof Error ? error.message : 'Não foi possível acessar o microfone.';
        Toast.show({ type: 'error', text1: 'Walkie-Talkie', text2: message, visibilityTime: 5000 });
        resetIdle();
      }
    }
  }, [resetIdle, sendRecording, senderProfileId]);

  const endHold = useCallback(() => {
    if (phaseRef.current === 'idle' || phaseRef.current === 'sending') {
      return;
    }

    if (phaseRef.current === 'starting') {
      // Ainda pedindo mic / abrindo recorder — marca release e envia ao concluir o start.
      releaseRequestedRef.current = true;
      return;
    }

    if (phaseRef.current !== 'holding') {
      return;
    }

    const session = sessionRef.current;
    const profileId = senderProfileId?.trim();
    if (!session || !profileId) {
      resetIdle();
      return;
    }

    void sendRecording(session, profileId);
  }, [resetIdle, sendRecording, senderProfileId]);

  const onPressIn = useCallback(
    (_event?: GestureResponderEvent) => {
      void beginHold();
    },
    [beginHold]
  );

  const onPressOut = useCallback(
    (_event?: GestureResponderEvent) => {
      endHold();
    },
    [endHold]
  );

  return (
    <Pressable
      style={[
        styles.button,
        webHoldStyles,
        isHolding && styles.buttonHolding,
        isSending && styles.buttonDisabled,
        style,
      ]}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={isSending}
      accessibilityRole="button"
      accessibilityLabel="Walkie-Talkie: segure para falar"
      accessibilityHint="Pressione e segure para gravar. Solte para enviar automaticamente."
    >
      <View style={styles.inner} pointerEvents="none">
        {isSending ? (
          <ActivityIndicator color="#020617" />
        ) : (
          <FontAwesome name="microphone" size={18} color={isHolding ? '#FEF2F2' : '#020617'} />
        )}
        <Text style={[styles.text, isHolding && styles.textHolding]}>
          {isSending ? 'Enviando…' : isHolding ? 'Solte para enviar' : 'Segure para falar'}
        </Text>
      </View>
    </Pressable>
  );
}

const webHoldStyles =
  Platform.OS === 'web'
    ? ({
        userSelect: 'none',
        WebkitUserSelect: 'none',
        touchAction: 'none',
      } as ViewStyle)
    : null;

const styles = StyleSheet.create({
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
  buttonHolding: {
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
  textHolding: {
    color: '#FEF2F2',
  },
});

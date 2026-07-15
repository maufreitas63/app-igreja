import {
  sendPttEstacionamentoMessage,
  transcribePttAudioViaEdge,
  uploadPttAudioBlob,
} from '@/lib/pttApi';
import { blobToBase64, startPttRecording, type PttRecordingSession } from '@/lib/pttRecording';
import { emitPttViaSocket } from '@/lib/pttSocket';
import { FontAwesome } from '@expo/vector-icons';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
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

export function PttWalkieTalkieButton({
  senderProfileId,
  senderName,
  setor = 'Estacionamento',
  style,
}: Props) {
  const [isHolding, setIsHolding] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const sessionRef = useRef<PttRecordingSession | null>(null);
  const getTranscriptRef = useRef<() => string>(() => '');
  const busyRef = useRef(false);

  const beginHold = async () => {
    if (busyRef.current || isSending) {
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

    busyRef.current = true;
    try {
      const started = await startPttRecording();
      sessionRef.current = started.session;
      getTranscriptRef.current = started.getTranscript;
      setIsHolding(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível acessar o microfone.';
      Toast.show({ type: 'error', text1: 'Walkie-Talkie', text2: message, visibilityTime: 5000 });
    } finally {
      busyRef.current = false;
    }
  };

  const endHold = async () => {
    const session = sessionRef.current;
    sessionRef.current = null;
    setIsHolding(false);

    if (!session || !senderProfileId?.trim()) {
      return;
    }

    setIsSending(true);
    try {
      const recorded = await session.stop();
      const speechText = getTranscriptRef.current()?.trim() ?? '';
      const uploaded = await uploadPttAudioBlob(
        senderProfileId,
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

      void emitPttViaSocket(senderProfileId, {
        ...result.payload,
      });

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
      setIsSending(false);
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.button,
        isHolding && styles.buttonHolding,
        isSending && styles.buttonDisabled,
        style,
      ]}
      onPressIn={() => {
        void beginHold();
      }}
      onPressOut={() => {
        void endHold();
      }}
      disabled={isSending}
      activeOpacity={0.9}
      accessibilityRole="button"
      accessibilityLabel="Walkie-Talkie: segure para falar"
      accessibilityHint="Pressione e segure para gravar. Solte para enviar à recepção."
    >
      <View style={styles.inner}>
        {isSending ? (
          <ActivityIndicator color="#020617" />
        ) : (
          <FontAwesome name="microphone" size={18} color={isHolding ? '#FEF2F2' : '#020617'} />
        )}
        <Text style={[styles.text, isHolding && styles.textHolding]}>
          {isSending ? 'Enviando…' : isHolding ? 'Solte para enviar' : 'Walkie-Talkie'}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

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

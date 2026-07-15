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
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
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

type Phase = 'idle' | 'recording' | 'sending' | 'caption';

type PendingSend = {
  audioUrl: string;
  audioPath: string;
  draftText: string;
};

/**
 * Walkie em 2 etapas (melhor em touch/PWA):
 * 1) toque → inicia gravação
 * 2) toque → para e envia
 * Se a STT falhar, pede a legenda manualmente.
 */
export function PttWalkieTalkieButton({
  senderProfileId,
  senderName,
  setor = 'Estacionamento',
  style,
}: Props) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [captionDraft, setCaptionDraft] = useState('');
  const [pendingSend, setPendingSend] = useState<PendingSend | null>(null);
  const sessionRef = useRef<PttRecordingSession | null>(null);
  const getTranscriptRef = useRef<() => string>(() => '');
  const actionLockRef = useRef(false);

  const resetIdle = useCallback(() => {
    sessionRef.current = null;
    getTranscriptRef.current = () => '';
    actionLockRef.current = false;
    setPendingSend(null);
    setCaptionDraft('');
    setPhase('idle');
  }, []);

  const deliverMessage = useCallback(
    async (audioUrl: string, audioPath: string, textoTranscrito: string) => {
      const result = await sendPttEstacionamentoMessage({
        remetente: senderName?.trim() || 'Voluntário',
        setor,
        audioUrl,
        audioPath,
        textoTranscrito,
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

      Toast.show({
        type: 'success',
        text1: 'Mensagem enviada',
        text2: `Roteada ao Ministério De Acolhimento (${result.recipientCount}).`,
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

    let openedCaption = false;
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
      let sttError: string | undefined;
      if (!texto) {
        const base64 = await blobToBase64(recorded.blob);
        const whisper = await transcribePttAudioViaEdge(
          uploaded.publicUrl,
          base64,
          recorded.mimeType
        );
        texto = whisper.text?.trim() ?? '';
        sttError = whisper.error;
      }

      if (!texto) {
        openedCaption = true;
        setPendingSend({
          audioUrl: uploaded.publicUrl,
          audioPath: uploaded.path,
          draftText: '',
        });
        setCaptionDraft('');
        setPhase('caption');
        Toast.show({
          type: 'info',
          text1: 'Digite a legenda',
          text2: sttError?.includes('OPENAI_API_KEY')
            ? 'Transcrição automática indisponível. Escreva o que falou.'
            : 'Não deu para transcrever sozinho. Confirme o texto da mensagem.',
          visibilityTime: 4500,
        });
        return;
      }

      await deliverMessage(uploaded.publicUrl, uploaded.path, texto);
      resetIdle();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao enviar o Walkie-Talkie.';
      Toast.show({ type: 'error', text1: 'Walkie-Talkie', text2: message, visibilityTime: 6000 });
      resetIdle();
    } finally {
      actionLockRef.current = false;
      if (!openedCaption) {
        sessionRef.current = null;
        getTranscriptRef.current = () => '';
      }
    }
  }, [deliverMessage, phase, resetIdle, senderProfileId]);

  const confirmCaption = useCallback(async () => {
    if (actionLockRef.current || !pendingSend) {
      return;
    }
    const texto = captionDraft.trim();
    if (!texto) {
      Toast.show({
        type: 'error',
        text1: 'Walkie-Talkie',
        text2: 'Escreva o texto da mensagem ou cancele.',
      });
      return;
    }

    actionLockRef.current = true;
    setPhase('sending');
    try {
      await deliverMessage(pendingSend.audioUrl, pendingSend.audioPath, texto);
      resetIdle();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao enviar o Walkie-Talkie.';
      Toast.show({ type: 'error', text1: 'Walkie-Talkie', text2: message, visibilityTime: 6000 });
      setPhase('caption');
    } finally {
      actionLockRef.current = false;
    }
  }, [captionDraft, deliverMessage, pendingSend, resetIdle]);

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
  const showCaption = phase === 'caption' && !!pendingSend;

  return (
    <View style={[styles.wrap, style]}>
      <Pressable
        style={[
          styles.button,
          isRecording && styles.buttonRecording,
          isSending && styles.buttonDisabled,
        ]}
        onPress={onPrimaryPress}
        disabled={isSending || showCaption}
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
            {isSending ? 'Enviando…' : isRecording ? 'Enviar' : 'Gravar'}
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

      <Modal visible={showCaption} transparent animationType="fade" onRequestClose={resetIdle}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Texto da mensagem</Text>
            <Text style={styles.modalHint}>
              O áudio já está pronto. Escreva o que falou para o Acolhimento ler na tela.
            </Text>
            <TextInput
              style={styles.modalInput}
              value={captionDraft}
              onChangeText={setCaptionDraft}
              placeholder="Ex.: Visita para o veículo ABC1D23"
              placeholderTextColor="#94A3B8"
              multiline
              autoFocus
            />
            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancel} onPress={resetIdle}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </Pressable>
              <Pressable style={styles.modalSend} onPress={() => void confirmCaption()}>
                <Text style={styles.modalSendText}>Enviar</Text>
              </Pressable>
            </View>
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
    gap: 12,
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
  modalInput: {
    minHeight: 88,
    borderWidth: 1,
    borderColor: '#94A3B8',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#0F172A',
    fontSize: 15,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 4,
  },
  modalCancel: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  modalCancelText: {
    color: '#64748B',
    fontWeight: '700',
    fontSize: 14,
  },
  modalSend: {
    backgroundColor: '#3A96DD',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  modalSendText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
});

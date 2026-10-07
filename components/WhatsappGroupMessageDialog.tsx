import { CloseButton } from '@/components/minimal/CloseFooterBar';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import {
  fetchSessionWhatsappGroup,
  sendWhatsappGroupMessage,
} from '@/lib/whatsappGroupMessage';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function WhatsappGroupMessageDialog({ visible, onClose }: Props) {
  const [message, setMessage] = useState('');
  const [groupId, setGroupId] = useState<string | null>(null);
  const [loadingGroup, setLoadingGroup] = useState(false);
  const [sending, setSending] = useState(false);
  const [groupHint, setGroupHint] = useState('');

  useEffect(() => {
    if (!visible) {
      return;
    }

    let active = true;
    setMessage('');
    setGroupId(null);
    setGroupHint('');
    setLoadingGroup(true);

    void fetchSessionWhatsappGroup().then((result) => {
      if (!active) {
        return;
      }

      setLoadingGroup(false);

      if (!result.success) {
        setGroupHint(result.message || 'Sem permissão para enviar ao grupo.');
        return;
      }

      setGroupId(result.whatsappGroupId);
      setGroupHint(
        result.whatsappGroupId
          ? 'A mensagem segue para o grupo de WhatsApp desta instância.'
          : 'Cadastre o grupo em Instâncias antes de enviar.'
      );
    });

    return () => {
      active = false;
    };
  }, [visible]);

  const closeDialog = () => {
    setMessage('');
    onClose();
  };

  const handleSend = async () => {
    const text = message.trim();

    if (!text) {
      Toast.show({
        type: 'error',
        text1: 'Mensagem ao grupo',
        text2: 'Escreva a mensagem antes de enviar.',
      });
      return;
    }

    if (!groupId) {
      Toast.show({
        type: 'error',
        text1: 'Mensagem ao grupo',
        text2: 'Esta instância ainda não tem um grupo de WhatsApp.',
      });
      return;
    }

    setSending(true);
    try {
      const result = await sendWhatsappGroupMessage(groupId, text);

      if (!result.opened) {
        Toast.show({
          type: 'error',
          text1: 'Mensagem ao grupo',
          text2: 'O navegador bloqueou a abertura do WhatsApp. Permita pop-ups deste site e tente de novo.',
        });
        return;
      }

      if (result.pasteInGroup) {
        Toast.show({
          type: 'success',
          text1: 'Grupo aberto',
          text2: result.copied
            ? 'A mensagem foi copiada. Cole no grupo do WhatsApp.'
            : 'Cole a mensagem no grupo do WhatsApp.',
        });
      }

      closeDialog();
    } finally {
      setSending(false);
    }
  };

  if (!visible) {
    return null;
  }

  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        <Text style={styles.title}>Mensagem ao grupo</Text>
        <Text style={styles.hint}>{loadingGroup ? 'Lendo o grupo da instância…' : groupHint}</Text>
        <TextInput
          style={styles.input}
          value={message}
          onChangeText={setMessage}
          placeholder="Escreva a mensagem para o grupo"
          placeholderTextColor={MINIMAL_UI.textMuted}
          multiline
          textAlignVertical="top"
          editable={!sending && !loadingGroup}
        />
        <View style={styles.actions}>
          {sending ? (
            <ActivityIndicator color={MINIMAL_UI.accent} />
          ) : (
            <>
              <CloseButton
                label="Enviar"
                accessibilityLabel="Enviar mensagem ao grupo de WhatsApp"
                onPress={() => void handleSend()}
              />
              <CloseButton
                label="Fechar"
                accessibilityLabel="Fechar mensagem ao grupo"
                onPress={closeDialog}
              />
            </>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100000,
    elevation: 100000,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    ...(Platform.OS === 'web' ? ({ position: 'fixed' } as object) : null),
  },
  card: {
    width: '100%',
    maxWidth: 680,
    backgroundColor: MINIMAL_UI.background,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    gap: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: MINIMAL_UI.text,
  },
  hint: {
    fontSize: 13,
    lineHeight: 18,
    color: MINIMAL_UI.textMuted,
  },
  input: {
    minHeight: 160,
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: MINIMAL_UI.blueDark,
    backgroundColor: MINIMAL_UI.background,
  },
  actions: {
    gap: 8,
  },
});

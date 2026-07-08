import { OfferingsClass } from '@/components/OfferingsClass';
import { getAppParameterValue } from '@/lib/appParameters';
import { OFFERINGS_RECIPIENT_ROWS } from '@/lib/offeringsRecipientInfo';
import { VIGILANCE_SCALES_UI } from '@/lib/dashboardCardThemes';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';

type OfferingsClassPanelProps = {
  onClose?: () => void;
};

/** Container com dados e ações — compõe o OfferingsClass stateless. */
export function OfferingsClassPanel({ onClose }: OfferingsClassPanelProps) {
  const router = useRouter();
  const [pixKey, setPixKey] = useState<string | null>(null);
  const [pixKeyLoading, setPixKeyLoading] = useState(true);

  const loadPixKey = useCallback(async () => {
    setPixKeyLoading(true);

    try {
      const value = await getAppParameterValue('chave_pix');
      setPixKey(value?.trim() || null);
    } catch (error) {
      console.error('Erro ao carregar chave PIX:', error);
      setPixKey(null);
    } finally {
      setPixKeyLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPixKey();
  }, [loadPixKey]);

  const handleCopyPixKey = useCallback(async () => {
    if (!pixKey) {
      Alert.alert('Chave PIX indisponível', 'Nenhuma chave PIX foi encontrada para copiar.');
      return;
    }

    try {
      await Clipboard.setStringAsync(pixKey);
      Toast.show({
        type: 'success',
        text1: 'Chave PIX copiada',
        text2: 'Cole no aplicativo do seu banco para concluir a transferência.',
        visibilityTime: 3500,
      });
    } catch (error) {
      console.error('Erro ao copiar chave PIX:', error);
      Alert.alert('Erro ao copiar', 'Não foi possível copiar a chave PIX.');
    }
  }, [pixKey]);

  const handleClose = useCallback(() => {
    if (onClose) {
      onClose();
      return;
    }

    router.back();
  }, [onClose, router]);

  return (
    <View style={styles.root}>
      <OfferingsClass
        recipientRows={OFFERINGS_RECIPIENT_ROWS}
        pixKey={pixKey}
        pixKeyLoading={pixKeyLoading}
        onCopyPixKey={() => {
          void handleCopyPixKey();
        }}
        onRetryLoadPixKey={() => {
          void loadPixKey();
        }}
      />

      <View style={styles.footerBar}>
        <Pressable
          onPress={handleClose}
          style={styles.closeFooterButton}
          accessibilityRole="button"
          accessibilityLabel="Fechar"
        >
          <Text style={styles.closeFooterButtonText}>Fechar</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 0,
    width: '100%',
  },
  footerBar: {
    flexShrink: 0,
    paddingTop: 8,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: VIGILANCE_SCALES_UI.border,
    backgroundColor: '#FFFFFF',
    width: '100%',
  },
  closeFooterButton: {
    minHeight: 51,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#1B4F8A',
    backgroundColor: '#3A96DD',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as const } : null),
  },
  closeFooterButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});

import { OfferingsClass } from '@/components/OfferingsClass';
import { CloseFooterBar } from '@/components/minimal/CloseFooterBar';
import {
  loadOfferingsRecipientBundle,
  type OfferingsRecipientRow,
} from '@/lib/offeringsRecipientInfo';
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import Toast from 'react-native-toast-message';

type OfferingsClassPanelProps = {
  onClose?: () => void;
};

/** Container com dados e ações — compõe o OfferingsClass stateless. */
export function OfferingsClassPanel({ onClose }: OfferingsClassPanelProps) {
  const router = useRouter();
  const [recipientRows, setRecipientRows] = useState<OfferingsRecipientRow[]>([]);
  const [pixKey, setPixKey] = useState<string | null>(null);
  const [pixKeyLoading, setPixKeyLoading] = useState(true);

  const loadOfferingsInfo = useCallback(async () => {
    setPixKeyLoading(true);

    try {
      const bundle = await loadOfferingsRecipientBundle();
      setRecipientRows(bundle.recipientRows);
      setPixKey(bundle.pixKey);
    } catch (error) {
      console.error('Erro ao carregar dados de dízimos/ofertas:', error);
      setRecipientRows([]);
      setPixKey(null);
    } finally {
      setPixKeyLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadOfferingsInfo();
    }, [loadOfferingsInfo])
  );

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
        recipientRows={recipientRows}
        pixKey={pixKey}
        pixKeyLoading={pixKeyLoading}
        onCopyPixKey={() => {
          void handleCopyPixKey();
        }}
        onRetryLoadPixKey={() => {
          void loadOfferingsInfo();
        }}
      />

      <CloseFooterBar onPress={handleClose} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 0,
    width: '100%',
  },
});

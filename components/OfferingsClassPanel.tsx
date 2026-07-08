import { OfferingsClass } from '@/components/OfferingsClass';
import { getAppParameterValue } from '@/lib/appParameters';
import { OFFERINGS_RECIPIENT_ROWS } from '@/lib/offeringsRecipientInfo';
import * as Clipboard from 'expo-clipboard';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import Toast from 'react-native-toast-message';

/** Container com dados e ações — compõe o OfferingsClass stateless. */
export function OfferingsClassPanel() {
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

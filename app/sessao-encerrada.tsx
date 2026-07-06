import { Image } from 'expo-image';
import { PWA_SIGNED_OUT_ROUTE } from '@/lib/userSession';
import React, { useEffect } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

/** Tela neutra após sair do app quando o sistema não permite fechar a janela. */
export default function SessaoEncerradaScreen() {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      return;
    }

    window.history.replaceState(null, '', PWA_SIGNED_OUT_ROUTE);

    const keepOnSignedOutScreen = () => {
      window.history.pushState(null, '', PWA_SIGNED_OUT_ROUTE);
    };

    window.history.pushState(null, '', PWA_SIGNED_OUT_ROUTE);
    window.addEventListener('popstate', keepOnSignedOutScreen);

    return () => {
      window.removeEventListener('popstate', keepOnSignedOutScreen);
    };
  }, []);

  return (
    <View style={styles.container}>
      <Image source={require('@/assets/images/icon.png')} style={styles.logo} contentFit="contain" />
      <Text style={styles.title}>Sessão encerrada</Text>
      <Text style={styles.message}>
        Sua sessão foi encerrada. Em aplicativos instalados, o sistema pode manter o app em
        segundo plano — use o botão Início ou troque de app para sair completamente. Para entrar
        novamente, abra o atalho na tela inicial.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    backgroundColor: '#0f172a',
  },
  logo: {
    width: 96,
    height: 96,
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    lineHeight: 24,
    color: '#94a3b8',
    textAlign: 'center',
  },
});

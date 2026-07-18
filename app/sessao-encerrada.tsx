import { Image } from 'expo-image';
import { PWA_SIGNED_OUT_ROUTE } from '@/lib/userSession';
import React, { useEffect } from 'react';
import { Platform, Text, View } from 'react-native';

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
    <View className="flex-1 items-center justify-center bg-slate-900 px-8">
      <Image
        source={require('@/assets/images/icon.png')}
        className="mb-6 h-24 w-24"
        contentFit="contain"
      />
      <Text className="mb-3 text-center text-2xl font-bold text-slate-50">Sessão encerrada</Text>
      <Text className="text-center text-base leading-6 text-slate-400">
        Sua sessão foi encerrada. Em aplicativos instalados, o sistema pode manter o app em
        segundo plano — use o botão Início ou troque de app para sair completamente. Para entrar
        novamente, abra o atalho na tela inicial.
      </Text>
    </View>
  );
}

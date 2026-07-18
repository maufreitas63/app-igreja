import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StatusBar, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MinimalScreenLayout } from './MinimalScreenLayout';

type Props = {
  minimal: boolean;
  title?: string;
  gradientColors: readonly [string, string, ...string[]];
  statusBarStyle?: 'light-content' | 'dark-content';
  children: React.ReactNode;
};

/** Envolve telas legadas (gradiente + carrossel) ou modo minimalista (tela limpa + dock). */
export function MinimalRouteShell({
  minimal,
  title,
  gradientColors,
  statusBarStyle = 'light-content',
  children,
}: Props) {
  if (minimal) {
    const chromeTitle = title?.trim() ? title : undefined;

    return (
      <MinimalScreenLayout {...(chromeTitle ? { title: chromeTitle } : {})} scroll={false}>
        <StatusBar barStyle="dark-content" />
        <View className="min-h-0 w-full min-w-0 max-w-full flex-1 overflow-hidden">{children}</View>
      </MinimalScreenLayout>
    );
  }

  return (
    <LinearGradient colors={gradientColors} className="w-full min-w-0 max-w-full flex-1 overflow-hidden bg-minimal-bg">
      <SafeAreaView
        className="w-full min-w-0 max-w-full flex-1 overflow-hidden bg-minimal-bg"
        edges={['top', 'left', 'right']}
      >
        <StatusBar barStyle={statusBarStyle} />
        {children}
      </SafeAreaView>
    </LinearGradient>
  );
}

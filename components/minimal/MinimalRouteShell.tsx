import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MinimalScreenLayout } from './MinimalScreenLayout';

type Props = {
  minimal: boolean;
  title?: string;
  gradientColors: readonly [string, string, ...string[]];
  statusBarStyle?: 'light-content' | 'dark-content';
  children: React.ReactNode;
  footer?: React.ReactNode;
};

/** Envolve telas legadas (gradiente + carrossel) ou modo minimalista (tela limpa + dock). */
export function MinimalRouteShell({
  minimal,
  title,
  gradientColors,
  statusBarStyle = 'light-content',
  children,
  footer,
}: Props) {
  if (minimal) {
    const chromeTitle = title?.trim() ? title : undefined;

    return (
      <MinimalScreenLayout
        {...(chromeTitle ? { title: chromeTitle } : {})}
        scroll={false}
        footer={footer}
      >
        <StatusBar barStyle="dark-content" />
        <View style={styles.minimalContent}>{children}</View>
      </MinimalScreenLayout>
    );
  }

  return (
    <LinearGradient colors={gradientColors} style={styles.container}>
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <StatusBar barStyle={statusBarStyle} />
        {children}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: MINIMAL_UI.background,
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    overflow: 'hidden',
  },
  minimalContent: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    overflow: 'hidden',
  },
});

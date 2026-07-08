import { MinimalHomeProvider } from '@/context/MinimalHomeContext';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import React from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppDrawer } from './AppDrawer';
import { MinimalTopLeftChrome } from './MinimalTopLeftChrome';

type Props = {
  /** Exibe «Olá, {nome}» — apenas na tela inicial do menu. */
  showGreeting?: boolean;
  title?: string;
  header?: React.ReactNode;
  fixedTop?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  contentContainerStyle?: ViewStyle;
  /** Quando false, o conteúdo ocupa flex:1 sem ScrollView (telas com listas internas). */
  scroll?: boolean;
};

function MinimalScreenLayoutBody({
  title,
  header,
  fixedTop,
  children,
  footer,
  contentContainerStyle,
  scroll = true,
  showGreeting = false,
}: Props) {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <AppDrawer />
      <View style={styles.shell}>
        <MinimalTopLeftChrome title={title} header={header} showGreeting={showGreeting} />

        <View style={styles.body}>
          {fixedTop ? <View style={styles.fixedTop}>{fixedTop}</View> : null}

          {scroll ? (
            <ScrollView
              style={styles.main}
              contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
            >
              {children}
            </ScrollView>
          ) : (
            <View style={[styles.main, styles.flexContent, contentContainerStyle]}>{children}</View>
          )}

          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </View>
      </View>
    </SafeAreaView>
  );
}

export function MinimalScreenLayout(props: Props) {
  return (
    <MinimalHomeProvider>
      <MinimalScreenLayoutBody {...props} />
    </MinimalHomeProvider>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: MINIMAL_UI.background,
  },
  shell: {
    flex: 1,
    minHeight: 0,
  },
  body: {
    flex: 1,
    minHeight: 0,
    flexDirection: 'column',
  },
  fixedTop: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: MINIMAL_UI.background,
    flexShrink: 0,
  },
  main: {
    flex: 1,
    minHeight: 0,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  flexContent: {
    paddingHorizontal: 16,
  },
  footer: {
    flexShrink: 0,
    paddingHorizontal: 16,
    backgroundColor: MINIMAL_UI.background,
  },
});

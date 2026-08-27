import { MinimalHomeProvider } from '@/context/MinimalHomeContext';
import { MINIMAL_SCREEN_PADDING_LEFT, MINIMAL_SCREEN_PADDING_RIGHT, MINIMAL_UI } from '@/lib/minimalUiTheme';
import React from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppDrawer } from './AppDrawer';
import { MinimalTopLeftChrome } from './MinimalTopLeftChrome';

type Props = {
  /** «Olá, {nome}» visível na home; nas demais o espaço permanece (texto invisível). */
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
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    overflow: 'hidden',
  },
  shell: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    overflow: 'hidden',
  },
  body: {
    flex: 1,
    minHeight: 0,
    flexDirection: 'column',
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    overflow: 'hidden',
  },
  fixedTop: {
    paddingLeft: MINIMAL_SCREEN_PADDING_LEFT,
    paddingRight: MINIMAL_SCREEN_PADDING_RIGHT,
    paddingBottom: 8,
    backgroundColor: MINIMAL_UI.background,
    flexShrink: 0,
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
  },
  main: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
  },
  scrollContent: {
    paddingLeft: MINIMAL_SCREEN_PADDING_LEFT,
    paddingRight: MINIMAL_SCREEN_PADDING_RIGHT,
    paddingBottom: 12,
    maxWidth: '100%',
    minWidth: 0,
    alignSelf: 'stretch',
  },
  flexContent: {
    paddingLeft: MINIMAL_SCREEN_PADDING_LEFT,
    paddingRight: MINIMAL_SCREEN_PADDING_RIGHT,
    maxWidth: '100%',
    minWidth: 0,
    alignSelf: 'stretch',
    flex: 1,
    overflow: 'hidden',
  },
  footer: {
    flexShrink: 0,
    paddingLeft: MINIMAL_SCREEN_PADDING_LEFT,
    paddingRight: MINIMAL_SCREEN_PADDING_RIGHT,
    backgroundColor: MINIMAL_UI.background,
    maxWidth: '100%',
    minWidth: 0,
    alignSelf: 'stretch',
  },
});

import { MinimalHomeProvider } from '@/context/MinimalHomeContext';
import { MINIMAL_EXIT_BAR_HEIGHT, MINIMAL_UI } from '@/lib/minimalUiTheme';
import React from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppDrawer } from './AppDrawer';
import { MinimalExitBar } from './MinimalExitBar';
import { MinimalTopLeftChrome } from './MinimalTopLeftChrome';

type Props = {
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
}: Props) {
  const contentPaddingBottom = MINIMAL_EXIT_BAR_HEIGHT + 12;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <AppDrawer />
      <View style={styles.shell}>
        <MinimalTopLeftChrome title={title} header={header} />

        <View style={[styles.body, { paddingBottom: MINIMAL_EXIT_BAR_HEIGHT }]}>
          {fixedTop ? <View style={styles.fixedTop}>{fixedTop}</View> : null}

          {scroll ? (
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={[
                styles.scrollContent,
                { paddingBottom: contentPaddingBottom },
                contentContainerStyle,
              ]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
            >
              {children}
            </ScrollView>
          ) : (
            <View
              style={[
                styles.flexContent,
                { paddingBottom: contentPaddingBottom },
                contentContainerStyle,
              ]}
            >
              {children}
            </View>
          )}

          {footer ? (
            <View style={[styles.footer, { bottom: MINIMAL_EXIT_BAR_HEIGHT }]}>{footer}</View>
          ) : null}
        </View>
      </View>

      <MinimalExitBar />
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
  },
  fixedTop: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: MINIMAL_UI.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  flexContent: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: 16,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: MINIMAL_UI.background,
    zIndex: 10,
  },
});

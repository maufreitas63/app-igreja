import { MINIMAL_BOTTOM_DOCK_HEIGHT, MINIMAL_TYPO, MINIMAL_UI } from '@/lib/minimalUiTheme';
import React from 'react';
import { ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppDrawer } from './AppDrawer';
import { MinimalBottomDock } from './MinimalBottomDock';

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

export function MinimalScreenLayout({
  title,
  header,
  fixedTop,
  children,
  footer,
  contentContainerStyle,
  scroll = true,
}: Props) {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <AppDrawer />

      {title ? (
        <View style={styles.titleBar}>
          <Text style={styles.title}>{title}</Text>
        </View>
      ) : null}

      {header}

      {fixedTop ? <View style={styles.fixedTop}>{fixedTop}</View> : null}

      {scroll ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: MINIMAL_BOTTOM_DOCK_HEIGHT + 16 },
            contentContainerStyle,
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.flexContent, contentContainerStyle]}>{children}</View>
      )}

      {footer ? <View style={[styles.footer, { bottom: MINIMAL_BOTTOM_DOCK_HEIGHT }]}>{footer}</View> : null}

      <MinimalBottomDock />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: MINIMAL_UI.background,
  },
  titleBar: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  title: {
    ...MINIMAL_TYPO.screenTitle,
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
    paddingBottom: MINIMAL_BOTTOM_DOCK_HEIGHT + 8,
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

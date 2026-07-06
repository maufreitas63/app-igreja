import { useAppDrawer } from '@/context/AppDrawerContext';
import { MINIMAL_UI, MINIMAL_TYPO } from '@/lib/minimalUiTheme';
import { FontAwesome } from '@expo/vector-icons';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppDrawer } from './AppDrawer';

type Props = {
  title?: string;
  header?: React.ReactNode;
  fixedTop?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  contentContainerStyle?: ViewStyle;
};

export function MinimalScreenLayout({
  title,
  header,
  fixedTop,
  children,
  footer,
  contentContainerStyle,
}: Props) {
  const { openDrawer } = useAppDrawer();

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <AppDrawer />
      <View style={styles.topBar}>
        <Pressable
          accessibilityLabel="Abrir menu"
          accessibilityRole="button"
          onPress={openDrawer}
          style={styles.menuButton}
        >
          <FontAwesome name="bars" size={22} color={MINIMAL_UI.icon} />
        </Pressable>
        {title ? <Text style={styles.title}>{title}</Text> : <View style={styles.titleSpacer} />}
      </View>

      {header}

      {fixedTop ? <View style={styles.fixedTop}>{fixedTop}</View> : null}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator
      >
        {children}
      </ScrollView>

      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: MINIMAL_UI.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 8,
    gap: 8,
  },
  menuButton: {
    padding: 8,
  },
  title: {
    ...MINIMAL_TYPO.screenTitle,
    flex: 1,
  },
  titleSpacer: {
    flex: 1,
  },
  fixedTop: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: MINIMAL_UI.divider,
    backgroundColor: MINIMAL_UI.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: MINIMAL_UI.divider,
    backgroundColor: MINIMAL_UI.background,
  },
});

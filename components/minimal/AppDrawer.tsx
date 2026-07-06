import { useAppDrawer } from '@/context/AppDrawerContext';
import { useAppDrawerMenu, type AppDrawerMenuItemResolved } from '@/hooks/useAppDrawerMenu';
import { navigateDrawerMenuItem } from '@/lib/appDrawerMenu';
import { MINIMAL_UI, MINIMAL_TYPO } from '@/lib/minimalUiTheme';
import { useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function AppDrawer() {
  const { isOpen, closeDrawer } = useAppDrawer();
  const { items, loading, refresh } = useAppDrawerMenu();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (isOpen) {
      void refresh();
    }
  }, [isOpen, refresh]);

  const handlePress = (item: AppDrawerMenuItemResolved) => {
    if (!item.enabled) {
      Alert.alert(
        'Indisponível',
        'Você não tem permissão para abrir este módulo no momento.'
      );
      return;
    }

    closeDrawer();
    void navigateDrawerMenuItem(router, item.moduleKey);
  };

  return (
    <Modal animationType="slide" transparent visible={isOpen} onRequestClose={closeDrawer}>
      <View style={styles.overlay}>
        <View style={[styles.panel, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}>
          <Text style={styles.title}>Menu</Text>
          {loading ? (
            <ActivityIndicator color={MINIMAL_UI.icon} style={styles.loader} />
          ) : (
            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator>
              {items.map((item) => (
                <TouchableOpacity
                  key={item.moduleKey}
                  style={[styles.item, !item.enabled && styles.itemDisabled]}
                  onPress={() => handlePress(item)}
                >
                  <Text style={[styles.itemLabel, !item.enabled && styles.itemLabelDisabled]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
        <Pressable style={styles.backdrop} onPress={closeDrawer} accessibilityLabel="Fechar menu" />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    flexDirection: 'row',
  },
  panel: {
    width: '82%',
    maxWidth: 320,
    backgroundColor: MINIMAL_UI.background,
    paddingHorizontal: 16,
    zIndex: 2,
    flex: 1,
    maxHeight: '100%',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  title: {
    ...MINIMAL_TYPO.screenTitle,
    marginBottom: 12,
  },
  loader: {
    marginTop: 24,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 16,
  },
  item: {
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  itemDisabled: {
    opacity: 0.45,
  },
  itemLabel: {
    ...MINIMAL_TYPO.menuItem,
  },
  itemLabelDisabled: {
    color: MINIMAL_UI.textMuted,
  },
});

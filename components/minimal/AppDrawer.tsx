import { useAppDrawer } from '@/context/AppDrawerContext';
import { useAppDrawerMenu, type AppDrawerMenuItemResolved } from '@/hooks/useAppDrawerMenu';
import { navigateDrawerMenuItem, isDrawerMenuPlaceholder } from '@/lib/appDrawerMenu';
import { MINIMAL_UI, MINIMAL_TYPO } from '@/lib/minimalUiTheme';
import { useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import {
  ActivityIndicator,
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
    if (item.pendingRoute || isDrawerMenuPlaceholder(item.moduleKey)) {
      return;
    }

    closeDrawer();
    void navigateDrawerMenuItem(router, item.moduleKey);
  };

  const visibleItems = items.filter((item) => item.enabled);

  return (
    <Modal animationType="slide" transparent visible={isOpen} onRequestClose={closeDrawer}>
      <View style={styles.overlay}>
        <View style={[styles.panel, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}>
          <Text style={styles.title}>Menu</Text>
          {loading ? (
            <ActivityIndicator color={MINIMAL_UI.icon} style={styles.loader} />
          ) : (
            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator>
              {visibleItems.map((item) => (
                <TouchableOpacity
                  key={item.moduleKey}
                  style={[styles.item, item.pendingRoute && styles.itemPendingRoute]}
                  onPress={() => handlePress(item)}
                  disabled={item.pendingRoute}
                  accessibilityState={{ disabled: item.pendingRoute }}
                >
                  <Text style={[styles.itemLabel, item.pendingRoute && styles.itemLabelPendingRoute]}>
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
    minHeight: 48,
    justifyContent: 'center',
    paddingVertical: 12,
  },
  itemLabel: {
    ...MINIMAL_TYPO.menuItem,
    textAlign: 'left',
  },
  itemPendingRoute: {
    opacity: 0.72,
  },
  itemLabelPendingRoute: {
    color: MINIMAL_UI.textMuted,
  },
});

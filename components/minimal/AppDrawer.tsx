import { useAppDrawer } from '@/context/AppDrawerContext';
import { useAppDrawerMenu } from '@/hooks/useAppDrawerMenu';
import { navigateDrawerMenuItem } from '@/lib/appDrawerMenu';
import { MINIMAL_UI, MINIMAL_TYPO } from '@/lib/minimalUiTheme';
import { useRouter } from 'expo-router';
import React from 'react';
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
  const { items, loading } = useAppDrawerMenu();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <Modal animationType="slide" transparent visible={isOpen} onRequestClose={closeDrawer}>
      <View style={styles.overlay}>
        <View style={[styles.panel, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}>
          <Text style={styles.title}>Menu</Text>
          {loading ? (
            <ActivityIndicator color={MINIMAL_UI.icon} style={styles.loader} />
          ) : (
            <ScrollView showsVerticalScrollIndicator>
              {items.map((item) => (
                <TouchableOpacity
                  key={item.moduleKey}
                  style={styles.item}
                  onPress={() => {
                    closeDrawer();
                    void navigateDrawerMenuItem(router, item.moduleKey);
                  }}
                >
                  <Text style={styles.itemLabel}>{item.label}</Text>
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
  item: {
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  itemLabel: {
    ...MINIMAL_TYPO.menuItem,
  },
});

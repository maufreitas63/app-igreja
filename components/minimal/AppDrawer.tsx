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
        <Pressable style={styles.backdrop} onPress={closeDrawer} accessibilityLabel="Fechar menu" />
        <View style={[styles.panel, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}>
          <Text style={styles.title}>Menu</Text>
          {loading ? (
            <ActivityIndicator color={MINIMAL_UI.icon} style={styles.loader} />
          ) : (
            <ScrollView showsVerticalScrollIndicator>
              {items.map((item) => (
                <React.Fragment key={item.moduleKey}>
                  {item.dividerBefore ? <View style={styles.divider} /> : null}
                  <TouchableOpacity
                    style={styles.item}
                    onPress={() => {
                      closeDrawer();
                      void navigateDrawerMenuItem(router, item.moduleKey);
                    }}
                  >
                    <Text style={styles.itemLetter}>{item.letter})</Text>
                    <Text style={styles.itemLabel}>{item.label}</Text>
                  </TouchableOpacity>
                </React.Fragment>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    flexDirection: 'row',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  panel: {
    width: '82%',
    maxWidth: 320,
    backgroundColor: MINIMAL_UI.background,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: MINIMAL_UI.border,
    paddingHorizontal: 16,
  },
  title: {
    ...MINIMAL_TYPO.screenTitle,
    marginBottom: 12,
  },
  loader: {
    marginTop: 24,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: MINIMAL_UI.icon,
    marginVertical: 10,
    opacity: 0.35,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: MINIMAL_UI.divider,
  },
  itemLetter: {
    width: 22,
    color: MINIMAL_UI.icon,
    fontWeight: '700',
    fontSize: 14,
  },
  itemLabel: {
    ...MINIMAL_TYPO.menuItem,
    flex: 1,
  },
});

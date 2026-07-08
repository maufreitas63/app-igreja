import { useAppDrawer } from '@/context/AppDrawerContext';
import { withMinimalPresentation } from '@/lib/dashboardReturnNavigation';
import { MINIMAL_ICON, MINIMAL_TYPO, MINIMAL_UI } from '@/lib/minimalUiTheme';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type SettingsItem = {
  id: string;
  label: string;
  hint?: string;
  icon: React.ComponentProps<typeof FontAwesome>['name'];
  onPress: () => void;
};

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function AppDrawerSettings({ visible, onClose }: Props) {
  const router = useRouter();
  const { closeDrawer } = useAppDrawer();
  const insets = useSafeAreaInsets();

  const navigateAndClose = (pathname: '/perfil' | '/lgpd') => {
    onClose();
    closeDrawer();
    router.push({
      pathname,
      params: withMinimalPresentation(),
    });
  };

  const items: SettingsItem[] = [
    {
      id: 'profile',
      label: 'Meu perfil',
      hint: 'Dados cadastrais e classificação ministerial',
      icon: 'user',
      onPress: () => navigateAndClose('/perfil'),
    },
    {
      id: 'lgpd',
      label: 'Privacidade (LGPD)',
      hint: 'Termos de uso e consentimento',
      icon: 'shield',
      onPress: () => navigateAndClose('/lgpd'),
    },
  ];

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Fechar configurações" />
        <View style={[styles.panel, { paddingTop: insets.top + 12, paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Configurações</Text>
            <Pressable
              accessibilityLabel="Fechar configurações"
              accessibilityRole="button"
              onPress={onClose}
              style={styles.closeButton}
            >
              <FontAwesome name="times" size={MINIMAL_ICON.action + 4} color={MINIMAL_UI.icon} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator
            keyboardShouldPersistTaps="handled"
          >
            {items.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.item}
                onPress={item.onPress}
                accessibilityRole="button"
                accessibilityLabel={item.label}
              >
                <View style={styles.itemIconWrap}>
                  <FontAwesome name={item.icon} size={MINIMAL_ICON.action} color={MINIMAL_UI.icon} />
                </View>
                <View style={styles.itemCopy}>
                  <Text style={styles.itemLabel}>{item.label}</Text>
                  {item.hint ? <Text style={styles.itemHint}>{item.hint}</Text> : null}
                </View>
                <FontAwesome name="chevron-right" size={12} color={MINIMAL_UI.textMuted} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  panel: {
    width: '82%',
    maxWidth: 320,
    height: '100%',
    backgroundColor: MINIMAL_UI.background,
    paddingHorizontal: 16,
    zIndex: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  title: {
    ...MINIMAL_TYPO.screenTitle,
    flex: 1,
  },
  closeButton: {
    padding: 4,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 8,
    gap: 4,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: MINIMAL_UI.divider,
  },
  itemIconWrap: {
    width: 28,
    alignItems: 'center',
  },
  itemCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  itemLabel: {
    ...MINIMAL_TYPO.menuItem,
    fontWeight: '600',
  },
  itemHint: {
    fontSize: 12,
    color: MINIMAL_UI.textMuted,
    lineHeight: 16,
  },
});

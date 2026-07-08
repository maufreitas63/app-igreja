import { useAppDrawer } from '@/context/AppDrawerContext';
import { withMinimalPresentation } from '@/lib/dashboardReturnNavigation';
import { MINIMAL_ICON, MINIMAL_TYPO, MINIMAL_UI } from '@/lib/minimalUiTheme';
import { getStoredUserPhone } from '@/lib/userSession';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  InteractionManager,
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
  onClose: () => void;
};

export function AppDrawerSettings({ onClose }: Props) {
  const router = useRouter();
  const { closeDrawer } = useAppDrawer();
  const insets = useSafeAreaInsets();

  const navigateAndClose = () => {
    onClose();
    closeDrawer();

    void InteractionManager.runAfterInteractions(async () => {
      const phone = (await getStoredUserPhone())?.trim();
      const params = withMinimalPresentation();

      if (phone) {
        params.phone = encodeURIComponent(phone);
      }

      router.push({
        pathname: '/lgpd',
        params,
      });
    });
  };

  const items: SettingsItem[] = [
    {
      id: 'lgpd',
      label: 'Privacidade (LGPD)',
      hint: 'Termos de uso e consentimento',
      icon: 'shield',
      onPress: navigateAndClose,
    },
  ];

  return (
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
  );
}

const styles = StyleSheet.create({
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

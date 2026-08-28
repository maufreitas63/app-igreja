import { useAppDrawer } from '@/context/AppDrawerContext';
import { useAppDrawerMenu, type AppDrawerMenuItemResolved } from '@/hooks/useAppDrawerMenu';
import {
  APP_DRAWER_SETTINGS_GROUPS,
  DISCIPLESHIP_SETTINGS_MODULE_KEYS,
  isDrawerMenuPlaceholder,
  navigateDrawerMenuItem,
  type AppDrawerModuleKey,
} from '@/lib/appDrawerMenu';
import { traceClick } from '@/lib/devClickTrace';
import { MINIMAL_ICON, MINIMAL_TOP_CHROME_MIN_HEIGHT, MINIMAL_UI, MINIMAL_TYPO } from '@/lib/minimalUiTheme';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { MinimalExitBar } from './MinimalExitBar';
import {
  AppDrawerSettings,
  type AppDrawerSettingsRow,
  type AppDrawerSettingsSection,
} from './AppDrawerSettings';

const SETTINGS_ICONS: Partial<Record<AppDrawerModuleKey, React.ComponentProps<typeof FontAwesome>['name']>> = {
  menu_salas: 'home',
  menu_totem: 'qrcode',
  menu_autorizacao_midia: 'shield',
  menu_membros: 'users',
  menu_mapa: 'map-marker',
  menu_aniversariantes: 'birthday-cake',
  pastoral_care: 'heart',
  small_groups_management: 'group',
  volunteer_mural: 'handshake-o',
  family_reception: 'home',
  profile_cadastro: 'user-plus',
  menu_administrativo: 'briefcase',
  Events: 'calendar',
  Event_gantt: 'sliders',
  event_orchestration: 'bullhorn',
  sala_servidor: 'building',
  scales_type: 'tags',
  scales_volunteers: 'users',
  scales: 'calendar-check-o',
  quorum_presence: 'check-square-o',
  menu_orquestrador: 'film',
  financials: 'line-chart',
  campaigns_management: 'flag',
  predictive_insights: 'lightbulb-o',
  discipleship_themes: 'book',
  discipleship_alerts: 'graduation-cap',
  discipleship_reset: 'refresh',
  relatorios: 'bar-chart',
  access_control: 'lock',
  mudanca_papeis: 'exchange',
  transferencia_igreja: 'random',
  profile_access_insights: 'eye',
  auditor: 'user-secret',
  menu_billing: 'credit-card',
  menu_igrejas: 'building',
};

export function AppDrawer() {
  const { isOpen, closeDrawer } = useAppDrawer();
  const { items, settingsItems, loading, refresh, canAccessSettings } = useAppDrawerMenu();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      void refresh();
    } else {
      setSettingsOpen(false);
    }
  }, [isOpen, refresh]);

  const handlePress = (item: AppDrawerMenuItemResolved) => {
    traceClick('drawer', 'menu-item-press', {
      moduleKey: item.moduleKey,
      label: item.label,
      pendingRoute: item.pendingRoute,
    });

    if (item.pendingRoute || isDrawerMenuPlaceholder(item.moduleKey)) {
      traceClick('drawer', 'menu-item-blocked', { moduleKey: item.moduleKey });
      return;
    }

    traceClick('drawer', 'menu-item-navigate', { moduleKey: item.moduleKey });
    closeDrawer();
    void navigateDrawerMenuItem(router, item.moduleKey);
  };

  const handleSettingsNavigate = useCallback((moduleKey: AppDrawerModuleKey, label: string) => {
    traceClick('drawer', 'settings-item-navigate', { moduleKey, label });
    setSettingsOpen(false);
    closeDrawer();
    void navigateDrawerMenuItem(router, moduleKey);
  }, [closeDrawer, router]);

  const visibleItems = items.filter((item) => item.enabled);
  const enabledSettings = settingsItems.filter((item) => item.enabled);

  const { sections, trailItems, pinnedItem } = useMemo(() => {
    const toRow = (item: (typeof enabledSettings)[number]): AppDrawerSettingsRow => ({
      id: item.moduleKey,
      label: item.label,
      hint: item.hint,
      icon: SETTINGS_ICONS[item.moduleKey] ?? 'cog',
      onPress: () => handleSettingsNavigate(item.moduleKey, item.label),
    });

    const trail = enabledSettings.filter((item) => DISCIPLESHIP_SETTINGS_MODULE_KEYS.has(item.moduleKey));
    const igrejas = enabledSettings.find((item) => item.moduleKey === 'menu_igrejas') ?? null;
    const rest = enabledSettings.filter(
      (item) =>
        !DISCIPLESHIP_SETTINGS_MODULE_KEYS.has(item.moduleKey) && item.moduleKey !== 'menu_igrejas'
    );

    const sectionsNext: AppDrawerSettingsSection[] = APP_DRAWER_SETTINGS_GROUPS.map((group) => ({
      id: group.id,
      title: group.title,
      items: rest.filter((item) => item.group === group.id).map(toRow),
    }));

    return {
      sections: sectionsNext,
      trailItems: trail.map(toRow),
      pinnedItem: igrejas ? toRow(igrejas) : null,
    };
  }, [enabledSettings, handleSettingsNavigate]);

  const handleBackdropPress = () => {
    traceClick('drawer', 'backdrop-press', { settingsOpen });
    if (settingsOpen) {
      setSettingsOpen(false);
      return;
    }
    closeDrawer();
  };

  const panelTopOffset = insets.top + MINIMAL_TOP_CHROME_MIN_HEIGHT;

  return (
    <Modal
      animationType="slide"
      transparent
      visible={isOpen}
      onRequestClose={settingsOpen ? () => setSettingsOpen(false) : closeDrawer}
    >
      <View style={styles.overlay}>
        <View style={[styles.chromeGap, { height: panelTopOffset }]} />
        <View style={styles.sheet}>
          {settingsOpen && canAccessSettings ? (
            <AppDrawerSettings
              onClose={() => {
                traceClick('drawer', 'settings-close-press');
                setSettingsOpen(false);
              }}
              sections={sections}
              trailItems={trailItems}
              pinnedItem={pinnedItem}
            />
          ) : (
            <View style={styles.panel}>
              <View style={styles.headerRow}>
                <Text style={styles.title}>Menu</Text>
                {canAccessSettings ? (
                  <Pressable
                    accessibilityLabel="Abrir configurações"
                    accessibilityRole="button"
                    onPress={() => {
                      traceClick('drawer', 'settings-open-press');
                      setSettingsOpen(true);
                    }}
                    style={styles.settingsButton}
                  >
                    <FontAwesome name="cog" size={MINIMAL_ICON.menu - 2} color={MINIMAL_UI.icon} />
                  </Pressable>
                ) : null}
              </View>
              {loading ? (
                <View style={styles.loaderWrap}>
                  <ActivityIndicator color={MINIMAL_UI.icon} />
                </View>
              ) : (
                <ScrollView
                  style={styles.scroll}
                  contentContainerStyle={styles.scrollContent}
                  showsVerticalScrollIndicator
                  keyboardShouldPersistTaps="handled"
                >
                  {visibleItems.map((item) => (
                    <TouchableOpacity
                      key={item.moduleKey}
                      style={[styles.item, item.pendingRoute && styles.itemPendingRoute]}
                      onPress={() => handlePress(item)}
                      disabled={item.pendingRoute}
                      accessibilityState={{ disabled: item.pendingRoute }}
                    >
                      {item.dividerBefore ? <View style={styles.divider} /> : null}
                      <Text style={[styles.itemLabel, item.pendingRoute && styles.itemLabelPendingRoute]}>
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
              <MinimalExitBar variant="drawer" />
            </View>
          )}
          <Pressable style={styles.backdrop} onPress={handleBackdropPress} accessibilityLabel="Fechar menu" />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    flexDirection: 'column',
  },
  chromeGap: {
    width: '100%',
    backgroundColor: 'transparent',
    pointerEvents: 'none',
  },
  sheet: {
    flex: 1,
    flexDirection: 'row',
    minHeight: 0,
  },
  panel: {
    width: '82%',
    maxWidth: 320,
    backgroundColor: MINIMAL_UI.background,
    paddingHorizontal: 16,
    paddingTop: 12,
    zIndex: 2,
    flex: 1,
    maxHeight: '100%',
    flexDirection: 'column',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  title: {
    ...MINIMAL_TYPO.screenTitle,
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  settingsButton: {
    padding: 4,
  },
  loaderWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 8,
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
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: MINIMAL_UI.divider,
    marginBottom: 8,
  },
});

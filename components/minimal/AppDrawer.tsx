import { useAppDrawer } from '@/context/AppDrawerContext';
import { useAppDrawerMenu, type AppDrawerMenuItemResolved } from '@/hooks/useAppDrawerMenu';
import { navigateDrawerMenuItem, isDrawerMenuPlaceholder } from '@/lib/appDrawerMenu';
import { withMinimalPresentation } from '@/lib/dashboardReturnNavigation';
import { traceClick } from '@/lib/devClickTrace';
import { MINIMAL_ICON, MINIMAL_UI, MINIMAL_TYPO } from '@/lib/minimalUiTheme';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
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
import { AppDrawerSettings } from './AppDrawerSettings';

export function AppDrawer() {
  const { isOpen, closeDrawer } = useAppDrawer();
  const { items, loading, refresh } = useAppDrawerMenu();
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

  const visibleItems = items.filter((item) => item.enabled);

  const handleOpenLgpd = () => {
    const params = withMinimalPresentation();

    traceClick('drawer', 'settings-lgpd-press', { params });

    router.push({
      pathname: '/lgpd',
      params,
    });

    traceClick('drawer', 'settings-lgpd-router-push-called', { pathname: '/lgpd', params });

    setSettingsOpen(false);
    closeDrawer();

    traceClick('drawer', 'settings-lgpd-drawer-closed');
  };

  const handleBackdropPress = () => {
    traceClick('drawer', 'backdrop-press', { settingsOpen });
    if (settingsOpen) {
      setSettingsOpen(false);
      return;
    }

    closeDrawer();
  };

  return (
    <Modal
      animationType="slide"
      transparent
      visible={isOpen}
      onRequestClose={settingsOpen ? () => setSettingsOpen(false) : closeDrawer}
    >
      <View style={styles.overlay}>
        {settingsOpen ? (
          <AppDrawerSettings
            onClose={() => {
              traceClick('drawer', 'settings-close-press');
              setSettingsOpen(false);
            }}
            onOpenLgpd={handleOpenLgpd}
          />
        ) : (
          <View style={[styles.panel, { paddingTop: insets.top + 12 }]}>
            <View style={styles.headerRow}>
              <Text style={styles.title}>Menu</Text>
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
});

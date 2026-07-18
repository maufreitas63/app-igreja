import { useAppDrawer } from '@/context/AppDrawerContext';
import { useAppDrawerMenu, type AppDrawerMenuItemResolved } from '@/hooks/useAppDrawerMenu';
import { navigateDrawerMenuItem, isDrawerMenuPlaceholder } from '@/lib/appDrawerMenu';
import { withMinimalPresentation } from '@/lib/dashboardReturnNavigation';
import { traceClick } from '@/lib/devClickTrace';
import { MINIMAL_ICON, MINIMAL_TOP_CHROME_MIN_HEIGHT, MINIMAL_UI } from '@/lib/minimalUiTheme';
import { cn } from '@/lib/utils';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PttDirectoryAdminPanel } from '@/components/PttDirectoryAdminPanel';
import { PttWalkieSettingsPanel } from '@/components/PttWalkieSettingsPanel';
import { MinimalExitBar } from './MinimalExitBar';
import { AppDrawerSettings } from './AppDrawerSettings';

type SettingsPanel = 'root' | 'walkie' | 'walkie-users';

export function AppDrawer() {
  const { isOpen, closeDrawer } = useAppDrawer();
  const { items, loading, refresh, isSuperAdmin, canManageRooms, canManageAvisos } = useAppDrawerMenu();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsPanel, setSettingsPanel] = useState<SettingsPanel>('root');

  useEffect(() => {
    if (isOpen) {
      void refresh();
    } else {
      setSettingsOpen(false);
      setSettingsPanel('root');
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

  const handleOpenMediaAuthorization = () => {
    const params = withMinimalPresentation();
    traceClick('drawer', 'settings-media-authorization-press', { params });
    router.push({
      pathname: '/autorizacao-midia',
      params,
    });
    setSettingsOpen(false);
    setSettingsPanel('root');
    closeDrawer();
  };

  const handleOpenIgrejasInstances = () => {
    traceClick('drawer', 'settings-igrejas-instances-press');
    setSettingsOpen(false);
    setSettingsPanel('root');
    closeDrawer();
    void navigateDrawerMenuItem(router, 'menu_igrejas');
  };

  const handleOpenRoomSettings = () => {
    traceClick('drawer', 'settings-room-config-press');
    setSettingsOpen(false);
    setSettingsPanel('root');
    closeDrawer();
    router.push({
      pathname: '/configuracao-salas',
      params: withMinimalPresentation(),
    });
  };

  const handleOpenAvisosSettings = () => {
    traceClick('drawer', 'settings-avisos-press');
    setSettingsOpen(false);
    setSettingsPanel('root');
    closeDrawer();
    void navigateDrawerMenuItem(router, 'event_orchestration');
  };

  const handleOpenBilling = () => {
    traceClick('drawer', 'settings-billing-press');
    setSettingsOpen(false);
    setSettingsPanel('root');
    closeDrawer();
    void navigateDrawerMenuItem(router, 'menu_billing');
  };

  const handleBackdropPress = () => {
    traceClick('drawer', 'backdrop-press', { settingsOpen, settingsPanel });
    if (settingsOpen && settingsPanel !== 'root') {
      setSettingsPanel('root');
      return;
    }
    if (settingsOpen) {
      setSettingsOpen(false);
      return;
    }
    closeDrawer();
  };

  const handleSettingsRequestClose = () => {
    if (settingsPanel !== 'root') {
      setSettingsPanel('root');
      return;
    }
    setSettingsOpen(false);
  };

  const panelTopOffset = insets.top + MINIMAL_TOP_CHROME_MIN_HEIGHT;

  const renderSettingsBranch = () => {
    if (settingsPanel === 'walkie') {
      return (
        <PttWalkieSettingsPanel
          onBack={() => setSettingsPanel('root')}
          canManageUsers={isSuperAdmin}
          onOpenUsers={() => {
            traceClick('drawer', 'settings-walkie-users-press');
            setSettingsPanel('walkie-users');
          }}
        />
      );
    }
    if (settingsPanel === 'walkie-users') {
      return <PttDirectoryAdminPanel onBack={() => setSettingsPanel('walkie')} />;
    }
    return (
      <AppDrawerSettings
        onClose={() => {
          traceClick('drawer', 'settings-close-press');
          setSettingsOpen(false);
          setSettingsPanel('root');
        }}
        onOpenMediaAuthorization={handleOpenMediaAuthorization}
        onOpenBilling={handleOpenBilling}
        onOpenWalkieTalkie={() => {
          traceClick('drawer', 'settings-walkie-press');
          setSettingsPanel('walkie');
        }}
        showRoomSettings={canManageRooms}
        onOpenRoomSettings={handleOpenRoomSettings}
        showAvisosSettings={canManageAvisos}
        onOpenAvisosSettings={handleOpenAvisosSettings}
        showIgrejasInstances={isSuperAdmin}
        onOpenIgrejasInstances={handleOpenIgrejasInstances}
      />
    );
  };

  return (
    <Modal
      animationType="slide"
      transparent
      visible={isOpen}
      onRequestClose={settingsOpen ? handleSettingsRequestClose : closeDrawer}
    >
      <View className="flex-1 flex-col">
        <View className="w-full bg-transparent" style={{ height: panelTopOffset }} pointerEvents="none" />
        <View className="min-h-0 flex-1 flex-row">
          {settingsOpen ? (
            renderSettingsBranch()
          ) : (
            <View
              className="z-[2] max-h-full max-w-[320px] flex-1 flex-col bg-minimal-bg px-4 pt-3"
              style={{ width: '82%' }}
            >
              <View className="mb-3 flex-row items-center justify-between gap-3">
                <Text className="flex-1 text-minimal-title text-minimal-text">Menu</Text>
                <Pressable
                  accessibilityLabel="Abrir configurações"
                  accessibilityRole="button"
                  onPress={() => {
                    traceClick('drawer', 'settings-open-press');
                    setSettingsPanel('root');
                    setSettingsOpen(true);
                  }}
                  className="p-1"
                >
                  <FontAwesome name="cog" size={MINIMAL_ICON.menu - 2} color={MINIMAL_UI.icon} />
                </Pressable>
              </View>
              {loading ? (
                <View className="flex-1 items-center justify-center">
                  <ActivityIndicator color={MINIMAL_UI.icon} />
                </View>
              ) : (
                <ScrollView
                  className="flex-1"
                  contentContainerClassName="pb-2"
                  showsVerticalScrollIndicator
                  keyboardShouldPersistTaps="handled"
                >
                  {visibleItems.map((item) => (
                    <TouchableOpacity
                      key={item.moduleKey}
                      className={cn(
                        'min-h-12 justify-center py-3',
                        item.pendingRoute && 'opacity-70',
                      )}
                      onPress={() => handlePress(item)}
                      disabled={item.pendingRoute}
                      accessibilityState={{ disabled: item.pendingRoute }}
                    >
                      <Text
                        className={cn(
                          'text-left text-minimal-menu text-minimal-text',
                          item.pendingRoute && 'text-minimal-muted',
                        )}
                      >
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
              <MinimalExitBar variant="drawer" />
            </View>
          )}
          <Pressable
            className="flex-1 bg-black/25"
            onPress={handleBackdropPress}
            accessibilityLabel="Fechar menu"
          />
        </View>
      </View>
    </Modal>
  );
}

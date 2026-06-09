import { ACCESS_SCREEN, sessionHasAccess } from '@/lib/accessControl';
import { EXIT_SESSION_UI } from '@/lib/sessionExitUi';
import { signOutAndReturnToLogin } from '@/lib/userSession';
import {
  APP_PARAMETER,
  isAppParameterNo,
  resolveQrTotemIndexShortcutVisible,
} from '@/lib/checkInVisibility';
import { getAppParameterValue } from '@/lib/appParameters';
import { resolveFamilyIdForPhone } from '@/lib/family';
import { ActiveScreenBadge } from '@/components/ui/ActiveScreenBadge';
import {
  buildDashboardPanelCardSizeStyle,
  computeEventPanelCardHeight,
  computePanelCardTopPadding,
  computeResponsiveCardInsets,
} from '@/lib/dashboardPanelLayout';
import {
  INDEX_SHORTCUT_ICONS,
  resolveIndexShortcutDisabledHint,
  resolveIndexShortcutIconColor,
} from '@/lib/indexShortcutHints';
import { loadSessionProfile } from '@/lib/loadSessionProfile';
import { getStoredUserPhone } from '@/lib/userSession';
import { useDashboardSelectedEvent } from '@/hooks/useDashboardSelectedEvent';
import { useFamilyPreCheckin } from '@/hooks/useFamilyPreCheckin';
import { FontAwesome } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const INDEX_PANEL_INSETS = computeResponsiveCardInsets(SCREEN_WIDTH);

type DashboardShortcut = {
  id: string;
  label: string;
  dashboardCard: string;
  parentId?: string;
  disabled?: boolean;
  disabledHint?: string | null;
};

const DASHBOARD_SHORTCUTS_BASE: DashboardShortcut[] = [
  { id: 'agenda', label: 'Painel de Eventos', dashboardCard: '1' },
  { id: 'salas', label: 'Sala(s)', dashboardCard: '4', parentId: 'agenda' },
  { id: 'qr-totem', label: 'QR Code — Check-in Totem', dashboardCard: 'qr', parentId: 'agenda' },
  { id: 'ofertas', label: 'Dízimos e Ofertas', dashboardCard: '3' },
  { id: 'pastoral', label: 'Coração Aberto', dashboardCard: '5' },
  { id: 'membros', label: 'Lista de Membros', dashboardCard: '10' },
  { id: 'aniversariantes', label: 'Aniversariantes', dashboardCard: '7' },
  { id: 'financeiro', label: 'Financeiro', dashboardCard: '11' },
  { id: 'escalas', label: 'Escalas', dashboardCard: '8' },
  { id: 'menu', label: 'Dados Cadastrais', dashboardCard: '6' },
];

type DashboardShortcutGroup = {
  parent: DashboardShortcut;
  children: DashboardShortcut[];
};

const buildShortcutGroups = (items: DashboardShortcut[]): DashboardShortcutGroup[] => {
  const groups: DashboardShortcutGroup[] = [];

  for (let index = 0; index < items.length; index += 1) {
    const parent = items[index];
    if (parent.parentId) {
      continue;
    }

    const children: DashboardShortcut[] = [];
    let childIndex = index + 1;
    while (childIndex < items.length && items[childIndex].parentId === parent.id) {
      children.push(items[childIndex]);
      childIndex += 1;
    }

    groups.push({ parent, children });
    index = childIndex - 1;
  }

  return groups;
};

const formatDisplayName = (fullName: string) => {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);

  if (parts.length <= 1) {
    return parts[0] ?? fullName;
  }

  return `${parts[0]} ${parts[parts.length - 1]}`;
};

export default function DashboardIndexScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { events: activeEvents, selectedEvent } = useDashboardSelectedEvent({ enablePolling: false });
  const hasAvailableEvents = activeEvents.length > 0;
  const [qrCodeAtivoEnabled, setQrCodeAtivoEnabled] = useState(true);
  const [checkInManualMode, setCheckInManualMode] = useState(false);
  const [isFooterSettingsPressed, setIsFooterSettingsPressed] = useState(false);
  const [canViewMaintenance, setCanViewMaintenance] = useState(false);
  const [isMaintenanceAccessLoading, setIsMaintenanceAccessLoading] = useState(true);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [headerUserName, setHeaderUserName] = useState('Usuário');

  useEffect(() => {
    void (async () => {
      const phone = await getStoredUserPhone();
      if (!phone) {
        setFamilyId(null);
        return;
      }

      const resolved = await resolveFamilyIdForPhone(phone);
      setFamilyId(resolved);
    })();
  }, []);

  const { hasPreCheckin, hasTotemCheckinConfirmed, refetch: refetchPreCheckin } = useFamilyPreCheckin(
    selectedEvent?.id,
    familyId ?? undefined,
    selectedEvent
  );

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const [qrCodeValue, checkInAutomaticoValue] = await Promise.all([
          getAppParameterValue(APP_PARAMETER.QR_CODE_ATIVO),
          getAppParameterValue(APP_PARAMETER.CHECK_IN_AUTOMATICO),
        ]);

        if (!active) {
          return;
        }

        setQrCodeAtivoEnabled(!isAppParameterNo(qrCodeValue));
        setCheckInManualMode(isAppParameterNo(checkInAutomaticoValue));
      } catch (error) {
        console.error('Erro ao carregar parâmetros do check-in no índice:', error);
        if (!active) {
          return;
        }
        setQrCodeAtivoEnabled(true);
        setCheckInManualMode(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const isQrCheckInShortcutVisible = useMemo(
    () =>
      resolveQrTotemIndexShortcutVisible({
        event: selectedEvent,
        qrCodeAtivoEnabled,
        checkInManualMode,
        hasFamilyPreCheckin: hasPreCheckin,
        hasFamilyTotemCheckin: hasTotemCheckinConfirmed,
      }),
    [checkInManualMode, hasPreCheckin, hasTotemCheckinConfirmed, qrCodeAtivoEnabled, selectedEvent]
  );

  useFocusEffect(
    useCallback(() => {
      void refetchPreCheckin({ silent: true });
    }, [refetchPreCheckin])
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;

      void (async () => {
        const phone = await getStoredUserPhone();
        if (!active || !phone) {
          return;
        }

        const sessionProfile = await loadSessionProfile(phone);
        if (!active) {
          return;
        }

        const profileName = sessionProfile?.full_name?.trim();
        if (profileName) {
          setHeaderUserName(formatDisplayName(profileName));
        }
      })();

      return () => {
        active = false;
      };
    }, [])
  );

  const shortcutHintContext = useMemo(
    () => ({
      selectedEvent,
      hasAvailableEvents,
      qrCodeAtivoEnabled,
      checkInManualMode,
      hasPreCheckin,
      hasTotemCheckinConfirmed,
    }),
    [
      checkInManualMode,
      hasAvailableEvents,
      hasPreCheckin,
      hasTotemCheckinConfirmed,
      qrCodeAtivoEnabled,
      selectedEvent,
    ]
  );

  const shortcuts = useMemo(
    () =>
      DASHBOARD_SHORTCUTS_BASE.map((shortcut) => {
        const disabledHint = resolveIndexShortcutDisabledHint(shortcut.id, shortcutHintContext);
        const disabled =
          shortcut.id === 'qr-totem'
            ? !isQrCheckInShortcutVisible
            : shortcut.id === 'salas'
              ? !hasAvailableEvents
              : Boolean(disabledHint);

        return {
          ...shortcut,
          disabled,
          disabledHint: disabled ? disabledHint : null,
        };
      }),
    [hasAvailableEvents, isQrCheckInShortcutVisible, shortcutHintContext]
  );

  const shortcutGroups = useMemo(() => buildShortcutGroups(shortcuts), [shortcuts]);

  const indexCardHeight = useMemo(
    () => computeEventPanelCardHeight(SCREEN_HEIGHT, insets.top, insets.bottom),
    [insets.bottom, insets.top]
  );

  const indexCardTopPadding = useMemo(
    () => computePanelCardTopPadding(SCREEN_HEIGHT, insets.top, insets.bottom, indexCardHeight),
    [indexCardHeight, insets.bottom, insets.top]
  );

  const indexPanelCardSizeStyle = useMemo(
    () => buildDashboardPanelCardSizeStyle(SCREEN_WIDTH, indexCardHeight),
    [indexCardHeight]
  );

  const handleOpenShortcut = (shortcut: DashboardShortcut) => {
    if (shortcut.disabled) {
      return;
    }

    router.push({
      pathname: '/(tabs)/dashboard',
      params: { dashboardCard: shortcut.dashboardCard },
    });
  };

  const loadMaintenanceAccess = useCallback(async () => {
    setIsMaintenanceAccessLoading(true);
    try {
      const allowed = await sessionHasAccess('screen', ACCESS_SCREEN.maintenance, 'view');
      setCanViewMaintenance(allowed);
    } catch (error) {
      console.error('Erro ao verificar acesso à manutenção no índice:', error);
      setCanViewMaintenance(false);
    } finally {
      setIsMaintenanceAccessLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMaintenanceAccess();
  }, [loadMaintenanceAccess]);

  useFocusEffect(
    useCallback(() => {
      void loadMaintenanceAccess();
      return () => {
        setIsFooterSettingsPressed(false);
      };
    }, [loadMaintenanceAccess])
  );

  const handleFooterSettingsPress = useCallback(() => {
    if (isFooterSettingsPressed) {
      setIsFooterSettingsPressed(false);
      return;
    }

    if (!canViewMaintenance) {
      Alert.alert(
        'Sem permissão',
        'Você não tem acesso à manutenção do sistema. Fale com um administrador se precisar deste acesso.'
      );
      return;
    }

    setIsFooterSettingsPressed(true);
    router.push('/maintenance-dashboard');
  }, [canViewMaintenance, isFooterSettingsPressed, router]);

  const handleExitApp = useCallback(() => {
    signOutAndReturnToLogin();
  }, []);

  const renderShortcutButton = (shortcut: DashboardShortcut, options?: { isChild?: boolean }) => {
    const isChild = options?.isChild === true;
    const parentLabel =
      shortcut.parentId === 'agenda' ? DASHBOARD_SHORTCUTS_BASE.find((item) => item.id === 'agenda')?.label : null;
    const iconName = INDEX_SHORTCUT_ICONS[shortcut.id as keyof typeof INDEX_SHORTCUT_ICONS];
    const iconColor = resolveIndexShortcutIconColor(shortcut.id, shortcut.disabled);

    return (
      <TouchableOpacity
        key={shortcut.id}
        style={[
          styles.menuShortcutButton,
          isChild && styles.menuShortcutChildButton,
          shortcut.disabled && styles.menuShortcutButtonDisabled,
        ]}
        onPress={() => handleOpenShortcut(shortcut)}
        disabled={shortcut.disabled}
        activeOpacity={0.9}
        hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
        accessibilityRole="button"
        accessibilityLabel={
          parentLabel ? `${shortcut.label}, subitem de ${parentLabel}` : shortcut.label
        }
        accessibilityHint={shortcut.disabledHint ?? undefined}
      >
        {isChild ? (
          <View style={styles.menuShortcutChildRow}>
            <Text style={styles.menuShortcutChildMarker}>›</Text>
            {iconName ? (
              <FontAwesome
                name={iconName}
                size={14}
                color={iconColor}
                style={styles.menuShortcutIcon}
              />
            ) : null}
            <View style={styles.menuShortcutTextBlock}>
              <Text
                style={[
                  styles.menuShortcutButtonText,
                  styles.menuShortcutChildButtonText,
                  shortcut.disabled && styles.menuShortcutButtonTextDisabled,
                ]}
                numberOfLines={2}
              >
                {shortcut.label}
              </Text>
              {shortcut.disabled && shortcut.disabledHint ? (
                <Text style={styles.menuShortcutHintText} numberOfLines={2}>
                  {shortcut.disabledHint}
                </Text>
              ) : null}
            </View>
          </View>
        ) : (
          <View style={styles.menuShortcutParentRow}>
            {iconName ? (
              <FontAwesome
                name={iconName}
                size={16}
                color={iconColor}
                style={styles.menuShortcutIcon}
              />
            ) : null}
            <View style={styles.menuShortcutTextBlock}>
              <Text
                style={[
                  styles.menuShortcutButtonText,
                  shortcut.disabled && styles.menuShortcutButtonTextDisabled,
                ]}
                numberOfLines={2}
              >
                {shortcut.label}
              </Text>
              {shortcut.disabled && shortcut.disabledHint ? (
                <Text style={styles.menuShortcutHintText} numberOfLines={2}>
                  {shortcut.disabledHint}
                </Text>
              ) : null}
            </View>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <LinearGradient colors={['#1e1b4b', '#0f172a']} style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.header}>
          <View style={styles.welcomeBox}>
            <Text style={styles.welcomeText}>Boas-Vindas,</Text>
            <View style={styles.welcomeNameRow}>
              <Text numberOfLines={1} style={styles.userName}>
                {headerUserName}
              </Text>
              <ActiveScreenBadge title="Índice do Aplicativo" accent="emerald" />
            </View>
          </View>
        </View>

        <View style={[styles.indexCardWrapper, { paddingTop: indexCardTopPadding }]}>
          <View style={[styles.indexPanelCard, indexPanelCardSizeStyle]}>
            <View style={styles.indexPanel}>
              <View style={styles.indexPanelHeaderRow}>
                <Text numberOfLines={1} style={styles.indexPanelTitle}>
                  Índice do Aplicativo
                </Text>
                <Text numberOfLines={2} style={styles.indexPanelSubtitle}>
                  Selecione a tela que deseja abrir
                </Text>
              </View>
              <ScrollView
                style={styles.indexShortcutsScroll}
                contentContainerStyle={styles.indexShortcutsArea}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {shortcutGroups.map((group) => (
                  <View key={group.parent.id} style={styles.shortcutGroup}>
                    {renderShortcutButton(group.parent)}
                    {group.children.length > 0 ? (
                      <View style={styles.shortcutSubgroup}>
                        <View style={styles.shortcutSubgroupRail} />
                        <View style={styles.shortcutSubgroupList}>
                          {group.children.map((child) => renderShortcutButton(child, { isChild: true }))}
                        </View>
                      </View>
                    ) : null}
                  </View>
                ))}
              </ScrollView>
            </View>
          </View>
        </View>

        <View style={styles.footerRow}>
          <TouchableOpacity
            style={styles.exitButton}
            onPress={handleExitApp}
            activeOpacity={0.9}
            accessibilityRole="button"
            accessibilityLabel={EXIT_SESSION_UI.accessibilityLabel}
            accessibilityHint={EXIT_SESSION_UI.accessibilityHint}
            accessibilityState={{ disabled: false, busy: false }}
          >
            <Text style={styles.exitButtonText}>
              {EXIT_SESSION_UI.button}
            </Text>
          </TouchableOpacity>
          {!isMaintenanceAccessLoading && canViewMaintenance ? (
            <TouchableOpacity
              style={[
                styles.footerSettingsButton,
                isFooterSettingsPressed && styles.footerSettingsButtonPressed,
              ]}
              onPress={handleFooterSettingsPress}
              activeOpacity={1}
              accessibilityLabel="Configurações"
              accessibilityState={{ selected: isFooterSettingsPressed }}
            >
              <FontAwesome
                name="cog"
                size={22}
                color={isFooterSettingsPressed ? '#FECACA' : '#64748B'}
              />
            </TouchableOpacity>
          ) : null}
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexShrink: 0,
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 8,
  },
  welcomeBox: {
    width: '100%',
    borderRadius: 18,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 4,
  },
  welcomeText: {
    color: '#94A3B8',
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  welcomeNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  userName: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: '800',
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  activeScreenTitle: {
    flexShrink: 0,
    maxWidth: '46%',
    color: '#6EE7B7',
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'right',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    lineHeight: 14,
  },
  indexCardWrapper: {
    flex: 1,
    minHeight: 0,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingBottom: 8,
  },
  indexPanelCard: {
    borderRadius: INDEX_PANEL_INSETS.borderRadius,
    borderWidth: 1,
    borderColor: 'rgba(165, 180, 252, 0.55)',
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    overflow: 'hidden',
    padding: Math.max(14, INDEX_PANEL_INSETS.padding - 18),
  },
  indexPanel: {
    flex: 1,
    minHeight: 0,
    gap: 6,
  },
  indexPanelHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 4,
  },
  indexPanelTitle: {
    color: '#F8FAFC',
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 22,
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    textAlign: 'left',
  },
  indexPanelSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 16,
    flexShrink: 0,
    maxWidth: '48%',
    textAlign: 'right',
  },
  indexShortcutsScroll: {
    flex: 1,
    minHeight: 0,
  },
  indexShortcutsArea: {
    flexGrow: 1,
    gap: 8,
    paddingVertical: 4,
  },
  shortcutGroup: {
    gap: 4,
  },
  shortcutSubgroup: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingLeft: 12,
    marginTop: 2,
    marginBottom: 2,
    gap: 10,
  },
  shortcutSubgroupRail: {
    width: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(100, 116, 139, 0.55)',
  },
  shortcutSubgroupList: {
    flex: 1,
    gap: 8,
  },
  menuShortcutButton: {
    flexGrow: 0,
    flexShrink: 0,
    alignSelf: 'stretch',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingVertical: 8,
    paddingRight: 12,
    paddingLeft: 0,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  menuShortcutChildButton: {
    borderColor: '#475569',
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    paddingVertical: 6,
  },
  menuShortcutButtonDisabled: {
    opacity: 0.45,
  },
  menuShortcutParentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingLeft: 12,
    paddingRight: 4,
    width: '100%',
  },
  menuShortcutIcon: {
    marginTop: 2,
    flexShrink: 0,
  },
  menuShortcutTextBlock: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  menuShortcutHintText: {
    color: '#94A3B8',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '500',
  },
  menuShortcutButtonText: {
    color: '#E2E8F0',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 19,
    textAlign: 'left',
  },
  menuShortcutChildRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    alignSelf: 'stretch',
    gap: 6,
    paddingLeft: 4,
    paddingRight: 4,
    width: '100%',
  },
  menuShortcutChildMarker: {
    width: 20,
    marginLeft: 4,
    color: '#64748B',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 19,
    textAlign: 'center',
  },
  menuShortcutChildButtonText: {
    fontSize: 14,
    lineHeight: 18,
    color: '#CBD5E1',
  },
  menuShortcutButtonTextDisabled: {
    color: '#94A3B8',
  },
  footerRow: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 6,
    paddingHorizontal: 24,
    paddingBottom: 10,
    zIndex: 2,
  },
  exitButton: {
    flexShrink: 0,
    flexGrow: 0,
    minWidth: 160,
    maxWidth: 240,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 0,
    paddingHorizontal: 16,
  },
  footerSettingsButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    backgroundColor: 'rgba(148, 163, 184, 0.12)',
    borderColor: '#475569',
  },
  footerSettingsButtonPressed: {
    backgroundColor: 'rgba(239, 68, 68, 0.28)',
    borderColor: '#EF4444',
  },
  exitButtonDisabled: {
    opacity: 0.7,
  },
  exitButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});

import { MINIMAL_ICON, MINIMAL_TYPO, MINIMAL_UI } from '@/lib/minimalUiTheme';
import { traceClick } from '@/lib/devClickTrace';
import { FontAwesome } from '@expo/vector-icons';
import React from 'react';
import {
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
  onOpenMediaAuthorization: () => void;
  onOpenWalkieTalkie?: () => void;
  onOpenBilling?: () => void;
  /** Líder / admin — nomes e atribuição de salas. */
  showRoomSettings?: boolean;
  onOpenRoomSettings?: () => void;
  /** Orquestrador — cadastro e publicação de avisos. */
  showAvisosSettings?: boolean;
  onOpenAvisosSettings?: () => void;
  /** Apenas super_admin — gestão multi-instância. */
  showIgrejasInstances?: boolean;
  onOpenIgrejasInstances?: () => void;
};

export function AppDrawerSettings({
  onClose,
  onOpenMediaAuthorization,
  onOpenWalkieTalkie,
  onOpenBilling,
  showRoomSettings = false,
  onOpenRoomSettings,
  showAvisosSettings = false,
  onOpenAvisosSettings,
  showIgrejasInstances = false,
  onOpenIgrejasInstances,
}: Props) {
  const insets = useSafeAreaInsets();

  const items: SettingsItem[] = [
    ...(onOpenWalkieTalkie
      ? [
          {
            id: 'walkie-talkie',
            label: 'Walkie-Talkie',
            icon: 'microphone' as const,
            onPress: onOpenWalkieTalkie,
          } satisfies SettingsItem,
        ]
      : []),
    ...(onOpenBilling
      ? [
          {
            id: 'billing',
            label: 'Assinaturas',
            hint: 'Planos e cobrança da igreja',
            icon: 'credit-card' as const,
            onPress: onOpenBilling,
          } satisfies SettingsItem,
        ]
      : []),
    {
      id: 'media-authorization',
      label: 'Autorização de imagem e voz',
      hint: 'Termos LGPD e confirmação por e-mail',
      icon: 'shield',
      onPress: onOpenMediaAuthorization,
    },
    ...(showRoomSettings && onOpenRoomSettings
      ? [
          {
            id: 'room-settings',
            label: 'Configuração de salas',
            hint: 'Nomes afetivos e atribuição de membros',
            icon: 'home' as const,
            onPress: onOpenRoomSettings,
          } satisfies SettingsItem,
        ]
      : []),
    ...(showAvisosSettings && onOpenAvisosSettings
      ? [
          {
            id: 'avisos-settings',
            label: 'Manutenção de Avisos',
            hint: 'Cadastre e publique comunicados da home',
            icon: 'bullhorn' as const,
            onPress: onOpenAvisosSettings,
          } satisfies SettingsItem,
        ]
      : []),
  ];

  const igrejasItem: SettingsItem | null =
    showIgrejasInstances && onOpenIgrejasInstances
      ? {
          id: 'igrejas-instances',
          label: 'Instâncias (Igrejas)',
          hint: 'Criar e alternar ambientes de igreja',
          icon: 'building',
          onPress: onOpenIgrejasInstances,
        }
      : null;

  const renderItem = (item: SettingsItem, pinned = false) => (
    <TouchableOpacity
      key={item.id}
      style={[styles.item, pinned && styles.itemPinned]}
      onPress={() => {
        traceClick('drawer-settings', 'item-press', { id: item.id, label: item.label });
        item.onPress();
      }}
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
  );

  return (
    <View style={[styles.panel, { paddingBottom: Math.max(insets.bottom, 12) }]}>
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
        {items.map((item) => renderItem(item))}
      </ScrollView>

      {igrejasItem ? (
        <View style={styles.pinnedFooter}>{renderItem(igrejasItem, true)}</View>
      ) : null}
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
    paddingTop: 12,
    zIndex: 2,
    flexDirection: 'column',
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
    minHeight: 0,
  },
  scrollContent: {
    paddingBottom: 8,
    gap: 4,
    flexGrow: 1,
  },
  pinnedFooter: {
    flexShrink: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: MINIMAL_UI.divider,
    paddingTop: 4,
    backgroundColor: MINIMAL_UI.background,
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
  itemPinned: {
    borderBottomWidth: 0,
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

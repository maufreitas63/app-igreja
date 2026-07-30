import { MINIMAL_ICON, MINIMAL_TYPO, MINIMAL_UI } from '@/lib/minimalUiTheme';
import { traceClick } from '@/lib/devClickTrace';
import { FontAwesome } from '@expo/vector-icons';
import React, { useState } from 'react';
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
  onOpenBilling?: () => void;
  /** Líder / admin — nomes e atribuição de salas. */
  showRoomSettings?: boolean;
  onOpenRoomSettings?: () => void;
  /** Orquestrador — cadastro e publicação de avisos. */
  showAvisosSettings?: boolean;
  onOpenAvisosSettings?: () => void;
  /** Pastoral / líderes — manutenção da Trilha. */
  showDiscipleshipSettings?: boolean;
  onOpenDiscipleshipThemes?: () => void;
  onOpenDiscipleshipSettings?: () => void;
  /** Super admin — resetar progresso de um usuário. */
  showDiscipleshipReset?: boolean;
  onOpenDiscipleshipReset?: () => void;
  /** Apenas super_admin — gestão multi-instância. */
  showIgrejasInstances?: boolean;
  onOpenIgrejasInstances?: () => void;
};

export function AppDrawerSettings({
  onClose,
  onOpenMediaAuthorization,
  onOpenBilling,
  showRoomSettings = false,
  onOpenRoomSettings,
  showAvisosSettings = false,
  onOpenAvisosSettings,
  showDiscipleshipSettings = false,
  onOpenDiscipleshipThemes,
  onOpenDiscipleshipSettings,
  showDiscipleshipReset = false,
  onOpenDiscipleshipReset,
  showIgrejasInstances = false,
  onOpenIgrejasInstances,
}: Props) {
  const insets = useSafeAreaInsets();
  const [trailMenuOpen, setTrailMenuOpen] = useState(false);

  const trailSubItems: SettingsItem[] = [
    ...(showDiscipleshipSettings && onOpenDiscipleshipThemes
      ? [
          {
            id: 'discipleship-themes',
            label: 'Temas da Trilha',
            hint: 'Textos, vídeos e reflexões dos passos',
            icon: 'book' as const,
            onPress: onOpenDiscipleshipThemes,
          } satisfies SettingsItem,
        ]
      : []),
    ...(showDiscipleshipSettings && onOpenDiscipleshipSettings
      ? [
          {
            id: 'discipleship-settings',
            label: 'Trilha — Reconhecimentos',
            hint: 'Alunos 100% prontos para certificado',
            icon: 'graduation-cap' as const,
            onPress: onOpenDiscipleshipSettings,
          } satisfies SettingsItem,
        ]
      : []),
    ...(showDiscipleshipReset && onOpenDiscipleshipReset
      ? [
          {
            id: 'discipleship-reset',
            label: 'Resetar Trilha',
            hint: 'Reiniciar progresso de um usuário nesta igreja',
            icon: 'refresh' as const,
            onPress: onOpenDiscipleshipReset,
          } satisfies SettingsItem,
        ]
      : []),
  ];

  const showTrailGroup = trailSubItems.length > 0;

  const items: SettingsItem[] = [
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

  const renderItem = (item: SettingsItem, pinned = false, nested = false) => (
    <TouchableOpacity
      key={item.id}
      style={[styles.item, pinned && styles.itemPinned, nested && styles.itemNested]}
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

        {showTrailGroup ? (
          <View>
            <TouchableOpacity
              style={styles.item}
              onPress={() => {
                traceClick('drawer-settings', 'trail-group-toggle', { open: !trailMenuOpen });
                setTrailMenuOpen((open) => !open);
              }}
              accessibilityRole="button"
              accessibilityState={{ expanded: trailMenuOpen }}
              accessibilityLabel="Manutenção da Trilha"
            >
              <View style={styles.itemIconWrap}>
                <FontAwesome name="graduation-cap" size={MINIMAL_ICON.action} color={MINIMAL_UI.icon} />
              </View>
              <View style={styles.itemCopy}>
                <Text style={styles.itemLabel}>Manutenção da Trilha</Text>
                <Text style={styles.itemHint}>Temas, reconhecimentos e reset</Text>
              </View>
              <FontAwesome
                name={trailMenuOpen ? 'chevron-down' : 'chevron-right'}
                size={12}
                color={MINIMAL_UI.textMuted}
              />
            </TouchableOpacity>

            {trailMenuOpen
              ? trailSubItems.map((item) => renderItem(item, false, true))
              : null}
          </View>
        ) : null}
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
  itemNested: {
    paddingLeft: 16,
    backgroundColor: MINIMAL_UI.rowHover,
    minHeight: 52,
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

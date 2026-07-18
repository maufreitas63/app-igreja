import { MINIMAL_ICON, MINIMAL_UI } from '@/lib/minimalUiTheme';
import { traceClick } from '@/lib/devClickTrace';
import { cn } from '@/lib/utils';
import { FontAwesome } from '@expo/vector-icons';
import React from 'react';
import {
  Pressable,
  ScrollView,
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
      className={cn(
        'min-h-14 flex-row items-center gap-3 border-b border-minimal-divider py-2.5',
        pinned && 'border-b-0',
      )}
      onPress={() => {
        traceClick('drawer-settings', 'item-press', { id: item.id, label: item.label });
        item.onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={item.label}
    >
      <View className="w-7 items-center">
        <FontAwesome name={item.icon} size={MINIMAL_ICON.action} color={MINIMAL_UI.icon} />
      </View>
      <View className="min-w-0 flex-1 gap-0.5">
        <Text className="text-minimal-menu font-semibold text-minimal-text">{item.label}</Text>
        {item.hint ? (
          <Text className="text-xs leading-4 text-minimal-muted">{item.hint}</Text>
        ) : null}
      </View>
      <FontAwesome name="chevron-right" size={12} color={MINIMAL_UI.textMuted} />
    </TouchableOpacity>
  );

  return (
    <View
      className="z-[2] h-full max-w-[320px] flex-col bg-minimal-bg px-4 pt-3"
      style={{ width: '82%', paddingBottom: Math.max(insets.bottom, 12) }}
    >
      <View className="mb-3 flex-row items-center justify-between gap-3">
        <Text className="flex-1 text-minimal-title text-minimal-text">Configurações</Text>
        <Pressable
          accessibilityLabel="Fechar configurações"
          accessibilityRole="button"
          onPress={onClose}
          className="p-1"
        >
          <FontAwesome name="times" size={MINIMAL_ICON.action + 4} color={MINIMAL_UI.icon} />
        </Pressable>
      </View>

      <ScrollView
        className="min-h-0 flex-1"
        contentContainerClassName="flex-grow gap-1 pb-2"
        showsVerticalScrollIndicator
        keyboardShouldPersistTaps="handled"
      >
        {items.map((item) => renderItem(item))}
      </ScrollView>

      {igrejasItem ? (
        <View className="flex-shrink-0 border-t border-minimal-divider bg-minimal-bg pt-1">
          {renderItem(igrejasItem, true)}
        </View>
      ) : null}
    </View>
  );
}

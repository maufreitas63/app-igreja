import { useMinimalHome } from '@/context/MinimalHomeContext';
import { ACCESS_SCREEN } from '@/lib/accessControl';
import { DRAWER_OFFERINGS_RESOURCE } from '@/lib/drawerMenuAccess';
import { navigateWithScreenAccess } from '@/lib/dashboardScreenNavigation';
import { withMinimalPresentation } from '@/lib/dashboardReturnNavigation';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type EuQueroItemProps = {
  icon: React.ComponentProps<typeof FontAwesome>['name'];
  title: string;
  subtitle: string;
  onPress: () => void;
};

function EuQueroItem({ icon, title, subtitle, onPress }: EuQueroItemProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      className="flex-row items-center gap-3.5 rounded-lg px-0 py-2.5 active:bg-minimal-hover hover:bg-minimal-hover"
    >
      <View className="w-10 items-center justify-center">
        <FontAwesome name={icon} size={28} color={MINIMAL_UI.accent} />
      </View>
      <View className="min-w-0 flex-1 gap-0.5">
        <Text className="text-[15px] font-semibold text-minimal-text">{title}</Text>
        <Text className="text-[13px] leading-[18px] text-minimal-muted">{subtitle}</Text>
      </View>
      <FontAwesome name="chevron-right" size={16} color={MINIMAL_UI.textMuted} style={{ marginLeft: 4 }} />
    </Pressable>
  );
}

export function MinimalEuQueroFooter() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { homeAgendaOpen } = useMinimalHome();

  if (homeAgendaOpen) {
    return null;
  }

  const handleOpenOfferings = () => {
    void navigateWithScreenAccess(
      router,
      '/ofertas',
      DRAWER_OFFERINGS_RESOURCE,
      withMinimalPresentation(),
      { deniedMessage: 'Você não tem permissão para abrir Dízimos e Ofertas.' }
    );
  };

  const handleOpenPastoral = () => {
    void navigateWithScreenAccess(
      router,
      '/pastoral',
      ACCESS_SCREEN.pastoral,
      withMinimalPresentation()
    );
  };

  return (
    <View
      className="w-full gap-3 self-stretch bg-minimal-bg pt-2"
      style={{ paddingBottom: Math.max(insets.bottom, 8) }}
    >
      <Text className="text-lg font-bold italic text-minimal-text">Eu quero…</Text>
      <View className="gap-1">
        <EuQueroItem
          icon="money"
          title="Contribuir com meu Dízimo ou Oferta"
          subtitle="Copie a chave PIX e contribua com a igreja."
          onPress={handleOpenOfferings}
        />
        <EuQueroItem
          icon="heart"
          title="Fazer um pedido de Oração"
          subtitle="Compartilhe seu pedido com a equipe pastoral."
          onPress={handleOpenPastoral}
        />
      </View>
    </View>
  );
}

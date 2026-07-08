import { useMinimalHome } from '@/context/MinimalHomeContext';
import { ACCESS_SCREEN } from '@/lib/accessControl';
import { navigateWithScreenAccess } from '@/lib/dashboardScreenNavigation';
import { withMinimalPresentation } from '@/lib/dashboardReturnNavigation';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
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
      style={({ pressed, hovered }) => [
        styles.item,
        (pressed || (Platform.OS === 'web' && hovered)) && styles.itemPressed,
      ]}
    >
      <View style={styles.iconWrap}>
        <FontAwesome name={icon} size={28} color={MINIMAL_UI.accent} />
      </View>
      <View style={styles.textBlock}>
        <Text style={styles.itemTitle}>{title}</Text>
        <Text style={styles.itemSubtitle}>{subtitle}</Text>
      </View>
      <FontAwesome name="chevron-right" size={16} color={MINIMAL_UI.textMuted} style={styles.chevron} />
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
    router.push({
      pathname: '/ofertas',
      params: withMinimalPresentation(),
    });
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
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <Text style={styles.heading}>Eu quero…</Text>
      <View style={styles.list}>
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

const styles = StyleSheet.create({
  wrap: {
    gap: 12,
    paddingTop: 12,
    backgroundColor: MINIMAL_UI.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: MINIMAL_UI.divider,
    width: '100%',
    alignSelf: 'stretch',
  },
  heading: {
    fontSize: 18,
    fontWeight: '700',
    fontStyle: 'italic',
    color: MINIMAL_UI.text,
  },
  list: {
    gap: 4,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 10,
    paddingHorizontal: 0,
    borderRadius: 8,
  },
  itemPressed: {
    backgroundColor: MINIMAL_UI.rowHover,
  },
  iconWrap: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: MINIMAL_UI.text,
  },
  itemSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: MINIMAL_UI.textMuted,
  },
  chevron: {
    marginLeft: 4,
  },
});

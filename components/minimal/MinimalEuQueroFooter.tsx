import { useMinimalHome } from '@/context/MinimalHomeContext';
import { ACCESS_SCREEN } from '@/lib/accessControl';
import { fetchActiveCampaignProjects } from '@/lib/campaignProjectsApi';
import { withReturnRoute } from '@/lib/dashboardReturnNavigation';
import { ensureScreenAccess, navigateWithScreenAccess } from '@/lib/dashboardScreenNavigation';
import { DRAWER_OFFERINGS_RESOURCE } from '@/lib/drawerMenuAccess';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

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
  const openingCampaignRef = useRef(false);
  const [contributeOpen, setContributeOpen] = useState(false);

  if (homeAgendaOpen) {
    return null;
  }

  const handleOpenOfferings = () => {
    void navigateWithScreenAccess(
      router,
      '/ofertas',
      DRAWER_OFFERINGS_RESOURCE,
      withReturnRoute('/(tabs)'),
      { deniedMessage: 'Você não tem permissão para abrir Dízimos e Ofertas.' }
    );
  };

  const handleOpenCampaign = () => {
    if (openingCampaignRef.current) {
      return;
    }

    openingCampaignRef.current = true;

    void (async () => {
      try {
        const allowed = await ensureScreenAccess(
          DRAWER_OFFERINGS_RESOURCE,
          'Você não tem permissão para contribuir.'
        );

        if (!allowed) {
          return;
        }

        const campaigns = await fetchActiveCampaignProjects();

        if (campaigns.length === 0) {
          Toast.show({
            type: 'info',
            text1: 'Campanhas e projetos',
            text2: 'Nenhuma campanha ativa no momento.',
          });
          return;
        }

        const params =
          campaigns.length === 1
            ? withReturnRoute('/(tabs)', { campaignId: campaigns[0].id })
            : withReturnRoute('/(tabs)', { campaignContribute: '1' });

        router.push({ pathname: '/ofertas', params });
      } catch (error) {
        Toast.show({
          type: 'error',
          text1: 'Campanhas e projetos',
          text2: error instanceof Error ? error.message : 'Não foi possível abrir as campanhas.',
        });
      } finally {
        openingCampaignRef.current = false;
      }
    })();
  };

  const handleOpenPastoral = () => {
    void navigateWithScreenAccess(
      router,
      '/pastoral',
      ACCESS_SCREEN.pastoral,
      withReturnRoute('/(tabs)')
    );
  };

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <Text style={styles.heading}>Eu quero…</Text>
      <View style={styles.list}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Contribuir"
          accessibilityState={{ expanded: contributeOpen }}
          onPress={() => setContributeOpen((open) => !open)}
          style={({ pressed, hovered }) => [
            styles.item,
            (pressed || (Platform.OS === 'web' && hovered)) && styles.itemPressed,
          ]}
        >
          <View style={styles.iconWrap}>
            <FontAwesome name="gift" size={28} color={MINIMAL_UI.accent} />
          </View>
          <View style={styles.textBlock}>
            <Text style={styles.itemTitle}>Contribuir</Text>
            <Text style={styles.itemSubtitle}>Dízimos, Ofertas, Campanhas ou Projetos.</Text>
          </View>
          <FontAwesome
            name={contributeOpen ? 'chevron-down' : 'chevron-right'}
            size={16}
            color={MINIMAL_UI.textMuted}
            style={styles.chevron}
          />
        </Pressable>
        {contributeOpen ? (
          <View style={styles.contributeOptions}>
            <EuQueroItem
              icon="money"
              title="Dízimos e Ofertas"
              subtitle="Informe o valor, com centavos, e copie o Pix."
              onPress={handleOpenOfferings}
            />
            <EuQueroItem
              icon="flag"
              title="Campanhas e Projetos"
              subtitle="Informe o valor e copie o Pix já identificado."
              onPress={handleOpenCampaign}
            />
          </View>
        ) : null}
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
    paddingTop: 8,
    backgroundColor: MINIMAL_UI.background,
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
  contributeOptions: {
    paddingLeft: 16,
    gap: 0,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: MINIMAL_UI.divider,
    marginLeft: 20,
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

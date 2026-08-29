import { SmallGroupCard } from '@/components/SmallGroupCard';
import { OpportunityMuralCard } from '@/components/OpportunityMuralCard';
import { MinimalRouteShell } from '@/components/minimal/MinimalRouteShell';
import { usePalette } from '@/context/PaletteContext';
import { useGhostMode } from '@/context/GhostModeContext';
import {
  ACL_UNAVAILABLE_MESSAGE,
  checkOperatorIsSuperAdmin,
  DASHBOARD_CARD_CONTENT_TO_ACCESS_KEY,
  getAccessControlRpcStatus,
  loadDashboardCardViewAccess,
  type DashboardCardViewAccess,
} from '@/lib/accessControl';
import {
  getDashboardLinkedScreenKeys,
  isDashboardCardFullyAllowed,
  loadDashboardLinkedScreenAccess,
  type DashboardScreenAccess,
} from '@/lib/dashboardScreenAccess';
import { isMinimalPresentationRoute } from '@/lib/dashboardReturnNavigation';
import { resolveDashboardCardContentFromParam } from '@/lib/dashboardCardScreenLinks';
import {
  isLiveDashboardCardContent,
  resolvePublishedDashboardHref,
} from '@/lib/frozenPublication';
import { fetchProfileHasActiveMembership } from '@/lib/profileMembershipStatus';
import { loadEffectiveSessionProfile, getEffectiveUserPhone } from '@/lib/loadSessionProfile';
import { isGhostModeActive } from '@/lib/ghostMode';
import { resolveEffectiveProfileId } from '@/lib/sessionProfile';
import {
  getStoredUserPhone,
  persistProfileId,
  repairUserSessionReference,
  signOutAndNavigateToLogin,
} from '@/lib/userSession';
import { recordProfileScreenVisit } from '@/lib/profileScreenVisitTracking';
import { resolveDashboardCardAccessResourceKey } from '@/lib/screenAccessResourceKeys';
import {
  buildDashboardDeepLinkKey,
  computeEventPanelCardHeight,
  computePanelCardTopPadding,
  resolveDashboardCardIndex,
} from '@/lib/dashboardPanelLayout';
import { buildDashboardScreenGradient } from '@/lib/paletteTheme';
import { CONTAIN_WIDTH, MINIMAL_FLAT_PANEL, MINIMAL_PAGE } from '@/lib/minimalPresentation';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Painel vivo: só Célula e Mural. Cards congelados estão comentados em
 * lib/frozen-dashboard-cards.comment.ts (não importar).
 */
type DashboardCard = {
  id: string;
  title: string;
  content: 'small_group' | 'opportunity_mural_card';
};

type DashboardProfile = {
  id?: string;
  full_name?: string;
};

export default function DashboardScreen() {
  const { colors: paletteColors } = usePalette();
  const mainScreenGradient = useMemo(
    () => buildDashboardScreenGradient(paletteColors),
    [paletteColors]
  );
  const { isActive: ghostModeActive, state: ghostModeState } = useGhostMode();
  const { width: pageWidth, height: windowHeight } = useWindowDimensions();
  const [measuredListWidth, setMeasuredListWidth] = useState(0);
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const router = useRouter();
  const isMinimalPresentation = isMinimalPresentationRoute(params.presentation);

  const [profile, setProfile] = useState<DashboardProfile | null>(null);
  const [hasActiveMembership, setHasActiveMembership] = useState(false);
  const [isMaintenanceAccessLoading, setIsMaintenanceAccessLoading] = useState(true);
  const [dashboardCardAccess, setDashboardCardAccess] = useState<DashboardCardViewAccess>({});
  const [dashboardScreenAccess, setDashboardScreenAccess] = useState<DashboardScreenAccess>({});
  const [aclRpcStatus, setAclRpcStatus] = useState<'unknown' | 'available' | 'missing'>('unknown');
  const [isDashboardCarouselReady, setIsDashboardCarouselReady] = useState(false);
  const handledDashboardCardRef = useRef<string | null>(null);

  const requestedDashboardCard = Array.isArray(params.dashboardCard)
    ? params.dashboardCard[0]
    : params.dashboardCard;
  const requestedDashboardCardNonce = Array.isArray(params.dashboardCardNonce)
    ? params.dashboardCardNonce[0]
    : params.dashboardCardNonce;
  const phone = params.phone ? decodeURIComponent(params.phone as string) : null;

  const dashboardPanelCardHeight = useMemo(
    () => computeEventPanelCardHeight(windowHeight, insets.top, insets.bottom),
    [insets.bottom, insets.top, windowHeight]
  );

  const carouselLayoutWidth = useMemo(() => {
    if (isMinimalPresentation && measuredListWidth > 0) {
      return measuredListWidth;
    }
    return pageWidth;
  }, [isMinimalPresentation, measuredListWidth, pageWidth]);

  const handleMinimalListLayout = useCallback(
    (event: { nativeEvent: { layout: { width: number } } }) => {
      if (!isMinimalPresentation) {
        return;
      }

      const nextWidth = Math.round(event.nativeEvent.layout.width);
      if (nextWidth > 0 && nextWidth !== measuredListWidth) {
        setMeasuredListWidth(nextWidth);
      }
    },
    [isMinimalPresentation, measuredListWidth]
  );

  const effectiveCarouselPageStyle = useMemo(
    () =>
      isMinimalPresentation
        ? {
            width: carouselLayoutWidth,
            maxWidth: carouselLayoutWidth,
            flex: 1,
            alignSelf: 'stretch' as const,
          }
        : { width: pageWidth },
    [carouselLayoutWidth, isMinimalPresentation, pageWidth]
  );

  const effectiveDashboardCardWrapperStyle = useMemo(
    () =>
      isMinimalPresentation
        ? { ...MINIMAL_PAGE, paddingTop: 0, paddingBottom: 0 }
        : {
            ...styles.cardWrapper,
            paddingTop: computePanelCardTopPadding(
              windowHeight,
              insets.top,
              insets.bottom,
              dashboardPanelCardHeight
            ),
          },
    [dashboardPanelCardHeight, insets.bottom, insets.top, isMinimalPresentation, windowHeight]
  );

  const effectiveDashboardPanelCardSizeStyle = useMemo(
    () =>
      isMinimalPresentation
        ? { width: '100%' as const, flex: 1, alignSelf: 'stretch' as const }
        : {
            width: pageWidth * 0.9,
            minHeight: dashboardPanelCardHeight,
            maxHeight: dashboardPanelCardHeight,
            alignSelf: 'center' as const,
          },
    [dashboardPanelCardHeight, isMinimalPresentation, pageWidth]
  );

  const cardBaseStyle = isMinimalPresentation ? MINIMAL_FLAT_PANEL : styles.card;

  useFocusEffect(
    useCallback(() => {
      const param = typeof requestedDashboardCard === 'string' ? requestedDashboardCard.trim() : '';
      const content = resolveDashboardCardContentFromParam(param || null);

      if (content && isLiveDashboardCardContent(content)) {
        return undefined;
      }

      router.replace(resolvePublishedDashboardHref(param || null));
      return undefined;
    }, [requestedDashboardCard, router])
  );

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setIsMaintenanceAccessLoading(true);

      try {
        let targetPhone = phone;
        if (!targetPhone) {
          targetPhone = isGhostModeActive()
            ? await getEffectiveUserPhone()
            : await getStoredUserPhone();
        }

        if (cancelled) {
          return;
        }

        if (!targetPhone && !isGhostModeActive()) {
          setDashboardCardAccess({});
          setDashboardScreenAccess({});
          return;
        }

        let sessionProfile = await loadEffectiveSessionProfile(targetPhone);

        if (!sessionProfile?.id && !isGhostModeActive()) {
          await repairUserSessionReference(targetPhone);
          sessionProfile = await loadEffectiveSessionProfile(targetPhone);
        }

        if (cancelled) {
          return;
        }

        if (!sessionProfile) {
          setProfile(null);
          signOutAndNavigateToLogin();
          return;
        }

        setProfile({
          id: sessionProfile.id,
          full_name: sessionProfile.full_name ?? undefined,
        });

        if (sessionProfile.id && !isGhostModeActive()) {
          await persistProfileId(sessionProfile.id);
          if (cancelled) {
            return;
          }
        }

        const aclStatus = await getAccessControlRpcStatus();
        if (cancelled) {
          return;
        }
        setAclRpcStatus(aclStatus);

        const accessProfileId = (await resolveEffectiveProfileId()) ?? sessionProfile.id;
        if (cancelled) {
          return;
        }

        const [cardAccess, screenAccess, activeMembership] = await Promise.all([
          loadDashboardCardViewAccess(accessProfileId, { forceRefresh: ghostModeActive }),
          loadDashboardLinkedScreenAccess(accessProfileId, { forceRefresh: ghostModeActive }),
          fetchProfileHasActiveMembership(accessProfileId),
        ]);

        if (cancelled) {
          return;
        }

        let resolvedCardAccess = cardAccess;
        let resolvedScreenAccess = screenAccess;
        const hasAnyCard = Object.values(cardAccess).some((allowedCard) => allowedCard === true);
        const operatorIsSuperAdmin =
          !isGhostModeActive()
          && (await checkOperatorIsSuperAdmin({ forceRefresh: ghostModeActive }));

        if (cancelled) {
          return;
        }

        if (!hasAnyCard && operatorIsSuperAdmin) {
          resolvedCardAccess = Object.fromEntries(
            Object.keys(DASHBOARD_CARD_CONTENT_TO_ACCESS_KEY).map((content) => [content, true] as const)
          );
          resolvedScreenAccess = Object.fromEntries(
            getDashboardLinkedScreenKeys().map((resourceKey) => [resourceKey, true] as const)
          );
        }

        setDashboardCardAccess(resolvedCardAccess);
        setDashboardScreenAccess(resolvedScreenAccess);
        setHasActiveMembership(activeMembership);
      } catch (error) {
        if (cancelled) {
          return;
        }
        console.error('Erro ao carregar dashboard:', error);
        setDashboardCardAccess({});
        setDashboardScreenAccess({});
        setHasActiveMembership(false);
      } finally {
        if (!cancelled) {
          setIsMaintenanceAccessLoading(false);
        }
      }
    }

    void loadData();
    return () => {
      cancelled = true;
    };
  }, [phone, ghostModeActive, ghostModeState?.targetProfileId]);

  const dashboardCardCandidates: DashboardCard[] = useMemo(
    () =>
      hasActiveMembership
        ? [
            { id: '16', title: 'Pequeno Grupo', content: 'small_group' },
            { id: '18', title: 'Mural de Oportunidades', content: 'opportunity_mural_card' },
          ]
        : [],
    [hasActiveMembership]
  );

  const isDashboardCardAccessReady =
    Boolean(profile?.id)
    && (!isMaintenanceAccessLoading || Object.keys(dashboardCardAccess).length > 0);

  const data: DashboardCard[] = useMemo(() => {
    if (!isDashboardCardAccessReady) {
      return [];
    }

    return dashboardCardCandidates.filter((card) =>
      isDashboardCardFullyAllowed(card.content, dashboardCardAccess, dashboardScreenAccess)
    );
  }, [dashboardCardAccess, dashboardCardCandidates, dashboardScreenAccess, isDashboardCardAccessReady]);

  const carouselData = useMemo(() => {
    const targetIndex = resolveDashboardCardIndex(data, requestedDashboardCard);

    if (targetIndex >= 0) {
      return [data[targetIndex]!];
    }

    return data.length ? [data[0]!] : [];
  }, [data, requestedDashboardCard]);

  const activeDashboardCard = carouselData[0] ?? null;

  const activeDashboardScreenTitle = useMemo(() => {
    const card = activeDashboardCard;
    if (!card) {
      return '';
    }

    if (isMinimalPresentation && card.content === 'small_group') {
      return '';
    }

    return card.title?.trim() ?? '';
  }, [activeDashboardCard, isMinimalPresentation]);

  const dashboardDeepLinkKey = buildDashboardDeepLinkKey(
    requestedDashboardCard,
    requestedDashboardCardNonce
  );

  useEffect(() => {
    if (!isDashboardCardAccessReady) {
      return;
    }

    setIsDashboardCarouselReady(true);

    if (!requestedDashboardCard || !dashboardDeepLinkKey) {
      return;
    }

    handledDashboardCardRef.current = dashboardDeepLinkKey;
  }, [dashboardDeepLinkKey, isDashboardCardAccessReady, requestedDashboardCard]);

  useEffect(() => {
    const card = activeDashboardCard;

    if (!card) {
      return;
    }

    const screenKey =
      resolveDashboardCardAccessResourceKey(card.content) ?? `dashboard.card.${card.content}`;

    void recordProfileScreenVisit(screenKey, card.title);
  }, [activeDashboardCard]);

  return (
    <MinimalRouteShell
      minimal={isMinimalPresentation}
      title={activeDashboardScreenTitle}
      gradientColors={mainScreenGradient}
    >
      {aclRpcStatus === 'missing' ? (
        <View style={styles.aclUnavailableBanner}>
          <Text style={styles.aclUnavailableText}>{ACL_UNAVAILABLE_MESSAGE}</Text>
        </View>
      ) : null}

      <View style={styles.listContainer} onLayout={handleMinimalListLayout}>
        {isDashboardCardAccessReady && data.length === 0 ? (
          <View style={styles.dashboardEmptyState}>
            <Text style={styles.dashboardEmptyTitle}>Nenhum painel disponível</Text>
            <Text style={styles.dashboardEmptyText}>
              {ghostModeActive
                ? 'O usuário simulado não tem permissão para ver painéis do dashboard. Encerre o Modo Ghost para voltar à sua sessão.'
                : aclRpcStatus === 'missing'
                  ? ACL_UNAVAILABLE_MESSAGE
                  : 'Suas permissões atuais não incluem painéis do dashboard. Se você é administrador, saia e entre novamente ou fale com o suporte.'}
            </Text>
          </View>
        ) : null}

        <FlatList
          style={[
            styles.dashboardFlatList,
            (!isDashboardCardAccessReady || !isDashboardCarouselReady) && styles.dashboardFlatListHidden,
          ]}
          data={carouselData}
          extraData={carouselLayoutWidth}
          horizontal
          scrollEnabled={false}
          keyboardShouldPersistTaps="handled"
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item?.id ?? 'dashboard-card'}
          getItemLayout={(_, index) => ({
            length: carouselLayoutWidth,
            offset: carouselLayoutWidth * index,
            index,
          })}
          renderItem={({ item }) => (
            <View
              style={
                isMinimalPresentation
                  ? [styles.carouselPageSlot, effectiveCarouselPageStyle]
                  : effectiveCarouselPageStyle
              }
            >
              <View
                style={[
                  effectiveCarouselPageStyle,
                  item.content === 'small_group' && styles.smallGroupPanelShell,
                ]}
              >
                <View style={effectiveDashboardCardWrapperStyle}>
                  {item.content === 'small_group' ? (
                    <View
                      style={[
                        cardBaseStyle,
                        styles.cardAdministrativo,
                        styles.dashboardPanelCardTopLayout,
                        effectiveDashboardPanelCardSizeStyle,
                      ]}
                    >
                      <View style={styles.cardGroupedManagePanel}>
                        <SmallGroupCard
                          panelHeight={dashboardPanelCardHeight}
                          isActive={activeDashboardCard?.content === 'small_group'}
                        />
                      </View>
                    </View>
                  ) : (
                    <View
                      style={[
                        cardBaseStyle,
                        styles.cardAdministrativo,
                        styles.dashboardPanelCardTopLayout,
                        effectiveDashboardPanelCardSizeStyle,
                      ]}
                    >
                      <OpportunityMuralCard
                        panelHeight={dashboardPanelCardHeight}
                        isActive={activeDashboardCard?.content === 'opportunity_mural_card'}
                      />
                    </View>
                  )}
                </View>
              </View>
            </View>
          )}
        />
      </View>
    </MinimalRouteShell>
  );
}

const styles = StyleSheet.create({
  aclUnavailableBanner: {
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    borderColor: 'rgba(251, 191, 36, 0.35)',
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
    marginHorizontal: 24,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  aclUnavailableText: {
    color: '#FCD34D',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  listContainer: { flex: 1, minHeight: 0 },
  dashboardEmptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingBottom: 24,
  },
  dashboardEmptyTitle: {
    color: '#E2E8F0',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 10,
    textAlign: 'center',
  },
  dashboardEmptyText: {
    color: '#94A3B8',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  dashboardFlatList: { flex: 1, minHeight: 0 },
  carouselPageSlot: {
    width: '100%',
    maxWidth: '100%',
    flex: 1,
    alignSelf: 'stretch',
    minWidth: 0,
    overflow: 'hidden',
  },
  dashboardFlatListHidden: {
    position: 'absolute',
    opacity: 0,
    pointerEvents: 'none',
  },
  cardWrapper: {
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingBottom: 8,
  },
  card: {
    width: '90%',
    alignSelf: 'center',
    padding: 16,
    alignItems: 'center',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  cardGroupedManagePanel: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    alignSelf: 'stretch',
  },
  smallGroupPanelShell: {
    ...CONTAIN_WIDTH,
    flex: 1,
  },
  cardAdministrativo: {
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    gap: 0,
  },
  dashboardPanelCardTopLayout: {
    justifyContent: 'flex-start',
    alignItems: 'stretch',
  },
});

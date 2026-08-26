import { FamilyAgendaModal } from '@/components/FamilyAgendaModal';
import { HomeInboxPagerNav } from '@/components/minimal/HomeInboxPagerNav';
import { InboxList, type InboxListItem } from '@/components/minimal/InboxList';
import { useMinimalHome } from '@/context/MinimalHomeContext';
import {
  EVENT_AVISOS_SQL_HINT,
  fetchPublishedEventAvisos,
  type EventAvisoRow,
} from '@/lib/eventAvisosApi';
import { fetchMyPastoralSlotNotices, markPastoralSlotNoticesRead, type PastoralSlotNotice } from '@/lib/pastoralSlotsApi';
import { fetchMyCampaignNotices, type CampaignNotice } from '@/lib/campaignProjectsApi';
import { fetchUnreadOpportunityNotices, markOpportunityNoticesRead, type OpportunityNotice } from '@/lib/volunteerOpportunitiesApi';
import { fetchUnreadScaleSwapNotices, markScaleSwapNoticesRead, type ScaleSwapNotice } from '@/lib/scaleSwapApi';
import { formatEventDateTimeLabel } from '@/lib/eventDate';
import { MINIMAL_SECTION_TITLE, MINIMAL_TYPO, MINIMAL_UI } from '@/lib/minimalUiTheme';
import { useActiveEvents } from '@/hooks/useActiveEvents';
import { supabase } from '@/lib/supabase';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

/** Lista um pouco mais baixa para caber a faixa Avisos/Eventos. */
const EVENTS_VISIBLE_ROWS = 3;

export function EventsInboxHome() {
  const { setHomeAgendaOpen } = useMinimalHome();
  const { width: windowWidth } = useWindowDimensions();
  const { events, loading, error } = useActiveEvents({ enablePolling: true });
  const [modalEventId, setModalEventId] = useState<string | null>(null);
  const [pageWidth, setPageWidth] = useState(0);
  const [pageHeight, setPageHeight] = useState(0);
  const [pagerIndex, setPagerIndex] = useState(0);
  const [avisos, setAvisos] = useState<EventAvisoRow[]>([]);
  const [pastoralNotices, setPastoralNotices] = useState<PastoralSlotNotice[]>([]);
  const [campaignNotices, setCampaignNotices] = useState<CampaignNotice[]>([]);
  const [opportunityNotices, setOpportunityNotices] = useState<OpportunityNotice[]>([]);
  const [scaleSwapNotices, setScaleSwapNotices] = useState<ScaleSwapNotice[]>([]);
  const [avisosLoading, setAvisosLoading] = useState(false);
  const [avisosError, setAvisosError] = useState<string | null>(null);
  const pagerRef = useRef<ScrollView>(null);
  const agendaOpen = modalEventId !== null;

  useEffect(() => {
    setHomeAgendaOpen(agendaOpen);
    return () => setHomeAgendaOpen(false);
  }, [agendaOpen, setHomeAgendaOpen]);

  const loadAvisos = useCallback(async () => {
    setAvisosLoading(true);
    setAvisosError(null);
    try {
      const slotNotices = await fetchMyPastoralSlotNotices();
      setPastoralNotices(slotNotices);
      setCampaignNotices(await fetchMyCampaignNotices());
      const nextOpportunity = await fetchUnreadOpportunityNotices();
      const nextSwaps = await fetchUnreadScaleSwapNotices();
      setOpportunityNotices(nextOpportunity);
      setScaleSwapNotices(nextSwaps);
      const rows = await fetchPublishedEventAvisos();
      setAvisos(rows);
      if (slotNotices.some((item) => !item.read_at)) {
        void markPastoralSlotNoticesRead();
      }
      if (nextOpportunity.length > 0) {
        void markOpportunityNoticesRead();
      }
      if (nextSwaps.length > 0) {
        void markScaleSwapNoticesRead();
      }
    } catch (loadError) {
      setAvisosError(loadError instanceof Error ? loadError.message : EVENT_AVISOS_SQL_HINT);
      setAvisos([]);
    } finally {
      setAvisosLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAvisos();
  }, [loadAvisos]);

  useEffect(() => {
    const channel = supabase
      .channel('home-event-avisos-public')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'event_avisos' },
        () => {
          void loadAvisos();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadAvisos]);

  const inboxItems: InboxListItem[] = useMemo(
    () =>
      events.map((event) => ({
        id: event.id,
        subject: event.name,
        preview: event.event_local?.trim() || 'Sem local informado',
        meta: formatEventDateTimeLabel(event.event_date),
        event,
      })),
    [events]
  );

  const resolvedPageWidth = pageWidth > 0 ? pageWidth : Math.max(280, windowWidth - 32);

  const scrollToPage = useCallback(
    (index: number) => {
      const next = index <= 0 ? 0 : 1;
      pagerRef.current?.scrollTo({ x: next * resolvedPageWidth, animated: true });
      setPagerIndex(next);
    },
    [resolvedPageWidth]
  );

  const handlePagerScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = event.nativeEvent.contentOffset.x;
      const next = resolvedPageWidth > 0 ? Math.round(x / resolvedPageWidth) : 0;
      setPagerIndex(next <= 0 ? 0 : 1);
    },
    [resolvedPageWidth]
  );

  useEffect(() => {
    if (pageWidth <= 0) {
      return;
    }
    pagerRef.current?.scrollTo({ x: pagerIndex * pageWidth, animated: false });
  }, [pageWidth]); // eslint-disable-line react-hooks/exhaustive-deps -- só realinha ao medir largura

  const handleItemPress = (item: InboxListItem) => {
    setModalEventId(item.id);
  };

  const handleCloseModal = () => {
    setModalEventId(null);
  };

  if (loading) {
    return <ActivityIndicator color={MINIMAL_UI.icon} style={styles.loader} />;
  }

  if (error) {
    return <Text style={styles.error}>Não foi possível carregar os eventos.</Text>;
  }

  const pageSizeStyle = {
    width: resolvedPageWidth,
    ...(pageHeight > 0 ? { height: pageHeight } : null),
  };

  return (
    <View
      style={styles.root}
      onLayout={(event) => {
        const { width: nextWidth, height: nextHeight } = event.nativeEvent.layout;
        const roundedWidth = Math.round(nextWidth);
        const roundedHeight = Math.round(nextHeight);
        if (roundedWidth > 0 && roundedWidth !== pageWidth) {
          setPageWidth(roundedWidth);
        }
        if (roundedHeight > 0 && roundedHeight !== pageHeight) {
          setPageHeight(roundedHeight);
        }
      }}
    >
      {!agendaOpen ? (
        <ScrollView
          ref={pagerRef}
          horizontal
          pagingEnabled
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          style={styles.pager}
          contentContainerStyle={styles.pagerContent}
          onMomentumScrollEnd={handlePagerScrollEnd}
          onScrollEndDrag={handlePagerScrollEnd}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.page, pageSizeStyle]}>
            <View style={styles.inboxSection}>
              <Text style={styles.sectionTitle}>Proximos Eventos</Text>
              <InboxList
                items={inboxItems}
                emptyMessage="Nenhum evento disponível no momento."
                onItemPress={handleItemPress}
                maxVisibleRows={EVENTS_VISIBLE_ROWS}
              />
            </View>
            <HomeInboxPagerNav variant="toAvisos" onPress={() => scrollToPage(1)} />
          </View>

          <View style={[styles.page, pageSizeStyle]}>
            <View style={styles.avisosSection}>
              <Text style={styles.sectionTitle}>Avisos</Text>
              {avisosLoading ? (
                <ActivityIndicator color={MINIMAL_UI.icon} style={styles.loader} />
              ) : avisos.length === 0
                && pastoralNotices.length === 0
                && campaignNotices.length === 0
                && opportunityNotices.length === 0
                && scaleSwapNotices.length === 0 ? (
                avisosError ? (
                  <Text style={styles.error}>{avisosError}</Text>
                ) : (
                  <Text style={styles.emptyAvisos}>Nenhum aviso publicado no momento.</Text>
                )
              ) : (
                <ScrollView
                  style={styles.avisosList}
                  contentContainerStyle={styles.avisosListContent}
                  nestedScrollEnabled
                  showsVerticalScrollIndicator
                >
                  {opportunityNotices.map((item) => (
                    <View key={`opportunity-${item.id}`} style={styles.avisoCard}>
                      <Text style={styles.avisoTitle} numberOfLines={2}>
                        {item.title}
                      </Text>
                      <Text style={styles.avisoBody}>{item.body}</Text>
                    </View>
                  ))}
                  {scaleSwapNotices.map((item) => (
                    <View key={`scale-swap-${item.id}`} style={styles.avisoCard}>
                      <Text style={styles.avisoTitle} numberOfLines={2}>
                        {item.title}
                      </Text>
                      <Text style={styles.avisoBody}>{item.body}</Text>
                    </View>
                  ))}
                  {pastoralNotices.map((item) => (
                    <View key={`pastoral-${item.id}`} style={styles.avisoCard}>
                      <Text style={styles.avisoTitle} numberOfLines={2}>
                        {item.title}
                      </Text>
                      <Text style={styles.avisoBody}>{item.body}</Text>
                    </View>
                  ))}
                  {campaignNotices.map((item) => (
                    <View key={`campaign-${item.id}`} style={styles.avisoCard}>
                      <Text style={styles.avisoTitle} numberOfLines={2}>
                        {item.title}
                      </Text>
                      <Text style={styles.avisoBody}>{item.body}</Text>
                    </View>
                  ))}
                  {avisos.map((item) => (
                    <View key={item.id} style={styles.avisoCard}>
                      {item.title ? (
                        <Text style={styles.avisoTitle} numberOfLines={2}>
                          {item.title}
                        </Text>
                      ) : null}
                      <Text style={styles.avisoBody}>{item.body}</Text>
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>
            <HomeInboxPagerNav variant="toEventos" onPress={() => scrollToPage(0)} />
          </View>
        </ScrollView>
      ) : null}

      <FamilyAgendaModal
        visible={agendaOpen}
        initialEventId={modalEventId}
        onClose={handleCloseModal}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    alignSelf: 'stretch',
    backgroundColor: MINIMAL_UI.background,
    overflow: 'hidden',
  },
  pager: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    maxWidth: '100%',
  },
  pagerContent: {
    alignItems: 'stretch',
    flexGrow: 1,
  },
  page: {
    maxWidth: '100%',
    minWidth: 0,
    flexDirection: 'column',
    justifyContent: 'space-between',
    backgroundColor: MINIMAL_UI.background,
  },
  inboxSection: {
    flexGrow: 0,
    flexShrink: 1,
    width: '100%',
    backgroundColor: MINIMAL_UI.background,
  },
  avisosSection: {
    flex: 1,
    minHeight: 0,
    width: '100%',
  },
  avisosList: {
    flex: 1,
    minHeight: 0,
    width: '100%',
  },
  avisosListContent: {
    gap: 8,
    paddingBottom: 8,
    flexGrow: 1,
  },
  avisoCard: {
    width: '100%',
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: MINIMAL_UI.background,
    gap: 4,
  },
  avisoTitle: {
    ...MINIMAL_TYPO.inboxSubject,
    color: MINIMAL_UI.blueDark,
  },
  avisoBody: {
    ...MINIMAL_TYPO.inboxPreview,
    color: MINIMAL_UI.blue,
    lineHeight: 18,
  },
  emptyAvisos: {
    color: MINIMAL_UI.textMuted,
    textAlign: 'center',
    paddingVertical: 24,
    fontSize: 14,
  },
  sectionTitle: MINIMAL_SECTION_TITLE,
  loader: {
    marginVertical: 32,
  },
  error: {
    color: MINIMAL_UI.textMuted,
    textAlign: 'center',
    paddingVertical: 24,
  },
});

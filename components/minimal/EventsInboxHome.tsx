import { FamilyAgendaModal } from '@/components/FamilyAgendaModal';
import { HomeInboxPagerNav } from '@/components/minimal/HomeInboxPagerNav';
import { InboxList, type InboxListItem } from '@/components/minimal/InboxList';
import { useMinimalHome } from '@/context/MinimalHomeContext';
import {
  EVENT_AVISOS_SQL_HINT,
  fetchPublishedEventAvisos,
  type EventAvisoRow,
} from '@/lib/eventAvisosApi';
import { formatEventDateTimeLabel } from '@/lib/eventDate';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import { useActiveEvents } from '@/hooks/useActiveEvents';
import { supabase } from '@/lib/supabase';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
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
      const rows = await fetchPublishedEventAvisos();
      setAvisos(rows);
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
    return <ActivityIndicator color={MINIMAL_UI.icon} className="my-8" />;
  }

  if (error) {
    return (
      <Text className="py-6 text-center text-minimal-muted">
        Não foi possível carregar os eventos.
      </Text>
    );
  }

  const pageSizeStyle = {
    width: resolvedPageWidth,
    ...(pageHeight > 0 ? { height: pageHeight } : null),
  };

  return (
    <View
      className="min-h-0 w-full min-w-0 max-w-full flex-1 self-stretch overflow-hidden bg-minimal-bg"
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
          className="min-h-0 w-full max-w-full flex-1"
          contentContainerClassName="grow items-stretch"
          onMomentumScrollEnd={handlePagerScrollEnd}
          onScrollEndDrag={handlePagerScrollEnd}
          keyboardShouldPersistTaps="handled"
        >
          <View className="min-w-0 max-w-full flex-col justify-between bg-minimal-bg" style={pageSizeStyle}>
            <View className="w-full grow-0 shrink bg-minimal-bg">
              <Text className="bg-minimal-bg px-3 py-2.5 text-center text-minimal-section text-minimal-blue-dark">
                Proximos Eventos
              </Text>
              <InboxList
                items={inboxItems}
                emptyMessage="Nenhum evento disponível no momento."
                onItemPress={handleItemPress}
                maxVisibleRows={EVENTS_VISIBLE_ROWS}
              />
            </View>
            <HomeInboxPagerNav variant="toAvisos" onPress={() => scrollToPage(1)} />
          </View>

          <View className="min-w-0 max-w-full flex-col justify-between bg-minimal-bg" style={pageSizeStyle}>
            <View className="min-h-0 w-full flex-1">
              <Text className="bg-minimal-bg px-3 py-2.5 text-center text-minimal-section text-minimal-blue-dark">
                Avisos
              </Text>
              {avisosLoading ? (
                <ActivityIndicator color={MINIMAL_UI.icon} className="my-8" />
              ) : avisosError ? (
                <Text className="py-6 text-center text-minimal-muted">{avisosError}</Text>
              ) : avisos.length === 0 ? (
                <Text className="py-6 text-center text-sm text-minimal-muted">
                  Nenhum aviso publicado no momento.
                </Text>
              ) : (
                <ScrollView
                  className="min-h-0 w-full flex-1"
                  contentContainerClassName="grow gap-2 pb-2"
                  nestedScrollEnabled
                  showsVerticalScrollIndicator
                >
                  {avisos.map((item) => (
                    <View
                      key={item.id}
                      className="w-full gap-1 rounded-xl border border-minimal-border bg-minimal-bg px-3 py-2.5"
                    >
                      {item.title ? (
                        <Text className="text-minimal-inbox text-minimal-blue-dark" numberOfLines={2}>
                          {item.title}
                        </Text>
                      ) : null}
                      <Text className="text-minimal-preview leading-[18px] text-minimal-blue">
                        {item.body}
                      </Text>
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

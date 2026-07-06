import { FamilyRegistrationList } from '@/components/FamilyRegistrationList';
import { InboxList, type InboxListItem } from '@/components/minimal/InboxList';
import { MINIMAL_TYPO, MINIMAL_UI } from '@/lib/minimalUiTheme';
import { formatEventDateTimeLabel } from '@/lib/eventDate';
import { useActiveEvents } from '@/hooks/useActiveEvents';
import { resolveFamilyIdForPhone } from '@/lib/family';
import { loadEffectiveSessionProfile } from '@/lib/loadSessionProfile';
import { getStoredUserPhone } from '@/lib/userSession';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

type Props = {
  userName: string;
};

export function EventsInboxHome({ userName }: Props) {
  const { events, loading, error } = useActiveEvents({ enablePolling: true });
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [sessionPhone, setSessionPhone] = useState<string | null>(null);
  const [sessionProfileName, setSessionProfileName] = useState<string | null>(null);
  const [sessionProfile, setSessionProfile] = useState<{
    id: string;
    full_name?: string | null;
    phone?: string | null;
    birth_date?: string | null;
    family_id?: string | null;
  } | null>(null);

  useEffect(() => {
    let active = true;

    void (async () => {
      const phone = await getStoredUserPhone();

      if (!phone?.trim() || !active) {
        return;
      }

      setSessionPhone(phone);
      const profile = await loadEffectiveSessionProfile(phone);

      if (!active || !profile) {
        return;
      }

      setSessionProfileName(profile.full_name?.trim() ?? null);
      setSessionProfile({
        id: String(profile.id),
        full_name: profile.full_name,
        phone: profile.phone,
        birth_date: profile.birth_date as string | null,
        family_id: profile.family_id as string | null,
      });

      const resolvedFamilyId = await resolveFamilyIdForPhone(phone);

      if (active) {
        setFamilyId(resolvedFamilyId);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const inboxItems: InboxListItem[] = useMemo(
    () =>
      events.map((event) => ({
        id: event.id,
        subject: event.name,
        preview: event.event_local?.trim() || 'Sem local informado',
        meta: formatEventDateTimeLabel(event.event_date),
        event,
        content: familyId ? (
          <FamilyRegistrationList
            familyId={familyId}
            eventId={event.id}
            sessionPhone={sessionPhone}
            sessionProfileName={sessionProfileName}
            sessionProfile={sessionProfile}
            title=""
            minimal
          />
        ) : (
          <Text style={styles.inlineHint}>Carregando dados da família…</Text>
        ),
      })),
    [events, familyId, sessionPhone, sessionProfile, sessionProfileName]
  );

  if (loading) {
    return <ActivityIndicator color={MINIMAL_UI.icon} style={styles.loader} />;
  }

  if (error) {
    return <Text style={styles.error}>Não foi possível carregar os eventos.</Text>;
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.sectionTitle}>Proximos Eventos</Text>
      <Text style={styles.greetingBand}>Olá, {userName}</Text>

      <InboxList items={inboxItems} emptyMessage="Nenhum evento disponível no momento." />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 0,
    backgroundColor: MINIMAL_UI.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: MINIMAL_UI.background,
  },
  sectionTitle: {
    ...MINIMAL_TYPO.screenTitle,
    color: MINIMAL_UI.onDark,
    backgroundColor: MINIMAL_UI.blue,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 0,
    overflow: 'hidden',
  },
  greetingBand: {
    ...MINIMAL_TYPO.greeting,
    color: MINIMAL_UI.onDark,
    backgroundColor: MINIMAL_UI.blueDark,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  loader: {
    marginVertical: 32,
  },
  error: {
    color: MINIMAL_UI.textMuted,
    textAlign: 'center',
    paddingVertical: 24,
  },
  inlineHint: {
    color: MINIMAL_UI.text,
    fontSize: 13,
    backgroundColor: MINIMAL_UI.background,
  },
});

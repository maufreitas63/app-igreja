import { FamilyRegistrationList } from '@/components/FamilyRegistrationList';
import { InboxList, type InboxListItem } from '@/components/minimal/InboxList';
import { MINIMAL_TYPO, MINIMAL_UI } from '@/lib/minimalUiTheme';
import { formatEventDateTimeLabel } from '@/lib/eventDate';
import { useActiveEvents } from '@/hooks/useActiveEvents';
import { resolveFamilyIdForPhone } from '@/lib/family';
import { loadEffectiveSessionProfile } from '@/lib/loadSessionProfile';
import { getStoredUserPhone } from '@/lib/userSession';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export function EventsInboxHome() {
  const router = useRouter();
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
      <InboxList items={inboxItems} emptyMessage="Nenhum evento disponível no momento." />

      <View style={styles.euQuero}>
        <Text style={styles.euQueroLabel}>Eu Quero…</Text>
        <View style={styles.euQueroActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() =>
              router.push({
                pathname: '/financial',
                params: { presentation: 'minimal' },
              })
            }
          >
            <Text style={styles.actionButtonText}>Contribuir com meu Dízimo ou Oferta</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() =>
              router.push({
                pathname: '/pastoral',
                params: { presentation: 'minimal' },
              })
            }
          >
            <Text style={styles.actionButtonText}>Fazer um pedido de Oração</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 20,
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
    color: MINIMAL_UI.textMuted,
    fontSize: 13,
  },
  euQuero: {
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: MINIMAL_UI.divider,
    gap: 10,
  },
  euQueroLabel: {
    ...MINIMAL_TYPO.sectionLabel,
  },
  euQueroActions: {
    gap: 8,
  },
  actionButton: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: MINIMAL_UI.divider,
  },
  actionButtonText: {
    color: MINIMAL_UI.text,
    fontSize: 15,
    fontWeight: '600',
  },
});

import { MEMBER_ACCEPTED_VALUE } from '@/lib/membersAccepted';
import { resolveActorProfileId } from '@/lib/maintenanceAccessControlApi';
import { supabase } from '@/lib/supabase';
import { useCallback, useEffect, useState } from 'react';

export type EventRegistrationGroupItem = {
  registration_id: string;
  full_name: string;
  kids_status: 'KIDS' | 'TEENS';
  room_entry_checked: boolean;
  contact_phone: string | null;
};

type EventRegistrationRpcRow = {
  id?: string | null;
  registration_id?: string | null;
  family_id?: string | null;
  full_name: string | null;
  kids_status: string | null;
  room_entry_checked?: boolean | null;
};

type EventRegistrationFamilyRow = {
  id: string | null;
  family_id: string | null;
};

type NamedFamilyLookupRow = {
  full_name: string | null;
  family_id: string | null;
};

type FamilyContactRow = {
  family_id: string | null;
  phone: string | null;
  relationship: string | null;
};

type UpdateRoomEntryResult = {
  success: boolean;
  message?: string;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const normalizeStatus = (value: string | null | undefined): 'KIDS' | 'TEENS' | null => {
  const normalized = value?.trim().toUpperCase();

  if (normalized === 'KIDS' || normalized === 'TEENS') {
    return normalized;
  }

  return null;
};

const normalizeRelationship = (value: string | null | undefined) =>
  (value ?? '')
    .trim()
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const getRelationshipPriority = (relationship: string | null | undefined) => {
  const normalized = normalizeRelationship(relationship);

  if (normalized.includes('conjuge')) {
    return 0;
  }

  if (normalized === 'mae') {
    return 1;
  }

  if (normalized === 'pai') {
    return 2;
  }

  if (
    normalized.includes('representante legal')
    || normalized.includes('responsavel legal')
    || normalized === 'responsavel'
  ) {
    return 3;
  }

  return Number.POSITIVE_INFINITY;
};

export type UseEventRegistrationsByStatusOptions = {
  /** Quando false, não busca inscrições (ex.: card SALA fora de foco). */
  enabled?: boolean;
  /** Restringe inscrições à família do usuário (card SALA no dashboard principal). */
  familyId?: string | null;
};

const normalizePersonName = (value: string | null | undefined) =>
  (value ?? '')
    .trim()
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

export const useEventRegistrationsByStatus = (
  eventId: string | null | undefined,
  options?: UseEventRegistrationsByStatusOptions
) => {
  const enabled = options?.enabled !== false;
  const familyIdFilter = options?.familyId?.trim() || null;
  const [kidsRegistrations, setKidsRegistrations] = useState<EventRegistrationGroupItem[]>([]);
  const [teensRegistrations, setTeensRegistrations] = useState<EventRegistrationGroupItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent === true;

    if (!eventId) {
      setKidsRegistrations([]);
      setTeensRegistrations([]);
      setLoading(false);
      setError(null);
      return;
    }

    if (!silent) {
      setLoading(true);
    }
    setError(null);

    const { data: rpcData, error: rpcError } = await supabase.rpc('get_event_registrations_by_status', {
      p_event_id: eventId,
    });

    let rowsSource = (rpcData as EventRegistrationRpcRow[] | null) ?? [];

    if (rpcError) {
      const { data: directData, error: directError } = await supabase
        .from('event_registrations')
        .select('id, full_name, kids_status, room_entry_checked')
        .eq('event_id', eventId)
        .in('kids_status', ['KIDS', 'TEENS'])
        .order('kids_status', { ascending: true })
        .order('full_name', { ascending: true });

      if (directError) {
        setKidsRegistrations([]);
        setTeensRegistrations([]);
        setError(directError);
        setLoading(false);
        return;
      }

      rowsSource = (directData as EventRegistrationRpcRow[] | null) ?? [];

      if (!rowsSource.length) {
        const { data: registrationCount, error: countError } = await supabase.rpc(
          'get_event_registration_count',
          { p_event_id: eventId }
        );

        const normalizedCount =
          typeof registrationCount === 'number'
            ? registrationCount
            : Number.parseInt(String(registrationCount ?? 0), 10) || 0;

        if (!countError && normalizedCount > 0) {
          setKidsRegistrations([]);
          setTeensRegistrations([]);
          setError(
            new Error(
              'Os inscritos existem, mas a função get_event_registrations_by_status ainda não está disponível para o app.'
            )
          );
          setLoading(false);
          return;
        }
      }
    }

    const persistedRegistrationIds = Array.from(
      new Set(
        rowsSource
          .map((row) => (row.registration_id ?? row.id)?.trim() ?? '')
          .filter((value): value is string => UUID_REGEX.test(value))
      )
    );

    const familyIdByRegistrationId = new Map<string, string>();

    if (persistedRegistrationIds.length) {
      const { data: familyRows, error: familyRowsError } = await supabase
        .from('event_registrations')
        .select('id, family_id')
        .in('id', persistedRegistrationIds);

      if (familyRowsError) {
        setKidsRegistrations([]);
        setTeensRegistrations([]);
        setError(familyRowsError);
        setLoading(false);
        return;
      }

      for (const row of (familyRows as EventRegistrationFamilyRow[] | null) ?? []) {
        const registrationId = row.id?.trim();
        const familyId = row.family_id?.trim();

        if (registrationId && familyId) {
          familyIdByRegistrationId.set(registrationId, familyId);
        }
      }
    }

    const fullNames = Array.from(
      new Set(
        rowsSource
          .map((row) => row.full_name?.trim() ?? '')
          .filter((value): value is string => Boolean(value))
      )
    );

    const familyIdByFullName = new Map<string, string>();

    if (fullNames.length) {
      const { data: namedFamilyRows, error: namedFamilyRowsError } = await supabase
        .from('members')
        .select('full_name, family_id')
        .in('full_name', fullNames)
        .eq('accepted', MEMBER_ACCEPTED_VALUE);

      if (namedFamilyRowsError) {
        setKidsRegistrations([]);
        setTeensRegistrations([]);
        setError(namedFamilyRowsError);
        setLoading(false);
        return;
      }

      for (const row of (namedFamilyRows as NamedFamilyLookupRow[] | null) ?? []) {
        const fullName = row.full_name?.trim();
        const familyId = row.family_id?.trim();

        if (fullName && familyId && !familyIdByFullName.has(fullName)) {
          familyIdByFullName.set(fullName, familyId);
        }
      }
    }

    const familyIds = Array.from(
      new Set(
        rowsSource
          .map((row) => {
            const registrationId = (row.registration_id ?? row.id)?.trim() ?? '';
            const fullName = row.full_name?.trim() ?? '';

            return (
              row.family_id?.trim()
              || familyIdByRegistrationId.get(registrationId)
              || familyIdByFullName.get(fullName)
              || null
            );
          })
          .filter((value): value is string => Boolean(value))
      )
    );

    const contactPhoneByFamilyId = new Map<string, string>();

    if (familyIds.length) {
      const { data: familyContacts, error: familyContactsError } = await supabase
        .from('members')
        .select('family_id, phone, relationship')
        .in('family_id', familyIds)
        .eq('accepted', MEMBER_ACCEPTED_VALUE);

      if (familyContactsError) {
        setKidsRegistrations([]);
        setTeensRegistrations([]);
        setError(familyContactsError);
        setLoading(false);
        return;
      }

      const bestContactByFamilyId = new Map<
        string,
        { phone: string; priority: number }
      >();

      for (const row of (familyContacts as FamilyContactRow[] | null) ?? []) {
        const familyId = row.family_id?.trim();
        const phone = row.phone?.trim();

        if (!familyId || !phone) {
          continue;
        }

        const priority = getRelationshipPriority(row.relationship);
        const currentBest = bestContactByFamilyId.get(familyId);

        if (!currentBest || priority < currentBest.priority) {
          bestContactByFamilyId.set(familyId, { phone, priority });
        }
      }

      for (const [familyId, contact] of bestContactByFamilyId.entries()) {
        contactPhoneByFamilyId.set(familyId, contact.phone);
      }
    }

    let familyMemberNames: Set<string> | null = null;

    if (familyIdFilter) {
      const { data: familyMemberRows, error: familyMemberRowsError } = await supabase
        .from('members')
        .select('full_name')
        .eq('family_id', familyIdFilter)
        .eq('accepted', MEMBER_ACCEPTED_VALUE);

      if (familyMemberRowsError) {
        setKidsRegistrations([]);
        setTeensRegistrations([]);
        setError(familyMemberRowsError);
        setLoading(false);
        return;
      }

      familyMemberNames = new Set(
        ((familyMemberRows as { full_name: string | null }[] | null) ?? [])
          .map((member) => normalizePersonName(member.full_name))
          .filter((name) => Boolean(name))
      );
    }

    const rows = rowsSource
      .map((row, index) => {
        const registrationId = (row.registration_id ?? row.id)?.trim();
        const status = normalizeStatus(row.kids_status);
        const fullName = row.full_name?.trim();
        const familyId =
          row.family_id?.trim()
          || (registrationId ? familyIdByRegistrationId.get(registrationId) : null)
          || (fullName ? familyIdByFullName.get(fullName) : null);

        if (!status || !fullName) {
          return null;
        }

        if (familyIdFilter) {
          const belongsToFamily =
            familyId === familyIdFilter
            || familyMemberNames?.has(normalizePersonName(fullName)) === true;

          if (!belongsToFamily) {
            return null;
          }
        }

        return {
          registration_id: registrationId || `legacy:${status}:${fullName}:${index}`,
          full_name: fullName,
          kids_status: status,
          room_entry_checked: row.room_entry_checked === true,
          contact_phone: familyId ? contactPhoneByFamilyId.get(familyId) ?? null : null,
        } satisfies EventRegistrationGroupItem;
      })
      .filter((row): row is EventRegistrationGroupItem => Boolean(row));

    setKidsRegistrations(rows.filter((row) => row.kids_status === 'KIDS'));
    setTeensRegistrations(rows.filter((row) => row.kids_status === 'TEENS'));
    setLoading(false);
  }, [eventId, familyIdFilter]);

  const setRoomEntryChecked = useCallback(
    async (registrationId: string, checked: boolean) => {
      if (!UUID_REGEX.test(registrationId)) {
        setKidsRegistrations((current) =>
          current.map((item) =>
            item.registration_id === registrationId ? { ...item, room_entry_checked: checked } : item
          )
        );
        setTeensRegistrations((current) =>
          current.map((item) =>
            item.registration_id === registrationId ? { ...item, room_entry_checked: checked } : item
          )
        );

        return {
          success: true,
          message:
            'Entrada marcada apenas na tela. Execute a SQL mais recente para gravar essa ação no banco.',
        } satisfies UpdateRoomEntryResult;
      }

      const actorProfileId = await resolveActorProfileId();

      const { data, error: rpcError } = await supabase.rpc('set_event_registration_room_entry', {
        p_registration_id: registrationId,
        p_room_entry_checked: checked,
        p_actor_profile_id: actorProfileId,
      });

      if (rpcError) {
        throw rpcError;
      }

      const result = data as UpdateRoomEntryResult | null;
      if (!result?.success) {
        throw new Error(result?.message ?? 'Não foi possível atualizar a entrada na sala.');
      }

      setKidsRegistrations((current) =>
        current.map((item) =>
          item.registration_id === registrationId ? { ...item, room_entry_checked: checked } : item
        )
      );
      setTeensRegistrations((current) =>
        current.map((item) =>
          item.registration_id === registrationId ? { ...item, room_entry_checked: checked } : item
        )
      );

      return result;
    },
    []
  );

  useEffect(() => {
    if (!enabled) {
      setKidsRegistrations([]);
      setTeensRegistrations([]);
      setLoading(false);
      setError(null);
      return;
    }

    void refetch();
  }, [enabled, refetch]);

  return { kidsRegistrations, teensRegistrations, loading, error, refetch, setRoomEntryChecked };
};

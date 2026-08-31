import {
  loadKidsTeensAgeLimits,
  resolveKidsTeensStatusFromBirthDate,
} from '@/lib/kidsTeensStatus';
import { normalizeFullNameKey } from '@/lib/fullName';
import { supabase } from '@/lib/supabase';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FamilyMember } from './useFamilyMembers';

export type RegistrationStatus = 'KIDS' | 'TEENS';

type EventRegistration = {
  profile_id: string | null;
  family_id: string | null;
  full_name: string | null;
  kids_status: string | null;
  room_entry_checked?: boolean | null;
};

type ProfileLookup = {
  full_name: string | null;
  id: string;
  phone: string | null;
};

const normalizePhone = (value: string | null | undefined) => (value ?? '').replace(/\D/g, '');
const normalizeName = normalizeFullNameKey;

export const useRegisteredEventMembers = (
  eventId: string | undefined,
  members: FamilyMember[],
  familyGroupId?: string | null
) => {
  const [registeredMemberIds, setRegisteredMemberIds] = useState<string[]>([]);
  const [registeredMemberStatusById, setRegisteredMemberStatusById] = useState<
    Record<string, RegistrationStatus | undefined>
  >({});
  const [roomCheckInMemberIds, setRoomCheckInMemberIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const memberIdsKey = useMemo(
    () => members.map((member) => member.id).sort().join(','),
    [members]
  );

  const refetch = useCallback(async () => {
    if (!eventId || !members.length) {
      setRegisteredMemberIds([]);
      setRegisteredMemberStatusById({});
      setRoomCheckInMemberIds([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const [registrationsResult, limits] = await Promise.all([
      supabase.rpc('get_registered_event_members', {
        p_event_id: eventId,
        p_family_id: familyGroupId ?? members[0]?.family_id ?? null,
      }),
      loadKidsTeensAgeLimits(),
    ]);

    const { data: registrations, error: registrationsError } = registrationsResult;

    const audienceStatusByMemberId = members.reduce<Record<string, RegistrationStatus | undefined>>(
      (acc, member) => {
        const status = resolveKidsTeensStatusFromBirthDate(member.birth_date, limits);

        if (status) {
          acc[member.id] = status;
        }

        return acc;
      },
      {}
    );

    if (registrationsError) {
      setRegisteredMemberIds([]);
      setRegisteredMemberStatusById(audienceStatusByMemberId);
      setRoomCheckInMemberIds([]);
      setError(registrationsError);
      setLoading(false);
      return;
    }

    const familyRegistrations = (registrations as EventRegistration[] | null) ?? [];
    const memberProfilesById = new Map<string, string>();
    const registeredNames = new Set<string>();
    const registeredProfileIds = new Set<string>();
    const roomCheckedNames = new Set<string>();
    const roomCheckedProfileIds = new Set<string>();
    const registeredStatusByName = new Map<string, RegistrationStatus>();
    const registeredStatusByProfileId = new Map<string, RegistrationStatus>();

    const exactPhones = Array.from(
      new Set(members.map((member) => member.phone?.trim()).filter((value): value is string => Boolean(value)))
    );
    const normalizedPhones = Array.from(
      new Set(
        members
          .map((member) => normalizePhone(member.phone))
          .filter((value): value is string => Boolean(value))
      )
    );
    const normalizedMemberNames = Array.from(
      new Set(members.map((member) => normalizeName(member.full_name)).filter(Boolean))
    );
    const profileCandidatesById = new Map<string, ProfileLookup>();

    if (exactPhones.length) {
      const { data: profilesByExactPhone } = await supabase
        .from('profiles')
        .select('id, full_name, phone')
        .in('phone', exactPhones);

      for (const profile of (profilesByExactPhone as ProfileLookup[] | null) ?? []) {
        profileCandidatesById.set(profile.id, profile);
      }
    }

    if (normalizedPhones.length) {
      const { data: profilesByNormalizedPhone } = await supabase
        .from('profiles')
        .select('id, full_name, phone')
        .in('phone', normalizedPhones);

      for (const profile of (profilesByNormalizedPhone as ProfileLookup[] | null) ?? []) {
        profileCandidatesById.set(profile.id, profile);
      }
    }

    for (const member of members) {
      const memberPhone = member.phone?.trim() ?? null;
      const normalizedMemberPhone = normalizePhone(member.phone);
      const normalizedMemberName = normalizeName(member.full_name);

      const matchingProfile = Array.from(profileCandidatesById.values()).find((profile) => {
        const profilePhone = profile.phone?.trim() ?? null;
        const normalizedProfilePhone = normalizePhone(profile.phone);

        return (
          (memberPhone && profilePhone === memberPhone) ||
          (normalizedMemberPhone && normalizedProfilePhone === normalizedMemberPhone) ||
          normalizeName(profile.full_name) === normalizedMemberName
        );
      });

      if (matchingProfile?.id) {
        memberProfilesById.set(member.id, matchingProfile.id);
      }
    }

    for (const registration of familyRegistrations) {
      const normalizedName = normalizeName(registration.full_name);

      if (!normalizedName) {
        continue;
      }

      registeredNames.add(normalizedName);

      if (registration.profile_id) {
        registeredProfileIds.add(registration.profile_id);
      }

      if (registration.room_entry_checked === true) {
        roomCheckedNames.add(normalizedName);

        if (registration.profile_id) {
          roomCheckedProfileIds.add(registration.profile_id);
        }
      }

      const normalizedStatus = registration.kids_status?.trim().toUpperCase();

      if (normalizedStatus === 'KIDS' || normalizedStatus === 'TEENS') {
        registeredStatusByName.set(normalizedName, normalizedStatus);

        if (registration.profile_id) {
          registeredStatusByProfileId.set(registration.profile_id, normalizedStatus);
        }
      }
    }

    if (!registeredNames.size) {
      setRegisteredMemberIds([]);
      setRegisteredMemberStatusById(audienceStatusByMemberId);
      setRoomCheckInMemberIds([]);
      setLoading(false);
      return;
    }

    const nextRegisteredMemberIds = members
      .filter((member) => {
        const profileId = memberProfilesById.get(member.id);

        return (
          (profileId ? registeredProfileIds.has(profileId) : false) ||
          registeredNames.has(normalizeName(member.full_name))
        );
      })
      .map((member) => member.id);
    setRegisteredMemberIds(nextRegisteredMemberIds);
    setRegisteredMemberStatusById(audienceStatusByMemberId);
    setRoomCheckInMemberIds(
      members
        .filter((member) => {
          const profileId = memberProfilesById.get(member.id);

          return (
            (profileId ? roomCheckedProfileIds.has(profileId) : false)
            || roomCheckedNames.has(normalizeName(member.full_name))
          );
        })
        .map((member) => member.id)
    );
    setLoading(false);
  }, [eventId, familyGroupId, memberIdsKey, members]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { registeredMemberIds, registeredMemberStatusById, roomCheckInMemberIds, loading, error, refetch };
};

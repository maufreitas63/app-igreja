import { compareFamilyMembersByRelationship } from '@/lib/familyRelationshipOptions';
import { normalizeFamilyCode } from '@/lib/family';
import { formatShortName } from '@/lib/formatShortName';
import { supabase } from '@/lib/supabase';

export type MembersDirectoryEntry = {
  id: string;
  full_name: string;
  short_name: string;
  family_id: string;
  relationship: string | null;
  phone: string | null;
  cep: string | null;
  address_street: string | null;
  address_number: string | null;
  address_neighborhood: string | null;
  address_city: string | null;
  address_state: string | null;
};

const MEMBERS_DIRECTORY_RPC_HINT =
  'Execute no Supabase: scripts/members-list-family-sync.sql';

const VISITORS_DIRECTORY_RPC_HINT =
  'Execute no Supabase: scripts/members-list-family-sync.sql (list_profiles_visitors_directory)';

const FAMILY_DIRECTORY_RPC_HINT =
  'Execute no Supabase: scripts/members-list-family-sync.sql';

const mapDirectoryRows = (
  data: Array<Record<string, unknown>> | null | undefined
): MembersDirectoryEntry[] =>
  (data ?? [])
    .map((row) => {
      const profileId = String(row.profile_id ?? row.profileId ?? '').trim();
      const fullName = String(row.full_name ?? row.fullName ?? '').trim();
      const familyId = String(row.family_id ?? row.familyId ?? '').trim();

      if (!profileId || !fullName || !familyId) {
        return null;
      }

      const phoneRaw = row.phone;

      const toNullableText = (value: unknown) => {
        if (value == null) {
          return null;
        }

        const trimmed = String(value).trim();
        return trimmed || null;
      };

      return {
        id: profileId,
        full_name: fullName,
        short_name: formatShortName(fullName),
        family_id: familyId,
        relationship: toNullableText(row.relationship),
        phone: phoneRaw != null ? String(phoneRaw).trim() || null : null,
        cep: toNullableText(row.cep),
        address_street: toNullableText(row.address_street ?? row.addressStreet),
        address_number: toNullableText(row.address_number ?? row.addressNumber),
        address_neighborhood: toNullableText(row.address_neighborhood ?? row.addressNeighborhood),
        address_city: toNullableText(row.address_city ?? row.addressCity),
        address_state: toNullableText(row.address_state ?? row.addressState),
      } satisfies MembersDirectoryEntry;
    })
    .filter((row): row is MembersDirectoryEntry => row !== null);

const toNullableText = (value: unknown) => {
  if (value == null) {
    return null;
  }

  const trimmed = String(value).trim();
  return trimmed || null;
};

const mapFamilyDirectoryRows = (
  data: Array<Record<string, unknown>> | null | undefined,
  fallbackFamilyId = ''
): { familyId: string; members: FamilyDirectoryMember[] } => {
  const normalizedFallbackFamilyId = normalizeFamilyCode(fallbackFamilyId);
  const members = (data ?? [])
    .map((row) => {
      const profileId = row.profile_id != null ? String(row.profile_id).trim() : '';
      const memberId = row.member_id != null ? String(row.member_id).trim() : '';
      const fullName = String(row.full_name ?? row.fullName ?? '').trim();
      const familyId = normalizeFamilyCode(
        String(row.family_id ?? row.familyId ?? normalizedFallbackFamilyId)
      );
      const id = profileId || memberId;

      if (!id || !fullName || !familyId) {
        return null;
      }

      const phoneRaw = row.phone;

      return {
        id,
        full_name: fullName,
        short_name: formatShortName(fullName),
        family_id: familyId,
        relationship: toNullableText(row.relationship),
        phone: phoneRaw != null ? String(phoneRaw).trim() || null : null,
        cep: toNullableText(row.cep),
        address_street: toNullableText(row.address_street ?? row.addressStreet),
        address_number: toNullableText(row.address_number ?? row.addressNumber),
        address_neighborhood: toNullableText(row.address_neighborhood ?? row.addressNeighborhood),
        address_city: toNullableText(row.address_city ?? row.addressCity),
        address_state: toNullableText(row.address_state ?? row.addressState),
      } satisfies FamilyDirectoryMember;
    })
    .filter((row): row is FamilyDirectoryMember => row !== null);

  return {
    familyId: members[0]?.family_id ?? normalizedFallbackFamilyId,
    members,
  };
};

const trackMissingRpc = (missingRpcs: Set<string>, error: { message?: string } | null, rpcName: string) => {
  if (isMissingRpcError(error, rpcName)) {
    missingRpcs.add(rpcName);
  }
};

const mapMembersFamilyDirectoryRows = (
  data: Array<Record<string, unknown>> | null | undefined,
  familyId: string
): FamilyDirectoryMember[] =>
  (data ?? [])
    .map((row) => {
      const memberId = String(row.member_id ?? row.id ?? '').trim();
      const fullName = String(row.full_name ?? '').trim();

      if (!memberId || !fullName) {
        return null;
      }

      return {
        id: memberId,
        full_name: fullName,
        short_name: formatShortName(fullName),
        family_id: familyId,
        relationship: toNullableText(row.relationship),
        phone: row.phone != null ? String(row.phone).trim() || null : null,
        cep: null,
        address_street: null,
        address_number: null,
        address_neighborhood: null,
        address_city: null,
        address_state: null,
      } satisfies FamilyDirectoryMember;
    })
    .filter((row): row is FamilyDirectoryMember => row !== null)
    .sort(compareFamilyMembersByRelationship);

const isMissingRpcError = (error: { message?: string } | null, rpcName: string) => {
  const message = (error?.message ?? '').toLowerCase();

  return (
    message.includes(rpcName.toLowerCase())
    && (message.includes('could not find') || message.includes('does not exist'))
  );
};

const fetchFamilyMembersFromMembersRpc = async (
  familyId: string,
  missingRpcs: Set<string>
): Promise<FamilyDirectoryMember[]> => {
  const { data, error } = await supabase.rpc('list_members_family_directory', {
    p_family_id: familyId,
  });

  if (error) {
    trackMissingRpc(missingRpcs, error, 'list_members_family_directory');

    if (isMissingRpcError(error, 'list_members_family_directory')) {
      return [];
    }

    throw error;
  }

  return mapMembersFamilyDirectoryRows(data as Array<Record<string, unknown>> | null, familyId);
};

const fetchFamilyMembersByFamilyCode = async (
  familyId: string,
  visitorsOnly: boolean,
  missingRpcs: Set<string>
): Promise<{ familyId: string; members: FamilyDirectoryMember[] } | null> => {
  const { data, error } = await supabase.rpc('list_profiles_family_directory_by_code', {
    p_family_id: familyId,
    p_visitors_only: visitorsOnly,
  });

  if (error) {
    trackMissingRpc(missingRpcs, error, 'list_profiles_family_directory_by_code');

    if (isMissingRpcError(error, 'list_profiles_family_directory_by_code')) {
      return null;
    }

    throw error;
  }

  const mapped = mapFamilyDirectoryRows(
    data as Array<Record<string, unknown>> | null,
    familyId
  );

  if (!mapped.members.length) {
    return null;
  }

  return mapped;
};

const fetchFamilyMembersByProfile = async (
  seedEntry: MembersDirectoryEntry,
  displayedFamilyId: string,
  visitorsOnly: boolean,
  missingRpcs: Set<string>
): Promise<{ familyId: string; members: FamilyDirectoryMember[] }> => {
  const { data, error } = await supabase.rpc('list_profiles_family_directory', {
    p_profile_id: seedEntry.id,
    p_displayed_family_id: displayedFamilyId || null,
    p_visitors_only: visitorsOnly,
  });

  if (error) {
    trackMissingRpc(missingRpcs, error, 'list_profiles_family_directory');

    if (!isMissingRpcError(error, 'list_profiles_family_directory')) {
      throw error;
    }

    return {
      familyId: displayedFamilyId,
      members: [],
    };
  }

  return mapFamilyDirectoryRows(
    data as Array<Record<string, unknown>> | null,
    displayedFamilyId
  );
};

const fetchDirectoryFromRpc = async (
  rpcName: 'list_profiles_members_directory' | 'list_profiles_visitors_directory',
  missingRpcHint: string
): Promise<MembersDirectoryEntry[]> => {
  const { data, error } = await supabase.rpc(rpcName);

  if (error) {
    const message = (error.message ?? '').toLowerCase();

    if (message.includes(rpcName) && (message.includes('could not find') || message.includes('does not exist'))) {
      throw new Error(missingRpcHint);
    }

    throw error;
  }

  return mapDirectoryRows(data as Array<Record<string, unknown>> | null);
};

export async function fetchMembersDirectoryFromProfiles(): Promise<MembersDirectoryEntry[]> {
  return fetchDirectoryFromRpc('list_profiles_members_directory', MEMBERS_DIRECTORY_RPC_HINT);
}

export async function fetchVisitorsDirectoryFromProfiles(): Promise<MembersDirectoryEntry[]> {
  return fetchDirectoryFromRpc('list_profiles_visitors_directory', VISITORS_DIRECTORY_RPC_HINT);
}

export type FamilyDirectoryMember = MembersDirectoryEntry;

/** Carrega integrantes da família (members_list modal). */
export async function fetchFamilyMembersForDirectoryEntry(
  seedEntry: MembersDirectoryEntry,
  options: { visitorsOnly?: boolean } = {}
): Promise<{ familyId: string; members: FamilyDirectoryMember[] }> {
  const displayedFamilyId = normalizeFamilyCode(seedEntry.family_id);
  const visitorsOnly = options.visitorsOnly ?? false;
  const missingRpcs = new Set<string>();

  if (!seedEntry.id?.trim()) {
    throw new Error('Perfil do integrante não identificado para carregar a família.');
  }

  // 1) Perfil → SQL resolve family_id canônico em members (independente do código exibido na lista).
  const byProfile = await fetchFamilyMembersByProfile(
    seedEntry,
    displayedFamilyId,
    visitorsOnly,
    missingRpcs
  );

  if (byProfile.members.length > 0) {
    return byProfile;
  }

  const resolvedFamilyId = normalizeFamilyCode(byProfile.familyId) || displayedFamilyId;
  const familyIdsToTry = Array.from(
    new Set([resolvedFamilyId, displayedFamilyId].filter((value) => Boolean(value)))
  );

  for (const familyId of familyIdsToTry) {
    const byCode = await fetchFamilyMembersByFamilyCode(familyId, visitorsOnly, missingRpcs);

    if (byCode?.members.length) {
      return byCode;
    }

    const membersFromRpc = await fetchFamilyMembersFromMembersRpc(familyId, missingRpcs);

    if (membersFromRpc.length > 0) {
      return {
        familyId,
        members: membersFromRpc,
      };
    }
  }

  if (
    missingRpcs.has('list_profiles_family_directory')
    && missingRpcs.has('list_profiles_family_directory_by_code')
    && missingRpcs.has('list_members_family_directory')
  ) {
    throw new Error(FAMILY_DIRECTORY_RPC_HINT);
  }

  return {
    familyId: resolvedFamilyId || displayedFamilyId,
    members: [],
  };
}

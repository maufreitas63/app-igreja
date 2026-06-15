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
  'Execute no Supabase: scripts/access-control-map-pin-roles.sql';

const VISITORS_DIRECTORY_RPC_HINT =
  'Execute no Supabase: scripts/access-control-map-pin-roles.sql (list_profiles_visitors_directory)';

const FAMILY_DIRECTORY_RPC_HINT =
  'Execute no Supabase: scripts/list-profiles-family-directory.sql';

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

const mapFamilyDirectoryRows = (
  data: Array<Record<string, unknown>> | null | undefined
): { familyId: string; members: FamilyDirectoryMember[] } => {
  const members = (data ?? [])
    .map((row) => {
      const profileId = row.profile_id != null ? String(row.profile_id).trim() : '';
      const memberId = row.member_id != null ? String(row.member_id).trim() : '';
      const fullName = String(row.full_name ?? row.fullName ?? '').trim();
      const familyId = String(row.family_id ?? row.familyId ?? '').trim();
      const id = profileId || memberId;

      if (!id || !fullName || !familyId) {
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
    familyId: members[0]?.family_id ?? '',
    members,
  };
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

/** Carrega integrantes da família via RPC `list_profiles_family_directory`. */
export async function fetchFamilyMembersForDirectoryEntry(
  seedEntry: MembersDirectoryEntry,
  options: { visitorsOnly?: boolean } = {}
): Promise<{ familyId: string; members: FamilyDirectoryMember[] }> {
  const { data, error } = await supabase.rpc('list_profiles_family_directory', {
    p_profile_id: seedEntry.id,
    p_visitors_only: options.visitorsOnly ?? false,
  });

  if (error) {
    const message = (error.message ?? '').toLowerCase();

    if (
      message.includes('list_profiles_family_directory')
      && (message.includes('could not find') || message.includes('does not exist'))
    ) {
      throw new Error(FAMILY_DIRECTORY_RPC_HINT);
    }

    throw error;
  }

  return mapFamilyDirectoryRows(data as Array<Record<string, unknown>> | null);
}

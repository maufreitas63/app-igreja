import { formatShortName } from '@/lib/formatShortName';
import { supabase } from '@/lib/supabase';

export type MembersDirectoryEntry = {
  id: string;
  full_name: string;
  short_name: string;
  family_id: string;
  relationship: string | null;
  phone: string | null;
};

const MEMBERS_DIRECTORY_RPC_HINT =
  'Execute no Supabase: scripts/access-control-map-pin-roles.sql';

const VISITORS_DIRECTORY_RPC_HINT =
  'Execute no Supabase: scripts/access-control-map-pin-roles.sql (list_profiles_visitors_directory)';

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

      return {
        id: profileId,
        full_name: fullName,
        short_name: formatShortName(fullName),
        family_id: familyId,
        relationship: null,
        phone: phoneRaw != null ? String(phoneRaw).trim() || null : null,
      } satisfies MembersDirectoryEntry;
    })
    .filter((row): row is MembersDirectoryEntry => row !== null);

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

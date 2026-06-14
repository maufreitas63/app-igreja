import { formatProfileShortName, loadNomeFantasiaPreference } from '@/lib/profileDisplayName';
import { supabase } from '@/lib/supabase';

export type MembersDirectoryEntry = {
  id: string;
  full_name: string;
  nome_fantasia: string | null;
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

const mapDirectoryRows = (
  data: Array<Record<string, unknown>> | null | undefined
): MembersDirectoryEntry[] =>
  (data ?? [])
    .map((row) => {
      const profileId = String(row.profile_id ?? row.profileId ?? '').trim();
      const fullName = String(row.full_name ?? row.fullName ?? '').trim();
      const nomeFantasiaRaw = row.nome_fantasia ?? row.nomeFantasia;
      const nomeFantasia =
        nomeFantasiaRaw != null && String(nomeFantasiaRaw).trim() !== ''
          ? String(nomeFantasiaRaw).trim()
          : null;
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
        nome_fantasia: nomeFantasia,
        short_name: formatProfileShortName({ full_name: fullName, nome_fantasia: nomeFantasia }),
        family_id: familyId,
        relationship: null,
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

const fetchDirectoryFromRpc = async (
  rpcName: 'list_profiles_members_directory' | 'list_profiles_visitors_directory',
  missingRpcHint: string
): Promise<MembersDirectoryEntry[]> => {
  await loadNomeFantasiaPreference();

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

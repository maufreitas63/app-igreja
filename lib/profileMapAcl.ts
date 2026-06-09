import { supabase } from '@/lib/supabase';
import { coerceRpcBoolean, isSupabaseRpcMissingError } from '@/lib/supabaseRpc';

export type ProfileMapAclInfo = {
  profileId: string;
  isVisitantesOnly: boolean;
  roleLabel: string;
};

export type ProfileMapAclAvailability = 'ok' | 'legacy' | 'unavailable';

export type ProfileMapAclFetchResult = {
  info: Map<string, ProfileMapAclInfo>;
  availability: ProfileMapAclAvailability;
};

export const PROFILE_MAP_ACL_UNAVAILABLE = 'PROFILE_MAP_ACL_UNAVAILABLE';

const isNetworkFailure = (message: string) =>
  message.includes('failed to fetch') || message.includes('network');

export const fetchProfilesAclSyncFingerprint = async (): Promise<string> => {
  try {
    const { data, error } = await supabase.rpc('fetch_profiles_acl_sync_fingerprint');

    if (error) {
      const message = (error.message ?? '').toLowerCase();

      if (
        message.includes('fetch_profiles_acl_sync_fingerprint')
        && (message.includes('could not find') || message.includes('does not exist'))
      ) {
        return 'acl|missing';
      }

      if (isNetworkFailure(message)) {
        return 'acl|offline';
      }

      throw error;
    }

    return String(data ?? 'acl|none');
  } catch {
    return 'acl|offline';
  }
};

export const fetchProfilesMapAclInfo = async (): Promise<ProfileMapAclFetchResult> => {
  const { data, error } = await supabase.rpc('list_profiles_visitantes_only_flags');

  if (error) {
    const message = (error.message ?? '').toLowerCase();

    if (isSupabaseRpcMissingError(error, 'list_profiles_visitantes_only_flags')) {
      return { info: new Map(), availability: 'legacy' };
    }

    if (isNetworkFailure(message)) {
      return { info: new Map(), availability: 'unavailable' };
    }

    throw error;
  }

  const infoByProfileId = new Map<string, ProfileMapAclInfo>();

  for (const row of (data as Array<Record<string, unknown>> | null) ?? []) {
    const profileId = String(row.profile_id ?? row.profileId ?? '').trim();

    if (!profileId) {
      continue;
    }

    const isVisitantesOnly = coerceRpcBoolean(row.is_visitantes_only ?? row.isVisitantesOnly);
    const roleLabelRaw = String(row.role_label ?? row.roleLabel ?? '').trim();
    const roleLabel = roleLabelRaw || (isVisitantesOnly ? 'Visitante' : 'Membro');

    infoByProfileId.set(profileId, {
      profileId,
      isVisitantesOnly,
      roleLabel,
    });
  }

  return { info: infoByProfileId, availability: 'ok' };
};

/** @deprecated Use fetchProfilesMapAclInfo */
export const fetchProfilesVisitantesOnlyFlags = async (): Promise<Map<string, boolean>> => {
  const { info } = await fetchProfilesMapAclInfo();
  return new Map([...info.entries()].map(([profileId, row]) => [profileId, row.isVisitantesOnly]));
};

export const attachMapAclToProfiles = <T extends { id: string }>(
  profiles: T[],
  aclResult: ProfileMapAclFetchResult
): Array<T & { isVisitantesOnly: boolean; roleLabel: string }> => {
  if (aclResult.availability === 'unavailable') {
    const schemaError = new Error(PROFILE_MAP_ACL_UNAVAILABLE);
    schemaError.name = 'ProfileMapAclUnavailable';
    throw schemaError;
  }

  if (aclResult.availability === 'legacy') {
    return profiles.map((profile) => ({
      ...profile,
      isVisitantesOnly: false,
      roleLabel: 'Membro',
    }));
  }

  return profiles.map((profile) => {
    const info = aclResult.info.get(profile.id);

    return {
      ...profile,
      isVisitantesOnly: info?.isVisitantesOnly ?? false,
      roleLabel: info?.roleLabel ?? 'Membro',
    };
  });
};

/** @deprecated Use attachMapAclToProfiles */
export const attachVisitanteFlagsToProfiles = attachMapAclToProfiles;

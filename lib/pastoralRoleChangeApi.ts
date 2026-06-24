import { resolveActorProfileId } from '@/lib/maintenanceAccessControlApi';
import { supabase } from '@/lib/supabase';
import { isSupabaseRpcMissingError } from '@/lib/supabaseRpc';

export const PASTORAL_ROLE_CHANGE_SQL_HINT =
  'Execute no Supabase: scripts/access-control-pastoral-role-change-fix-protected-list.sql';

export const PASTORAL_BASIC_ROLE_OPTIONS = [
  { code: 'visitante', label: 'Visitante' },
  { code: 'congregado', label: 'Congregado' },
  { code: 'member', label: 'Membro' },
] as const;

export type PastoralBasicRoleCode = (typeof PASTORAL_BASIC_ROLE_OPTIONS)[number]['code'];

export type PastoralRoleChangeProfile = {
  id: string;
  fullName: string;
  phone: string | null;
  memberCode: string | null;
  membershipDate: string | null;
  membershipOut: string | null;
  ownMembershipDate: string | null;
  ownMembershipOut: string | null;
  familyId: string | null;
  membershipInherited: boolean;
  inheritedFromName: string | null;
  currentRoleCode: PastoralBasicRoleCode;
};

const parseBasicRoleCode = (value: unknown): PastoralBasicRoleCode => {
  const normalized = String(value ?? '').trim().toLowerCase();

  if (normalized === 'member' || normalized === 'congregado') {
    return normalized;
  }

  return 'visitante';
};

const parseProfileRows = (data: unknown): PastoralRoleChangeProfile[] => {
  if (!Array.isArray(data)) {
    return [];
  }

  return data
    .map((row) => {
      const record = row as Record<string, unknown>;
      const id = String(record.id ?? record.profile_id ?? record.profileId ?? '').trim();
      const fullName = String(record.full_name ?? record.fullName ?? '').trim();

      if (!id || !fullName) {
        return null;
      }

      return {
        id,
        fullName,
        phone: record.phone ? String(record.phone).trim() || null : null,
        memberCode: record.codigo_membro
          ? String(record.codigo_membro).trim() || null
          : record.memberCode
            ? String(record.memberCode).trim() || null
            : null,
        membershipDate: record.membership_date
          ? String(record.membership_date).trim() || null
          : record.membershipDate
            ? String(record.membershipDate).trim() || null
            : null,
        membershipOut: record.membership_out
          ? String(record.membership_out).trim() || null
          : record.membershipOut
            ? String(record.membershipOut).trim() || null
            : null,
        ownMembershipDate: record.own_membership_date
          ? String(record.own_membership_date).trim() || null
          : record.ownMembershipDate
            ? String(record.ownMembershipDate).trim() || null
            : null,
        ownMembershipOut: record.own_membership_out
          ? String(record.own_membership_out).trim() || null
          : record.ownMembershipOut
            ? String(record.ownMembershipOut).trim() || null
            : null,
        familyId: record.family_id
          ? String(record.family_id).trim() || null
          : record.familyId
            ? String(record.familyId).trim() || null
            : null,
        membershipInherited:
          record.membership_inherited === true || record.membershipInherited === true,
        inheritedFromName: record.inherited_from_name
          ? String(record.inherited_from_name).trim() || null
          : record.inheritedFromName
            ? String(record.inheritedFromName).trim() || null
            : null,
        currentRoleCode: parseBasicRoleCode(record.current_role_code ?? record.currentRoleCode),
      } satisfies PastoralRoleChangeProfile;
    })
    .filter((row): row is PastoralRoleChangeProfile => row !== null)
    .map((profile) => ({
      ...profile,
      ownMembershipDate: profile.ownMembershipDate ?? profile.membershipDate,
      ownMembershipOut: profile.ownMembershipOut ?? profile.membershipOut,
    }));
};

export async function sessionCanAccessPastoralRoleChangePanel() {
  const profileId = await resolveActorProfileId();

  if (!profileId) {
    return false;
  }

  const { data, error } = await supabase.rpc('profile_has_access', {
    p_profile_id: profileId,
    p_resource_type: 'screen',
    p_resource_key: 'maintenance.card.mudanca_papeis',
    p_action: 'view',
  });

  if (error) {
    if (isSupabaseRpcMissingError(error, 'profile_has_access')) {
      return false;
    }

    throw error;
  }

  return data === true;
}

export async function listProfilesForPastoralRoleChange(limit = 5000) {
  const actorProfileId = await resolveActorProfileId();

  if (!actorProfileId) {
    throw new Error('Sessão inválida. Saia e entre novamente.');
  }

  const { data, error } = await supabase.rpc('listar_perfis_mudanca_papel_pastoral', {
    p_actor_profile_id: actorProfileId,
    p_limit: limit,
  });

  if (error) {
    if (isSupabaseRpcMissingError(error, 'listar_perfis_mudanca_papel_pastoral')) {
      throw new Error(PASTORAL_ROLE_CHANGE_SQL_HINT);
    }

    throw error;
  }

  return parseProfileRows(data);
}

const normalizeSearchDigits = (value: string) => value.replace(/\D/g, '');

export const profileMatchesPastoralRoleChangeSearch = (
  profile: PastoralRoleChangeProfile,
  query: string
) => {
  const trimmed = query.trim().toLowerCase();

  if (!trimmed) {
    return true;
  }

  const digits = normalizeSearchDigits(trimmed);

  return (
    profile.fullName.toLowerCase().includes(trimmed)
    || (digits.length > 0 && normalizeSearchDigits(profile.phone ?? '').includes(digits))
    || (profile.memberCode?.toLowerCase().includes(trimmed) ?? false)
  );
};

export const profileMatchesPastoralRoleChangeRoleFilter = (
  profile: PastoralRoleChangeProfile,
  roleFilter: PastoralBasicRoleCode | null
) => roleFilter === null || profile.currentRoleCode === roleFilter;

export const profileHasEditableMembershipDates = (profile: PastoralRoleChangeProfile) =>
  profile.currentRoleCode === 'member'
  || (profile.currentRoleCode === 'congregado' && !profile.membershipInherited);

export const profileHasMembershipDateLink = (profile: PastoralRoleChangeProfile) =>
  profile.currentRoleCode === 'member' || profile.currentRoleCode === 'congregado';

export async function setPastoralBasicRoleForProfile(
  targetProfileId: string,
  roleCode: PastoralBasicRoleCode
) {
  const actorProfileId = await resolveActorProfileId();

  if (!actorProfileId) {
    return { success: false as const, message: 'Sessão inválida. Saia e entre novamente.' };
  }

  const { data, error } = await supabase.rpc('definir_papel_basico_perfil_pastoral', {
    p_actor_profile_id: actorProfileId,
    p_target_profile_id: targetProfileId,
    p_role_code: roleCode,
  });

  if (error) {
    if (isSupabaseRpcMissingError(error, 'definir_papel_basico_perfil_pastoral')) {
      throw new Error(PASTORAL_ROLE_CHANGE_SQL_HINT);
    }

    return { success: false as const, message: error.message || 'Não foi possível alterar o papel.' };
  }

  const record = (data ?? {}) as Record<string, unknown>;

  return {
    success: record.success === true,
    message: String(record.message ?? (record.success === true ? 'Papel atualizado.' : 'Não foi possível alterar o papel.')),
  } as const;
}

export async function updateProfileMembershipDate(
  targetProfileId: string,
  membershipDateIso: string | null,
  membershipOutIso: string | null
) {
  const actorProfileId = await resolveActorProfileId();

  if (!actorProfileId) {
    return { success: false as const, message: 'Sessão inválida. Saia e entre novamente.' };
  }

  const { data, error } = await supabase.rpc('atualizar_membership_date_perfil_pastoral', {
    p_actor_profile_id: actorProfileId,
    p_target_profile_id: targetProfileId,
    p_membership_date: membershipDateIso,
    p_membership_out: membershipOutIso,
  });

  if (error) {
    if (isSupabaseRpcMissingError(error, 'atualizar_membership_date_perfil_pastoral')) {
      throw new Error(PASTORAL_ROLE_CHANGE_SQL_HINT);
    }

    return {
      success: false as const,
      message: error.message || 'Não foi possível salvar a data de filiação.',
    };
  }

  const record = (data ?? {}) as Record<string, unknown>;
  const savedDate = record.membership_date ? String(record.membership_date) : null;
  const savedOutDate = record.membership_out ? String(record.membership_out) : null;

  return {
    success: record.success === true,
    message: String(
      record.message
        ?? (record.success === true ? 'Datas de membresia atualizadas.' : 'Não foi possível salvar as datas de membresia.')
    ),
    membershipDate: savedDate,
    membershipOut: savedOutDate,
  } as const;
}

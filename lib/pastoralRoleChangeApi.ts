import { resolveActorProfileId } from '@/lib/maintenanceAccessControlApi';
import { supabase } from '@/lib/supabase';
import { isSupabaseRpcMissingError } from '@/lib/supabaseRpc';

export const PASTORAL_ROLE_CHANGE_SQL_HINT =
  'Execute no Supabase: scripts/access-control-pastoral-role-change.sql';

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
      const id = String(record.id ?? '').trim();
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
        currentRoleCode: parseBasicRoleCode(record.current_role_code ?? record.currentRoleCode),
      } satisfies PastoralRoleChangeProfile;
    })
    .filter((row): row is PastoralRoleChangeProfile => row !== null);
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

export async function searchProfilesForPastoralRoleChange(query: string, limit = 30) {
  const actorProfileId = await resolveActorProfileId();

  if (!actorProfileId) {
    throw new Error('Sessão inválida. Saia e entre novamente.');
  }

  const { data, error } = await supabase.rpc('buscar_perfis_mudanca_papel_pastoral', {
    p_actor_profile_id: actorProfileId,
    p_query: query,
    p_limit: limit,
  });

  if (error) {
    if (isSupabaseRpcMissingError(error, 'buscar_perfis_mudanca_papel_pastoral')) {
      throw new Error(PASTORAL_ROLE_CHANGE_SQL_HINT);
    }

    throw error;
  }

  return parseProfileRows(data);
}

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

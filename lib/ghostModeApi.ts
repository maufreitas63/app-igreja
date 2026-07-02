import { coerceRpcBoolean, isSupabaseRpcMissing } from '@/lib/supabaseRpc';
import { supabase } from '@/lib/supabase';
import { mapProfileSearchRows } from '@/lib/profileSearchRow';
import type { AccessProfileSearchResult } from '@/lib/maintenanceAccessControlApi';
import { resolveRealSessionProfileId } from '@/lib/sessionProfile';

export const GHOST_MODE_AUDITOR_RESOURCE = 'maintenance.card.auditor';

export const GHOST_MODE_SQL_HINT =
  'Execute no Supabase: scripts/access-control-ghost-mode.sql e recarregue o schema (Settings → API).';

export type GhostModeProfileOption = AccessProfileSearchResult;

const parseGhostProfiles = (data: unknown): GhostModeProfileOption[] => mapProfileSearchRows(data);

export async function checkSessionCanOperateGhostMode(): Promise<boolean> {
  const realProfileId = await resolveRealSessionProfileId();

  if (!realProfileId) {
    return false;
  }

  const { data, error } = await supabase.rpc('can_operate_ghost_mode', {
    p_profile_id: realProfileId,
  });

  if (error) {
    if (isSupabaseRpcMissing(error.message ?? '', 'can_operate_ghost_mode')) {
      return false;
    }

    console.error('can_operate_ghost_mode:', error);
    return false;
  }

  return coerceRpcBoolean(data);
}

export async function listActiveProfilesForGhostMode(limit = 5000): Promise<GhostModeProfileOption[]> {
  const operatorProfileId = await resolveRealSessionProfileId();

  if (!operatorProfileId) {
    throw new Error('Sessão inválida. Saia e entre novamente.');
  }

  const { data, error } = await supabase.rpc('listar_perfis_ghost_mode', {
    p_operator_profile_id: operatorProfileId,
    p_limit: limit,
  });

  if (error) {
    if (isSupabaseRpcMissing(error.message ?? '', 'listar_perfis_ghost_mode')) {
      throw new Error(GHOST_MODE_SQL_HINT);
    }

    throw error;
  }

  return parseGhostProfiles(data);
}

export type GhostModeProfilePreviewRole = {
  roleId: string;
  roleCode: string;
  roleName: string;
};

export type GhostModeProfilePreview = {
  id: string;
  fullName: string | null;
  phone: string | null;
  memberCode: string | null;
  familyId: string | null;
  email: string | null;
  cpf: string | null;
  birthDate: string | null;
  membershipOut: string | null;
  lgpdAccepted: boolean | null;
  cep: string | null;
  addressStreet: string | null;
  addressNumber: string | null;
  addressNeighborhood: string | null;
  addressCity: string | null;
  addressState: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type GhostModeTargetPreview = {
  profile: GhostModeProfilePreview;
  roles: GhostModeProfilePreviewRole[];
  implicitVisitante: boolean;
};

const readOptionalString = (value: unknown) => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed || null;
};

const parseGhostTargetPreview = (data: unknown): GhostModeTargetPreview | null => {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const record = data as Record<string, unknown>;

  if (record.success !== true || !record.profile || typeof record.profile !== 'object') {
    return null;
  }

  const profileRecord = record.profile as Record<string, unknown>;
  const profileId = readOptionalString(profileRecord.id);

  if (!profileId) {
    return null;
  }

  const roles = Array.isArray(record.roles)
    ? record.roles
        .map((row) => {
          if (!row || typeof row !== 'object') {
            return null;
          }

          const roleRecord = row as Record<string, unknown>;
          const roleId = readOptionalString(roleRecord.role_id ?? roleRecord.roleId);
          const roleCode = readOptionalString(roleRecord.role_code ?? roleRecord.roleCode);
          const roleName = readOptionalString(roleRecord.role_name ?? roleRecord.roleName);

          if (!roleId || !roleCode || !roleName) {
            return null;
          }

          return {
            roleId,
            roleCode,
            roleName,
          } satisfies GhostModeProfilePreviewRole;
        })
        .filter((row): row is GhostModeProfilePreviewRole => row !== null)
    : [];

  return {
    profile: {
      id: profileId,
      fullName: readOptionalString(profileRecord.full_name),
      phone: readOptionalString(profileRecord.phone),
      memberCode: readOptionalString(profileRecord.codigo_membro),
      familyId: readOptionalString(profileRecord.family_id),
      email: readOptionalString(profileRecord.email),
      cpf: readOptionalString(profileRecord.cpf),
      birthDate: readOptionalString(profileRecord.birth_date),
      membershipOut: readOptionalString(profileRecord.membership_out),
      lgpdAccepted:
        profileRecord.lgpd_accepted === true
          ? true
          : profileRecord.lgpd_accepted === false
            ? false
            : null,
      cep: readOptionalString(profileRecord.cep),
      addressStreet: readOptionalString(profileRecord.address_street),
      addressNumber: readOptionalString(profileRecord.address_number),
      addressNeighborhood: readOptionalString(profileRecord.address_neighborhood),
      addressCity: readOptionalString(profileRecord.address_city),
      addressState: readOptionalString(profileRecord.address_state),
      createdAt: readOptionalString(profileRecord.created_at),
      updatedAt: readOptionalString(profileRecord.updated_at),
    },
    roles,
    implicitVisitante: record.implicit_visitante === true,
  };
};

export async function fetchGhostTargetProfilePreview(
  targetProfileId: string
): Promise<{ success: true; preview: GhostModeTargetPreview } | { success: false; message: string }> {
  const operatorProfileId = await resolveRealSessionProfileId();

  if (!operatorProfileId) {
    return { success: false, message: 'Sessão inválida. Saia e entre novamente.' };
  }

  const { data, error } = await supabase.rpc('obter_previa_perfil_ghost_mode', {
    p_operator_profile_id: operatorProfileId,
    p_target_profile_id: targetProfileId,
  });

  if (error) {
    if (isSupabaseRpcMissing(error.message ?? '', 'obter_previa_perfil_ghost_mode')) {
      return {
        success: false,
        message: `${GHOST_MODE_SQL_HINT} Inclua a função obter_previa_perfil_ghost_mode.`,
      };
    }

    return {
      success: false,
      message: error.message ?? 'Não foi possível carregar a prévia do perfil.',
    };
  }

  const record = (data ?? {}) as Record<string, unknown>;

  if (record.success !== true) {
    return {
      success: false,
      message:
        typeof record.message === 'string'
          ? record.message
          : 'Não foi possível carregar a prévia do perfil.',
    };
  }

  const preview = parseGhostTargetPreview(data);

  if (!preview) {
    return { success: false, message: 'Resposta inválida ao carregar a prévia do perfil.' };
  }

  return { success: true, preview };
}

export async function registerGhostModeAuditEvent(
  eventType: 'started' | 'ended',
  options: {
    targetProfileId?: string | null;
    targetFullName?: string | null;
    details?: Record<string, unknown>;
  } = {}
) {
  const operatorProfileId = await resolveRealSessionProfileId();

  if (!operatorProfileId) {
    return { success: false as const, message: 'Sessão inválida.' };
  }

  const { data, error } = await supabase.rpc('registrar_evento_ghost_mode', {
    p_operator_profile_id: operatorProfileId,
    p_event_type: eventType,
    p_target_profile_id: options.targetProfileId ?? null,
    p_details: {
      ...(options.details ?? {}),
      target_full_name: options.targetFullName ?? null,
    },
  });

  if (error) {
    if (isSupabaseRpcMissing(error.message ?? '', 'registrar_evento_ghost_mode')) {
      return { success: false as const, message: GHOST_MODE_SQL_HINT };
    }

    return {
      success: false as const,
      message: error.message ?? 'Não foi possível registrar auditoria do Modo Ghost.',
    };
  }

  const record = (data ?? {}) as Record<string, unknown>;

  return {
    success: record.success === true,
    message:
      typeof record.message === 'string'
        ? record.message
        : eventType === 'started'
          ? 'Modo Ghost iniciado.'
          : 'Modo Ghost encerrado.',
  };
}

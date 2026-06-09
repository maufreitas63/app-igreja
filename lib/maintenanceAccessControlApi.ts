import { accessRoleDisplayRank } from '@/lib/accessRoleDisplayOrder';
import { supabase } from '@/lib/supabase';
import { isSupabaseRpcMissing } from '@/lib/supabaseRpc';
import { getStoredProfileId, repairUserSessionReference } from '@/lib/userSession';

export { accessRoleDisplayRank } from '@/lib/accessRoleDisplayOrder';

export const MAINTENANCE_ACCESS_CONTROL_SQL_HINT =
  'Execute no Supabase: scripts/access-control-admin-rpc.sql; se faltar Congregado/Visitantes, scripts/access-control-congregado-visitantes-roles.sql; se o Card Financeiro não aparecer em Papéis, scripts/financial-module-access.sql';

export const EXPECTED_ACCESS_ROLE_CODES = ['congregado', 'visitantes'] as const;

/** Papéis de sistema usados só como fallback ACL — não aparecem na atribuição de perfil. */
export const ACCESS_ROLES_NOT_ASSIGNABLE_TO_PROFILE = ['visitantes'] as const;

export const isAssignableProfileRole = (roleCode: string) =>
  !ACCESS_ROLES_NOT_ASSIGNABLE_TO_PROFILE.includes(
    roleCode.trim().toLowerCase() as (typeof ACCESS_ROLES_NOT_ASSIGNABLE_TO_PROFILE)[number]
  );

export const MAINTENANCE_ACCESS_CONTROL_RPC_MISSING = 'MAINTENANCE_ACCESS_CONTROL_RPC_MISSING';

function sortRowsByRoleCode<T extends { code?: string; roleCode?: string; name?: string; roleName?: string }>(
  rows: T[]
): T[] {
  return [...rows].sort((left, right) => {
    const leftCode = (left.code ?? left.roleCode ?? '').trim().toLowerCase();
    const rightCode = (right.code ?? right.roleCode ?? '').trim().toLowerCase();
    const byOrder = accessRoleDisplayRank(leftCode) - accessRoleDisplayRank(rightCode);

    if (byOrder !== 0) {
      return byOrder;
    }

    const leftLabel = (left.name ?? left.roleName ?? leftCode).trim();
    const rightLabel = (right.name ?? right.roleName ?? rightCode).trim();

    return leftLabel.localeCompare(rightLabel, 'pt-BR');
  });
}

export type AccessRoleRecord = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
};

export type AccessProfileSearchResult = {
  id: string;
  fullName: string;
  phone: string | null;
  memberCode: string | null;
};

export type ProfileRoleAssignment = {
  roleId: string;
  roleCode: string;
  roleName: string;
  assigned: boolean;
};

export type RoleGrantRecord = {
  resourceId: string;
  resourceType: 'screen' | 'table' | 'column';
  resourceKey: string;
  label: string;
  canView: boolean;
  canUpdate: boolean;
  grantId: string | null;
};

export type AccessResourceTypeFilter = 'screen' | 'table' | 'column';

const throwRpcMissing = () => {
  const schemaError = new Error(MAINTENANCE_ACCESS_CONTROL_RPC_MISSING);
  schemaError.name = 'MaintenanceAccessControlRpcMissing';
  throw schemaError;
};

export async function resolveActorProfileId() {
  let profileId = await getStoredProfileId();

  if (!profileId) {
    profileId = await repairUserSessionReference();
  }

  return profileId;
}

export async function checkSessionIsSuperAdmin() {
  const profileId = await resolveActorProfileId();

  if (!profileId) {
    return false;
  }

  const { data, error } = await supabase.rpc('is_super_admin_profile', {
    p_profile_id: profileId,
  });

  if (error) {
    const message = (error.message ?? '').toLowerCase();

    if (isSupabaseRpcMissing(message, 'is_super_admin_profile')) {
      throwRpcMissing();
    }

    throw error;
  }

  return data === true;
}

const parseRoleRows = (data: unknown): AccessRoleRecord[] => {
  if (!Array.isArray(data)) {
    return [];
  }

  const rows = data
    .map((row) => {
      const record = row as Record<string, unknown>;
      const id = String(record.id ?? '').trim();
      const code = String(record.code ?? '').trim();
      const name = String(record.name ?? '').trim();

      if (!id || !code || !name) {
        return null;
      }

      return {
        id,
        code,
        name,
        description: record.description != null ? String(record.description) : null,
        isSystem: record.is_system === true || record.isSystem === true,
      } satisfies AccessRoleRecord;
    })
    .filter((row): row is AccessRoleRecord => row !== null);

  return sortRowsByRoleCode(rows);
};

const parseProfileSearchRows = (data: unknown): AccessProfileSearchResult[] => {
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
        phone: record.phone != null ? String(record.phone).trim() || null : null,
        memberCode: record.codigo_membro != null ? String(record.codigo_membro).trim() || null : null,
      } satisfies AccessProfileSearchResult;
    })
    .filter((row): row is AccessProfileSearchResult => row !== null);
};

const parseProfileRoleRows = (data: unknown): ProfileRoleAssignment[] => {
  if (!Array.isArray(data)) {
    return [];
  }

  const rows = data
    .map((row) => {
      const record = row as Record<string, unknown>;
      const roleId = String(record.role_id ?? record.roleId ?? '').trim();
      const roleCode = String(record.role_code ?? record.roleCode ?? '').trim();
      const roleName = String(record.role_name ?? record.roleName ?? '').trim();

      if (!roleId || !roleCode || !roleName) {
        return null;
      }

      return {
        roleId,
        roleCode,
        roleName,
        assigned: record.assigned === true,
      } satisfies ProfileRoleAssignment;
    })
    .filter((row): row is ProfileRoleAssignment => row !== null)
    .filter((row) => isAssignableProfileRole(row.roleCode));

  return sortRowsByRoleCode(rows);
};

const parseGrantRows = (data: unknown): RoleGrantRecord[] => {
  if (!Array.isArray(data)) {
    return [];
  }

  return data
    .map((row) => {
      const record = row as Record<string, unknown>;
      const resourceId = String(record.resource_id ?? record.resourceId ?? '').trim();
      const resourceType = String(record.resource_type ?? record.resourceType ?? '').trim();
      const resourceKey = String(record.resource_key ?? record.resourceKey ?? '').trim();
      const label = String(record.label ?? resourceKey).trim();

      if (!resourceId || !resourceType || !resourceKey) {
        return null;
      }

      if (resourceType !== 'screen' && resourceType !== 'table' && resourceType !== 'column') {
        return null;
      }

      return {
        resourceId,
        resourceType,
        resourceKey,
        label,
        canView: record.can_view === true || record.canView === true,
        canUpdate: record.can_update === true || record.canUpdate === true,
        grantId: record.grant_id != null ? String(record.grant_id) : record.grantId != null ? String(record.grantId) : null,
      } satisfies RoleGrantRecord;
    })
    .filter((row): row is RoleGrantRecord => row !== null);
};

const parseMutationResult = (data: unknown) => {
  const record = (data ?? {}) as Record<string, unknown>;
  const success = record.success === true;
  const message = String(record.message ?? (success ? 'Salvo.' : 'Não foi possível salvar.'));

  return { success, message } as const;
};

async function callAdminRpc<T>(functionName: string, params: Record<string, unknown>, parser: (data: unknown) => T) {
  const { data, error } = await supabase.rpc(functionName, params);

  if (error) {
    const message = (error.message ?? '').toLowerCase();

    if (isSupabaseRpcMissing(message, functionName)) {
      throwRpcMissing();
    }

    throw error;
  }

  return parser(data);
}

export async function listAccessRolesAdmin() {
  const actorProfileId = await resolveActorProfileId();

  if (!actorProfileId) {
    throw new Error('Sessão inválida. Saia e entre novamente.');
  }

  return callAdminRpc('listar_access_roles_admin', { p_actor_profile_id: actorProfileId }, parseRoleRows);
}

export async function searchProfilesForAccessAdmin(query: string, limit = 20) {
  const actorProfileId = await resolveActorProfileId();

  if (!actorProfileId) {
    throw new Error('Sessão inválida. Saia e entre novamente.');
  }

  return callAdminRpc(
    'buscar_perfis_access_admin',
    { p_actor_profile_id: actorProfileId, p_query: query, p_limit: limit },
    parseProfileSearchRows
  );
}

export async function listProfileRoleAssignments(targetProfileId: string) {
  const actorProfileId = await resolveActorProfileId();

  if (!actorProfileId) {
    throw new Error('Sessão inválida. Saia e entre novamente.');
  }

  return callAdminRpc(
    'listar_papeis_perfil_access_admin',
    { p_actor_profile_id: actorProfileId, p_target_profile_id: targetProfileId },
    parseProfileRoleRows
  );
}

export async function assignProfileRole(targetProfileId: string, roleCode: string) {
  const actorProfileId = await resolveActorProfileId();

  if (!actorProfileId) {
    return { success: false as const, message: 'Sessão inválida. Saia e entre novamente.' };
  }

  if (!isAssignableProfileRole(roleCode)) {
    return {
      success: false as const,
      message: 'Este papel é automático: perfis sem papéis são tratados como visitante.',
    };
  }

  const { data, error } = await supabase.rpc('atribuir_papel_perfil_access_admin', {
    p_actor_profile_id: actorProfileId,
    p_target_profile_id: targetProfileId,
    p_role_code: roleCode,
  });

  if (error) {
    const message = (error.message ?? '').toLowerCase();

    if (isSupabaseRpcMissing(message, 'atribuir_papel_perfil_access_admin')) {
      throwRpcMissing();
    }

    return { success: false as const, message: error.message || 'Não foi possível atribuir o papel.' };
  }

  return parseMutationResult(data);
}

export async function revokeProfileRole(targetProfileId: string, roleCode: string) {
  const actorProfileId = await resolveActorProfileId();

  if (!actorProfileId) {
    return { success: false as const, message: 'Sessão inválida. Saia e entre novamente.' };
  }

  const { data, error } = await supabase.rpc('revogar_papel_perfil_access_admin', {
    p_actor_profile_id: actorProfileId,
    p_target_profile_id: targetProfileId,
    p_role_code: roleCode,
  });

  if (error) {
    const message = (error.message ?? '').toLowerCase();

    if (isSupabaseRpcMissing(message, 'revogar_papel_perfil_access_admin')) {
      throwRpcMissing();
    }

    return { success: false as const, message: error.message || 'Não foi possível remover o papel.' };
  }

  return parseMutationResult(data);
}

export async function listRoleGrantsAdmin(roleCode: string, resourceType: AccessResourceTypeFilter) {
  const actorProfileId = await resolveActorProfileId();

  if (!actorProfileId) {
    throw new Error('Sessão inválida. Saia e entre novamente.');
  }

  return callAdminRpc(
    'listar_grants_recurso_papel_admin',
    {
      p_actor_profile_id: actorProfileId,
      p_role_code: roleCode,
      p_resource_type: resourceType,
    },
    parseGrantRows
  );
}

export async function saveRoleGrantAdmin(
  roleCode: string,
  resourceType: AccessResourceTypeFilter,
  resourceKey: string,
  canView: boolean,
  canUpdate: boolean
) {
  const actorProfileId = await resolveActorProfileId();

  if (!actorProfileId) {
    return { success: false as const, message: 'Sessão inválida. Saia e entre novamente.' };
  }

  const { data, error } = await supabase.rpc('salvar_grant_papel_admin', {
    p_actor_profile_id: actorProfileId,
    p_role_code: roleCode,
    p_resource_type: resourceType,
    p_resource_key: resourceKey,
    p_can_view: canView,
    p_can_update: canUpdate,
  });

  if (error) {
    const message = (error.message ?? '').toLowerCase();

    if (isSupabaseRpcMissing(message, 'salvar_grant_papel_admin')) {
      throwRpcMissing();
    }

    return { success: false as const, message: error.message || 'Não foi possível salvar a permissão.' };
  }

  return parseMutationResult(data);
}

export const isSensitiveAccessResourceKey = (resourceKey: string) =>
  resourceKey === 'profiles.cpf' || resourceKey === 'profiles.access_pin';

/** Indica se o recurso de tela pertence ao dashboard principal ou ao de manutenção. */
export type AccessGrantDashboardScope = 'main' | 'maintenance';

export const getAccessGrantDashboardScope = (
  resourceType: RoleGrantRecord['resourceType'],
  resourceKey: string
): AccessGrantDashboardScope | null => {
  if (resourceType !== 'screen') {
    return null;
  }

  const key = resourceKey.trim();

  if (key === '/dashboard' || key.startsWith('dashboard.card.')) {
    return 'main';
  }

  if (key === '/maintenance-dashboard' || key.startsWith('maintenance.card.') || key.startsWith('scale_type.')) {
    return 'maintenance';
  }

  return null;
};

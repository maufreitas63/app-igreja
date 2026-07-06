import { ACL_UNAVAILABLE_MESSAGE, isAclStrictMode } from '@/lib/aclPolicy';
import { getCachedOrFetch, invalidateAsyncCache } from '@/lib/asyncResultCache';
import { supabase } from '@/lib/supabase';
import { coerceRpcBoolean, isSupabaseRpcMissingError } from '@/lib/supabaseRpc';
import { resolveProfileIdByPhone } from '@/lib/resolveProfileByPhone';
import {
  getStoredUserPhone,
  persistProfileId,
  repairUserSessionReference,
} from '@/lib/userSession';
import { getGhostEffectiveProfileId, isGhostModeActive } from '@/lib/ghostMode';
import {
  fetchEffectiveProfileColumnAccess,
  shouldUseEffectiveProfileRpc,
} from '@/lib/effectiveProfileRpc';
import { resolveEffectiveProfileId, resolveRealSessionProfileId } from '@/lib/sessionProfile';
import { ACCESS_SCREEN } from '@/lib/accessScreen';

export { ACL_UNAVAILABLE_MESSAGE, isAclStrictMode } from '@/lib/aclPolicy';
export { ACCESS_SCREEN } from '@/lib/accessScreen';

export type AccessResourceType = 'screen' | 'table' | 'column';
export type AccessAction = 'view' | 'update';

export const ACCESS_DASHBOARD_CARD = {
  eventAlt: 'dashboard.card.event_alt',
  qr: 'dashboard.card.qr',
  kidsTeens: 'dashboard.card.kids_teens',
  offerings: 'dashboard.card.offerings',
  pastoral: 'dashboard.card.pastoral',
  membersList: 'dashboard.card.members_list',
  birthdays: 'dashboard.card.birthdays',
  financial: 'dashboard.card.financial',
  vigilanceScales: 'dashboard.card.vigilance_scales',
  parking: 'dashboard.card.parking_vehicle_v2',
  groupedManage: 'dashboard.card.grouped_manage',
  administrativo: 'dashboard.card.administrativo',
} as const;

/** `content` do carrossel → `resource_key` em `access_resources`. */
/** Recursos ACL do módulo financeiro (membros) — devem existir em `access_resources`. */
export const FINANCIAL_ACCESS_SCREEN_RESOURCE_KEYS = [
  ACCESS_DASHBOARD_CARD.financial,
  ACCESS_SCREEN.financial,
  ACCESS_SCREEN.expenseReport,
] as const;

export const DASHBOARD_CARD_CONTENT_TO_ACCESS_KEY: Record<string, string> = {
  event_alt: ACCESS_DASHBOARD_CARD.eventAlt,
  qr: ACCESS_DASHBOARD_CARD.qr,
  kids_teens: ACCESS_DASHBOARD_CARD.kidsTeens,
  offerings: ACCESS_DASHBOARD_CARD.offerings,
  pastoral: ACCESS_DASHBOARD_CARD.pastoral,
  members_list: ACCESS_DASHBOARD_CARD.membersList,
  birthdays: ACCESS_DASHBOARD_CARD.birthdays,
  financial: ACCESS_DASHBOARD_CARD.financial,
  vigilance_scales: ACCESS_DASHBOARD_CARD.vigilanceScales,
  scale_roster: ACCESS_DASHBOARD_CARD.vigilanceScales,
  parking_vehicle_v2: ACCESS_DASHBOARD_CARD.parking,
  grouped_manage: ACCESS_DASHBOARD_CARD.groupedManage,
  ministerial_profile: ACCESS_DASHBOARD_CARD.groupedManage,
  grouped_palette: ACCESS_DASHBOARD_CARD.groupedManage,
  administrativo: ACCESS_DASHBOARD_CARD.administrativo,
};

export type DashboardCardViewAccess = Record<string, boolean>;

/** Consulta `profile_has_access` para cada card do dashboard (view). */
export async function loadDashboardCardViewAccess(
  profileId: string,
  options?: { forceRefresh?: boolean }
): Promise<DashboardCardViewAccess> {
  if (await readOperatorIsSuperAdmin(options) || (await sessionIsSuperAdmin(profileId, options))) {
    return Object.fromEntries(
      Object.keys(DASHBOARD_CARD_CONTENT_TO_ACCESS_KEY).map((content) => [content, true] as const)
    );
  }

  return getCachedOrFetch(
    `dashboard:cards:${profileId}`,
    async () => {
      const entries = await Promise.all(
        Object.entries(DASHBOARD_CARD_CONTENT_TO_ACCESS_KEY).map(async ([content, resourceKey]) => {
          const allowed = await profileHasAccess(profileId, 'screen', resourceKey, 'view');
          return [content, allowed] as const;
        })
      );

      return Object.fromEntries(entries);
    },
    { scopeId: profileId, forceRefresh: options?.forceRefresh }
  );
}

export const isDashboardCardContentAllowed = (
  content: string,
  accessByContent: DashboardCardViewAccess
) => {
  if (content === 'parking_vehicle_v2') {
    return (
      accessByContent.parking_vehicle_v2 === true
      || accessByContent.vigilance_scales === true
    );
  }

  if (content === 'scale_roster') {
    return accessByContent.vigilance_scales === true || accessByContent.scale_roster === true;
  }

  if (content === 'ministerial_profile' || content === 'grouped_palette') {
    return accessByContent.grouped_manage === true || accessByContent[content] === true;
  }

  return accessByContent[content] === true;
};

/** Colunas de `profiles` editáveis em Dados cadastrais (`column:profiles.<campo>`). */
export const PROFILE_MANAGE_COLUMN_FIELDS = [
  'full_name',
  'phone',
  'birth_date',
  'email',
  'cpf',
  'cep',
  'address_street',
  'address_number',
  'address_complement',
  'address_neighborhood',
  'address_city',
  'address_state',
  'medical_food_alerts',
  'lgpd_accepted',
  'access_pin',
] as const;

export type ProfileColumnAccess = {
  view: Record<string, boolean>;
  update: Record<string, boolean>;
};

export const profileColumnResourceKey = (fieldKey: string) => `profiles.${fieldKey}`;

export const isProfileColumnAccessLoaded = (access: ProfileColumnAccess) =>
  Object.keys(access.view).length > 0;

/** Consulta `profile_has_access` para colunas do perfil (view e update). */
export async function loadProfileColumnAccess(
  profileId: string,
  options?: { forceRefresh?: boolean }
): Promise<ProfileColumnAccess> {
  if (shouldUseEffectiveProfileRpc()) {
    const sessionAccess = await fetchEffectiveProfileColumnAccess();

    if (sessionAccess) {
      return sessionAccess;
    }
  }

  if (await readOperatorIsSuperAdmin(options)) {
    const allGranted = Object.fromEntries(
      PROFILE_MANAGE_COLUMN_FIELDS.map((field) => [field, true] as const)
    );

    return {
      view: { ...allGranted },
      update: { ...allGranted },
    };
  }

  if (await sessionIsSuperAdmin(profileId, options)) {
    const allGranted = Object.fromEntries(
      PROFILE_MANAGE_COLUMN_FIELDS.map((field) => [field, true] as const)
    );

    return {
      view: { ...allGranted },
      update: { ...allGranted },
    };
  }

  return getCachedOrFetch(
    `profile:columns:${profileId}`,
    async () => {
      const viewEntries = await Promise.all(
        PROFILE_MANAGE_COLUMN_FIELDS.map(async (field) => {
          const allowed = await profileHasAccess(
            profileId,
            'column',
            profileColumnResourceKey(field),
            'view'
          );
          return [field, allowed] as const;
        })
      );

      const updateEntries = await Promise.all(
        PROFILE_MANAGE_COLUMN_FIELDS.map(async (field) => {
          const allowed = await profileHasAccess(
            profileId,
            'column',
            profileColumnResourceKey(field),
            'update'
          );
          return [field, allowed] as const;
        })
      );

      return {
        view: Object.fromEntries(viewEntries),
        update: Object.fromEntries(updateEntries),
      };
    },
    { scopeId: profileId, forceRefresh: options?.forceRefresh }
  );
}

export const canViewProfileColumn = (fieldKey: string, access: ProfileColumnAccess) => {
  if (!isProfileColumnAccessLoaded(access)) {
    return false;
  }

  return access.view[fieldKey] === true;
};

export const canUpdateProfileColumn = (fieldKey: string, access: ProfileColumnAccess) => {
  if (!isProfileColumnAccessLoaded(access)) {
    return false;
  }

  return access.update[fieldKey] === true;
};

const isAccessRpcMissing = (error: { code?: string; message?: string } | null) =>
  isSupabaseRpcMissingError(error, 'profile_has_access');

/** Super admin do operador real (ignora Modo Ghost). */
const readOperatorIsSuperAdminUncached = async () => {
  if (isGhostModeActive()) {
    return false;
  }

  const phone = (await getStoredUserPhone())?.trim() || null;

  if (phone) {
    await repairUserSessionReference(phone);
  }

  let profileId = await resolveRealSessionProfileId();

  if (!profileId) {
    return false;
  }

  let isSuperAdmin = await readSessionIsSuperAdmin(profileId);

  if (!isSuperAdmin && phone) {
    const loginProfileId = await resolveProfileIdByPhone(phone);

    if (loginProfileId && loginProfileId !== profileId) {
      await persistProfileId(loginProfileId);
      profileId = loginProfileId;
      isSuperAdmin = await readSessionIsSuperAdmin(loginProfileId);
    }
  }

  return isSuperAdmin;
};

const readOperatorIsSuperAdmin = (options?: { forceRefresh?: boolean }) =>
  getCachedOrFetch('operator:super_admin', readOperatorIsSuperAdminUncached, {
    forceRefresh: options?.forceRefresh,
    ttlMs: 120_000,
  });

/** API pública para bypass de ACL do operador real (fora do Modo Ghost). */
export async function checkOperatorIsSuperAdmin(options?: { forceRefresh?: boolean }) {
  return readOperatorIsSuperAdmin(options);
}

/** Limpa cache de super_admin após login/logout para não bloquear o gate app_ativo. */
export function invalidateOperatorSuperAdminCache() {
  invalidateAsyncCache('operator:super_admin');
  invalidateAsyncCache('session:super_admin');
}

const readSessionIsSuperAdmin = async (profileId?: string | null): Promise<boolean> => {
  let resolvedId = profileId?.trim() ?? (await resolveRealSessionProfileId());

  if (!resolvedId) {
    resolvedId = await repairUserSessionReference();
  }

  if (!resolvedId) {
    return false;
  }

  const { data, error } = await supabase.rpc('is_super_admin_profile', {
    p_profile_id: resolvedId,
  });

  if (error) {
    if (isSupabaseRpcMissingError(error, 'is_super_admin_profile')) {
      return false;
    }

    console.error('is_super_admin_profile:', error);
    return false;
  }

  return coerceRpcBoolean(data);
};

const sessionIsSuperAdmin = (scopeId?: string | null, options?: { forceRefresh?: boolean }) => {
  const cacheScope =
    scopeId?.trim()
    ?? (isGhostModeActive() ? getGhostEffectiveProfileId() : null)
    ?? 'session';

  return getCachedOrFetch('session:super_admin', () => readSessionIsSuperAdmin(scopeId), {
    scopeId: cacheScope,
    forceRefresh: options?.forceRefresh,
  });
};

/** Verifica se a RPC `profile_has_access` está instalada no Supabase. */
export async function getAccessControlRpcStatus(): Promise<'available' | 'missing'> {
  return getCachedOrFetch(
    'acl:rpc:profile_has_access',
    async () => {
      const { error } = await supabase.rpc('profile_has_access', {
        p_profile_id: null,
        p_resource_type: 'screen',
        p_resource_key: ACCESS_SCREEN.dashboard,
        p_action: 'view',
      });

      if (isAccessRpcMissing(error)) {
        return 'missing';
      }

      return 'available';
    },
    { ttlMs: 300_000 }
  );
}

/**
 * - RPC ausente + modo estrito (`EXPO_PUBLIC_ACL_STRICT=true`): nega acesso.
 * - RPC ausente + modo legado: concede acesso até o SQL de ACL ser aplicado.
 * - RPC presente com erro (rede, sessão, banco): nega acesso (fail-closed).
 * - Sem erro: respeita o boolean retornado pelo Supabase.
 */
const coerceAccessResult = (
  data: boolean | null | undefined,
  error: { code?: string; message?: string } | null
) => {
  if (error) {
    if (isAccessRpcMissing(error)) {
      return !isAclStrictMode();
    }

    console.error('profile_has_access:', error);
    return false;
  }

  return coerceRpcBoolean(data);
};

async function fetchProfileHasAccess(
  profileId: string,
  resourceType: AccessResourceType,
  resourceKey: string,
  action: AccessAction
): Promise<boolean> {
  const { data, error } = await supabase.rpc('profile_has_access', {
    p_profile_id: profileId,
    p_resource_type: resourceType,
    p_resource_key: resourceKey,
    p_action: action,
  });

  return coerceAccessResult(data as boolean | null | undefined, error);
}

export async function profileHasAccess(
  profileId: string | null | undefined,
  resourceType: AccessResourceType,
  resourceKey: string,
  action: AccessAction = 'view',
  options?: { skipCache?: boolean; forceRefresh?: boolean }
): Promise<boolean> {
  const trimmed = profileId?.trim() ?? null;

  if (!trimmed) {
    return false;
  }

  if (await readOperatorIsSuperAdmin(options)) {
    return true;
  }

  if (await sessionIsSuperAdmin(trimmed, options)) {
    return true;
  }

  if (options?.skipCache) {
    return fetchProfileHasAccess(trimmed, resourceType, resourceKey, action);
  }

  return getCachedOrFetch(
    `acl:${trimmed}:${resourceType}:${resourceKey}:${action}`,
    () => fetchProfileHasAccess(trimmed, resourceType, resourceKey, action),
    { scopeId: trimmed, forceRefresh: options?.forceRefresh }
  );
}

export async function profileHasAccessByPhone(
  phone: string | null | undefined,
  resourceType: AccessResourceType,
  resourceKey: string,
  action: AccessAction = 'view'
): Promise<boolean> {
  if (!phone?.trim()) {
    return false;
  }

  const { data, error } = await supabase.rpc('profile_has_access_by_phone', {
    p_phone: phone.trim(),
    p_resource_type: resourceType,
    p_resource_key: resourceKey,
    p_action: action,
  });

  return coerceAccessResult(data as boolean | null | undefined, error);
}

/** Resolve `profile_id` da sessão ou pelo telefone e consulta permissão. */
/** Limpa caches de ACL após mudanças de papéis ou grants. */
export function invalidateAccessControlCache(options?: {
  profileId?: string | null;
  allProfiles?: boolean;
}) {
  invalidateAsyncCache('maintenance:dashboard:access');
  invalidateAsyncCache('family_reception:pending');
  invalidateAsyncCache('session:super_admin');
  invalidateAsyncCache('operator:super_admin');

  if (options?.allProfiles || !options?.profileId?.trim()) {
    invalidateAsyncCache('acl:');
    invalidateAsyncCache('dashboard:cards:');
    invalidateAsyncCache('dashboard:screens:');
    invalidateAsyncCache('profile:columns:');
    return;
  }

  const trimmed = options.profileId.trim();
  invalidateAsyncCache(`acl:${trimmed}`);
  invalidateAsyncCache(`dashboard:cards:${trimmed}`);
  invalidateAsyncCache(`dashboard:screens:${trimmed}`);
  invalidateAsyncCache(`profile:columns:${trimmed}`);
}

export async function sessionHasAccess(
  resourceType: AccessResourceType,
  resourceKey: string,
  action: AccessAction = 'view'
): Promise<boolean> {
  const profileId = await resolveEffectiveProfileId();

  if (profileId) {
    if (await readOperatorIsSuperAdmin()) {
      return true;
    }

    if (isGhostModeActive() && (await sessionIsSuperAdmin(profileId))) {
      return true;
    }

    return profileHasAccess(profileId, resourceType, resourceKey, action);
  }

  const phone = await getStoredUserPhone();

  if (phone?.trim()) {
    return profileHasAccessByPhone(phone, resourceType, resourceKey, action);
  }

  return profileHasAccess(null, resourceType, resourceKey, action);
}

/** Tesoureiro e super_admin podem publicar/editar eventos em datas passadas. */
export async function sessionCanBypassEventPastDateLock(): Promise<boolean> {
  const { data, error } = await supabase.rpc('session_can_bypass_event_past_date_lock');

  if (error) {
    if (isSupabaseRpcMissingError(error, 'session_can_bypass_event_past_date_lock')) {
      return false;
    }

    console.error('session_can_bypass_event_past_date_lock:', error);
    return false;
  }

  return coerceRpcBoolean(data);
}

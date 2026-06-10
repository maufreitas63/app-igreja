import { ACL_UNAVAILABLE_MESSAGE, isAclStrictMode } from '@/lib/aclPolicy';
import { supabase } from '@/lib/supabase';
import { coerceRpcBoolean, isSupabaseRpcMissingError } from '@/lib/supabaseRpc';
import { getStoredProfileId, repairUserSessionReference } from '@/lib/userSession';

export { ACL_UNAVAILABLE_MESSAGE, isAclStrictMode } from '@/lib/aclPolicy';

export type AccessResourceType = 'screen' | 'table' | 'column';
export type AccessAction = 'view' | 'update';

/** Telas (rotas) usadas no app — alinhado a `access_resources` no Supabase. */
export const ACCESS_SCREEN = {
  login: '/',
  register: '/register',
  dashboard: '/dashboard',
  maintenance: '/maintenance-dashboard',
  manageProfile: '/manage-profile',
  manageMembers: '/manage-members',
  pastoral: '/pastoral',
  pastoralHistory: '/pastoral-history',
  financial: '/financial',
  expenseReport: '/expense-report',
  mapGeolocation: '/mapa-geolocalizacao',
  lgpd: '/lgpd',
} as const;

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
};

export type DashboardCardViewAccess = Record<string, boolean>;

/** Consulta `profile_has_access` para cada card do dashboard (view). */
export async function loadDashboardCardViewAccess(
  profileId: string
): Promise<DashboardCardViewAccess> {
  const entries = await Promise.all(
    Object.entries(DASHBOARD_CARD_CONTENT_TO_ACCESS_KEY).map(async ([content, resourceKey]) => {
      const allowed = await profileHasAccess(profileId, 'screen', resourceKey, 'view');
      return [content, allowed] as const;
    })
  );

  return Object.fromEntries(entries);
}

/** Cards do dashboard que permanecem visíveis independentemente de eventos ou ACL. */
export const DASHBOARD_ALWAYS_VISIBLE_CARD_CONTENTS = new Set(['offerings']);

export const isDashboardCardAlwaysVisible = (content: string) =>
  DASHBOARD_ALWAYS_VISIBLE_CARD_CONTENTS.has(content);

export const isDashboardCardContentAllowed = (
  content: string,
  accessByContent: DashboardCardViewAccess
) => {
  if (isDashboardCardAlwaysVisible(content)) {
    return true;
  }

  if (content === 'parking_vehicle_v2') {
    return (
      accessByContent.parking_vehicle_v2 === true
      || accessByContent.vigilance_scales === true
    );
  }

  if (content === 'scale_roster') {
    return accessByContent.vigilance_scales === true || accessByContent.scale_roster === true;
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
export async function loadProfileColumnAccess(profileId: string): Promise<ProfileColumnAccess> {
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

/** Verifica se a RPC `profile_has_access` está instalada no Supabase. */
export async function getAccessControlRpcStatus(): Promise<'available' | 'missing'> {
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

export async function profileHasAccess(
  profileId: string | null | undefined,
  resourceType: AccessResourceType,
  resourceKey: string,
  action: AccessAction = 'view'
): Promise<boolean> {
  const trimmed = profileId?.trim() ?? null;

  const { data, error } = await supabase.rpc('profile_has_access', {
    p_profile_id: trimmed,
    p_resource_type: resourceType,
    p_resource_key: resourceKey,
    p_action: action,
  });

  return coerceAccessResult(data as boolean | null | undefined, error);
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
export async function sessionHasAccess(
  resourceType: AccessResourceType,
  resourceKey: string,
  action: AccessAction = 'view'
): Promise<boolean> {
  let profileId = await getStoredProfileId();

  if (!profileId) {
    profileId = await repairUserSessionReference();
  }

  return profileHasAccess(profileId ?? null, resourceType, resourceKey, action);
}

import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearEntityPrefixCache } from '@/lib/entityPrefix';
import { clearAppParameterCache } from '@/lib/appParameters';
import { isSupabaseRpcMissingError } from '@/lib/supabaseRpc';
import { supabase } from '@/lib/supabase';

export const USER_TENANT_ID_STORAGE_KEY = 'user_tenant_id';
export const USER_TENANT_BRANDING_STORAGE_KEY = 'user_tenant_branding';
/** Código da igreja vindo do QR / deep link (`?igreja=IBEP`). */
export const PREFERRED_IGREJA_CODE_STORAGE_KEY = 'preferred_igreja_code';

export async function persistPreferredIgrejaCode(code: string | null | undefined) {
  const normalized = code?.trim().toUpperCase() || null;
  if (normalized) {
    await AsyncStorage.setItem(PREFERRED_IGREJA_CODE_STORAGE_KEY, normalized);
  } else {
    await AsyncStorage.removeItem(PREFERRED_IGREJA_CODE_STORAGE_KEY);
  }
}

export async function getPreferredIgrejaCode(): Promise<string | null> {
  const raw = (await AsyncStorage.getItem(PREFERRED_IGREJA_CODE_STORAGE_KEY))?.trim();
  return raw ? raw.toUpperCase() : null;
}

/** Lê `?igreja=` da URL (web) e persiste para selecionar a instância após o login. */
export async function capturePreferredIgrejaCodeFromLocation(
  param?: string | string[] | null
): Promise<string | null> {
  let fromParam = '';
  if (typeof param === 'string') {
    fromParam = param;
  } else if (Array.isArray(param)) {
    fromParam = param[0] ?? '';
  }

  let fromQuery = '';
  if (typeof window !== 'undefined' && window.location?.search) {
    fromQuery = new URLSearchParams(window.location.search).get('igreja') ?? '';
  }

  const code = (fromParam || fromQuery).trim().toUpperCase();
  if (!code) {
    return getPreferredIgrejaCode();
  }

  await persistPreferredIgrejaCode(code);
  return code;
}

export type SessionIgreja = {
  id: string;
  code: string;
  name: string;
  logo_url: string | null;
  website_url: string | null;
  instagram_url: string | null;
  youtube_url: string | null;
  cnpj: string | null;
  pix_institution: string | null;
  pix_key: string | null;
  is_active: boolean;
  is_primary: boolean;
  is_linked: boolean;
};

export type ActiveIgrejaBranding = {
  id: string;
  code: string;
  name: string;
  logo_url: string | null;
};

function mapSessionIgreja(row: Record<string, unknown> | null | undefined): SessionIgreja | null {
  const id = row?.id == null ? '' : String(row.id).trim();
  if (!id) return null;
  const asText = (value: unknown) => {
    if (value == null) return '';
    const text = String(value).trim();
    return text;
  };
  const logoRaw = asText(row?.logo_url);
  const webRaw = asText(row?.website_url);
  const igRaw = asText(row?.instagram_url);
  const ytRaw = asText(row?.youtube_url);
  const cnpjRaw = asText(row?.cnpj);
  const pixInstRaw = asText(row?.pix_institution);
  const pixKeyRaw = asText(row?.pix_key);
  return {
    id,
    code: asText(row?.code),
    name: asText(row?.name),
    logo_url: logoRaw || null,
    website_url: webRaw || null,
    instagram_url: igRaw || null,
    youtube_url: ytRaw || null,
    cnpj: cnpjRaw || null,
    pix_institution: pixInstRaw || null,
    pix_key: pixKeyRaw || null,
    is_active: row?.is_active === false ? false : true,
    is_primary: Boolean(row?.is_primary),
    is_linked: Boolean(row?.is_linked),
  };
}

export async function getStoredTenantId(): Promise<string | null> {
  const raw = (await AsyncStorage.getItem(USER_TENANT_ID_STORAGE_KEY))?.trim();
  return raw || null;
}

type ActiveTenantListener = (tenantId: string | null) => void;
const activeTenantListeners = new Set<ActiveTenantListener>();

/** Notifica consumidores (ex.: EntityPrefixProvider) quando a instância ativa muda. */
export function subscribeActiveTenantChange(listener: ActiveTenantListener): () => void {
  activeTenantListeners.add(listener);
  return () => {
    activeTenantListeners.delete(listener);
  };
}

function notifyActiveTenantChange(tenantId: string | null) {
  for (const listener of activeTenantListeners) {
    try {
      listener(tenantId);
    } catch (error) {
      console.error('Erro em listener de tenant ativo:', error);
    }
  }
}

function invalidateTenantScopedCaches() {
  clearEntityPrefixCache();
  clearAppParameterCache();
}

export async function persistTenantId(
  tenantId: string | null | undefined,
  options?: { notify?: boolean }
) {
  const id = tenantId?.trim() || null;
  const previous = await getStoredTenantId();
  const shouldNotify = options?.notify !== false;

  if (id) {
    await AsyncStorage.setItem(USER_TENANT_ID_STORAGE_KEY, id);
  } else {
    await AsyncStorage.removeItem(USER_TENANT_ID_STORAGE_KEY);
  }

  if (previous !== id) {
    invalidateTenantScopedCaches();
    if (shouldNotify) {
      notifyActiveTenantChange(id);
    }
  }
}

export async function persistActiveIgrejaBranding(
  church: Pick<SessionIgreja, 'id' | 'code' | 'name' | 'logo_url'>,
  options?: { notify?: boolean }
) {
  const nextId = church.id.trim();
  const previousTenant = await getStoredTenantId();
  const previousBranding = await getStoredActiveIgrejaBranding();
  const nextLogo = church.logo_url?.trim() || null;
  const nextPayload: ActiveIgrejaBranding = {
    id: nextId,
    code: church.code,
    name: church.name,
    logo_url: nextLogo,
  };

  await persistTenantId(nextId, { notify: false });
  await AsyncStorage.setItem(USER_TENANT_BRANDING_STORAGE_KEY, JSON.stringify(nextPayload));

  const changed =
    previousTenant !== nextId
    || previousBranding?.id !== nextPayload.id
    || previousBranding?.code !== nextPayload.code
    || previousBranding?.name !== nextPayload.name
    || previousBranding?.logo_url !== nextPayload.logo_url;

  // Evita loop: resolveActiveIgrejaBranding / logo não devem re-notificar a cada leitura.
  if (changed && options?.notify !== false) {
    notifyActiveTenantChange(nextId);
  }
}

export async function getStoredActiveIgrejaBranding(): Promise<ActiveIgrejaBranding | null> {
  const raw = await AsyncStorage.getItem(USER_TENANT_BRANDING_STORAGE_KEY);
  if (!raw?.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<ActiveIgrejaBranding>;
    const id = typeof parsed.id === 'string' ? parsed.id.trim() : '';
    if (!id) {
      return null;
    }
    return {
      id,
      code: typeof parsed.code === 'string' ? parsed.code.trim() : '',
      name: typeof parsed.name === 'string' ? parsed.name.trim() : '',
      logo_url: typeof parsed.logo_url === 'string' && parsed.logo_url.trim() ? parsed.logo_url.trim() : null,
    };
  } catch {
    return null;
  }
}

/** Branding da instância ativa (storage + refresh via list_session_igrejas). */
export async function resolveActiveIgrejaBranding(): Promise<ActiveIgrejaBranding | null> {
  const stored = await getStoredActiveIgrejaBranding();
  const tenantId = (await getStoredTenantId()) || stored?.id || null;

  try {
    const churches = await listSessionIgrejas();
    const match =
      (tenantId ? churches.find((church) => church.id === tenantId) : null)
      ?? churches.find((church) => church.is_primary)
      ?? churches[0]
      ?? null;

    if (match) {
      // Persistência silenciosa — não dispara listeners (evita piscar o logo).
      await persistActiveIgrejaBranding(match, { notify: false });
      return {
        id: match.id,
        code: match.code,
        name: match.name,
        logo_url: match.logo_url,
      };
    }
  } catch {
    // Mantém o cache local se a rede/RPC falhar.
  }

  return stored;
}

export async function clearTenantId() {
  const previous = await getStoredTenantId();
  await AsyncStorage.multiRemove([USER_TENANT_ID_STORAGE_KEY, USER_TENANT_BRANDING_STORAGE_KEY]);
  if (previous) {
    invalidateTenantScopedCaches();
    notifyActiveTenantChange(null);
  }
}

function coerceSessionIgrejaRows(data: unknown): SessionIgreja[] {
  if (!Array.isArray(data)) {
    return [];
  }
  return data
    .map((row) => mapSessionIgreja(row as Record<string, unknown>))
    .filter((row): row is SessionIgreja => row != null);
}

function rpcErrorMessage(error: unknown): string {
  if (!error) return '';
  if (typeof error === 'string') return error.trim();
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message.trim();
  }
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  return '';
}

export async function listSessionIgrejas(): Promise<SessionIgreja[]> {
  const { data, error } = await supabase.rpc('list_session_igrejas');
  if (error) {
    throw error;
  }
  return coerceSessionIgrejaRows(data);
}

/** Lista admin (ativas + bloqueadas). Requer super_admin + scripts 22–24. */
export async function listAdminIgrejas(): Promise<SessionIgreja[]> {
  const errors: string[] = [];

  try {
    const { data, error } = await supabase.rpc('list_admin_igrejas');
    if (error) {
      errors.push(rpcErrorMessage(error) || 'list_admin_igrejas');
    } else {
      const rows = coerceSessionIgrejaRows(data);
      if (rows.length > 0) {
        return rows;
      }
    }
  } catch (error) {
    errors.push(rpcErrorMessage(error) || 'list_admin_igrejas');
  }

  try {
    const rows = await listSessionIgrejas();
    if (rows.length > 0 || errors.length === 0) {
      return rows;
    }
  } catch (error) {
    errors.push(rpcErrorMessage(error) || 'list_session_igrejas');
  }

  if (errors.length > 0) {
    throw new Error(
      errors.filter(Boolean).join(' | ')
        || 'Não foi possível listar as igrejas. Execute scripts/multi-tenant-24-list-igrejas-fix.sql no Supabase.'
    );
  }

  return [];
}

/** Precisa escolher igreja? (>1 disponível) */
export async function shouldPromptTenantSelection(): Promise<boolean> {
  const churches = await listSessionIgrejas();
  return churches.length > 1;
}

export async function activateSessionTenant(
  tenantId: string,
  churchHint?: Pick<SessionIgreja, 'id' | 'code' | 'name' | 'logo_url'> | null
): Promise<{ success: boolean; message: string }> {
  const id = tenantId.trim();
  if (!id) {
    return { success: false, message: 'Igreja não informada.' };
  }

  const { data, error } = await supabase.rpc('set_session_active_tenant', {
    p_tenant_id: id,
  });

  if (error) {
    return { success: false, message: error.message || 'Falha ao ativar igreja.' };
  }

  const success = data?.success === true;
  if (success) {
    try {
      // Preferir o card já carregado — evita listSessionIgrejas extra em dados móveis.
      if (churchHint && churchHint.id.trim() === id) {
        await persistActiveIgrejaBranding(churchHint);
      } else {
        await persistTenantId(id, { notify: false });
        const churches = await listSessionIgrejas();
        const church = churches.find((row) => row.id === id);
        if (church) {
          await persistActiveIgrejaBranding(church);
        } else {
          notifyActiveTenantChange(id);
        }
      }
    } catch {
      await persistTenantId(id);
    }
  }

  return {
    success,
    message: typeof data?.message === 'string' ? data.message : success ? 'Ok' : 'Falha.',
  };
}

export async function onboardIgrejaAdmin(code: string, name: string, logoUrl?: string | null) {
  const trimmedCode = code.trim();
  const trimmedName = name.trim();
  const trimmedLogo = logoUrl?.trim() || null;

  if (trimmedCode.length < 2 || trimmedCode.length > 12) {
    return {
      success: false,
      message: 'Código deve ter entre 2 e 12 caracteres.',
    };
  }

  if (trimmedName.length < 3) {
    return {
      success: false,
      message: 'Informe o nome da igreja (mínimo 3 caracteres).',
    };
  }

  const payload = {
    p_code: trimmedCode,
    p_name: trimmedName,
    p_logo_url: trimmedLogo,
  };

  // Nome único (criar_igreja_admin) — evita ambiguidade PostgREST de onboard_igreja_admin
  const { data, error } = await supabase.rpc('criar_igreja_admin', payload);

  if (error) {
    if (isSupabaseRpcMissingError(error, 'criar_igreja_admin')) {
      return {
        success: false,
        message:
          'RPC ausente. Execute scripts/multi-tenant-19-app-parameters-tenant-unique-fix.sql no Supabase.',
      };
    }

    const message =
      typeof error.message === 'string' && error.message.trim()
        ? error.message.trim()
        : 'Não foi possível criar a instância.';

    if (/could not choose the best candidate function/i.test(message)) {
      return {
        success: false,
        message:
          'Função ambígua no banco. Execute scripts/multi-tenant-18-criar-igreja-admin.sql.',
      };
    }

    if (/multi-tenant-12|multi-tenant-19|app_parameters_pkey|Conflito ao copiar parâmetros|Conflito de unicidade/i.test(message)) {
      return {
        success: false,
        message: /app_parameters_pkey/i.test(message)
          ? 'PK global em app_parameters. Execute scripts/multi-tenant-20-app-parameters-surrogate-pk.sql no Supabase.'
          : 'Conflito em app_parameters. Execute scripts/multi-tenant-20-app-parameters-surrogate-pk.sql (não o 12/19).',
      };
    }

    return { success: false, message };
  }

  const result = data as {
    success?: boolean;
    message?: string;
    tenant_id?: string;
    code?: string;
    name?: string;
    logo_url?: string | null;
  };

    if (
      result &&
      result.success === false &&
      typeof result.message === 'string' &&
      /multi-tenant-12|multi-tenant-19|app_parameters_pkey|Conflito ao copiar parâmetros|Conflito de unicidade/i.test(
        result.message
      )
    ) {
      return {
        ...result,
        message:
          /app_parameters_pkey/i.test(result.message)
            ? 'PK global em app_parameters. Execute scripts/multi-tenant-20-app-parameters-surrogate-pk.sql no Supabase.'
            : 'Conflito em app_parameters. Execute scripts/multi-tenant-20-app-parameters-surrogate-pk.sql (não o 12/19).',
      };
    }

  return result;
}

export async function setIgrejaSocialLinksAdmin(
  tenantId: string,
  websiteUrl: string | null | undefined,
  instagramUrl: string | null | undefined,
  youtubeUrl: string | null | undefined
) {
  const { data, error } = await supabase.rpc('set_igreja_social_links_admin', {
    p_tenant_id: tenantId.trim(),
    p_website_url: websiteUrl?.trim() || null,
    p_instagram_url: instagramUrl?.trim() || null,
    p_youtube_url: youtubeUrl?.trim() || null,
  });

  if (error) {
    if (isSupabaseRpcMissingError(error, 'set_igreja_social_links_admin')) {
      return {
        success: false as const,
        message:
          'RPC ausente. Execute scripts/multi-tenant-16-igreja-website-url.sql no Supabase.',
      };
    }
    return {
      success: false as const,
      message: error.message?.trim() || 'Não foi possível salvar os links.',
    };
  }

  return data as {
    success?: boolean;
    message?: string;
    website_url?: string | null;
    instagram_url?: string | null;
    youtube_url?: string | null;
  };
}

export async function setIgrejaOfferingsAdmin(
  tenantId: string,
  cnpj: string | null | undefined,
  pixInstitution: string | null | undefined,
  pixKey: string | null | undefined
) {
  const { data, error } = await supabase.rpc('set_igreja_offerings_admin', {
    p_tenant_id: tenantId.trim(),
    p_cnpj: cnpj?.trim() || null,
    p_pix_institution: pixInstitution?.trim() || null,
    p_pix_key: pixKey?.trim() || null,
  });

  if (error) {
    if (isSupabaseRpcMissingError(error, 'set_igreja_offerings_admin')) {
      return {
        success: false as const,
        message:
          'RPC ausente. Execute scripts/multi-tenant-21-igreja-offerings-pix.sql no Supabase.',
      };
    }
    return {
      success: false as const,
      message: error.message?.trim() || 'Não foi possível salvar os dados de ofertas.',
    };
  }

  return data as {
    success?: boolean;
    message?: string;
    cnpj?: string | null;
    pix_institution?: string | null;
    pix_key?: string | null;
  };
}

export async function setIgrejaActiveAdmin(tenantId: string, isActive: boolean) {
  const { data, error } = await supabase.rpc('set_igreja_active_admin', {
    p_tenant_id: tenantId.trim(),
    p_is_active: isActive,
  });

  if (error) {
    if (isSupabaseRpcMissingError(error, 'set_igreja_active_admin')) {
      return {
        success: false as const,
        message:
          'RPC ausente. Execute scripts/multi-tenant-22-igreja-block-delete.sql no Supabase.',
      };
    }
    return {
      success: false as const,
      message: error.message?.trim() || 'Não foi possível atualizar o acesso.',
    };
  }

  return data as {
    success?: boolean;
    message?: string;
    is_active?: boolean;
  };
}

export async function deleteIgrejaAdmin(tenantId: string, confirmCode: string) {
  const { data, error } = await supabase.rpc('delete_igreja_admin', {
    p_tenant_id: tenantId.trim(),
    p_confirm_code: confirmCode.trim(),
  });

  if (error) {
    if (isSupabaseRpcMissingError(error, 'delete_igreja_admin')) {
      return {
        success: false as const,
        message:
          'RPC ausente. Execute scripts/multi-tenant-22-igreja-block-delete.sql no Supabase.',
      };
    }
    return {
      success: false as const,
      message: error.message?.trim() || 'Não foi possível excluir a instância.',
    };
  }

  return data as {
    success?: boolean;
    message?: string;
  };
}

export const buildSelecionarIgrejaRoute = (phone: string) => ({
  pathname: '/selecionar-igreja' as const,
  params: {
    phone: encodeURIComponent(phone),
  },
});

import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearEntityPrefixCache } from '@/lib/entityPrefix';
import { clearAppParameterCache } from '@/lib/appParameters';
import { isSupabaseRpcMissingError } from '@/lib/supabaseRpc';
import { supabase } from '@/lib/supabase';

export const USER_TENANT_ID_STORAGE_KEY = 'user_tenant_id';
export const USER_TENANT_BRANDING_STORAGE_KEY = 'user_tenant_branding';

export type SessionIgreja = {
  id: string;
  code: string;
  name: string;
  logo_url: string | null;
  website_url: string | null;
  instagram_url: string | null;
  youtube_url: string | null;
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
  const id = typeof row?.id === 'string' ? row.id.trim() : '';
  if (!id) return null;
  const logoRaw = typeof row?.logo_url === 'string' ? row.logo_url.trim() : '';
  const webRaw = typeof row?.website_url === 'string' ? row.website_url.trim() : '';
  const igRaw = typeof row?.instagram_url === 'string' ? row.instagram_url.trim() : '';
  const ytRaw = typeof row?.youtube_url === 'string' ? row.youtube_url.trim() : '';
  return {
    id,
    code: String(row?.code ?? '').trim(),
    name: String(row?.name ?? '').trim(),
    logo_url: logoRaw || null,
    website_url: webRaw || null,
    instagram_url: igRaw || null,
    youtube_url: ytRaw || null,
    is_primary: Boolean(row?.is_primary),
    is_linked: Boolean(row?.is_linked),
  };
}

export async function getStoredTenantId(): Promise<string | null> {
  const raw = (await AsyncStorage.getItem(USER_TENANT_ID_STORAGE_KEY))?.trim();
  return raw || null;
}

export async function persistTenantId(tenantId: string | null | undefined) {
  const id = tenantId?.trim();
  if (id) {
    await AsyncStorage.setItem(USER_TENANT_ID_STORAGE_KEY, id);
    return;
  }
  await AsyncStorage.removeItem(USER_TENANT_ID_STORAGE_KEY);
}

export async function persistActiveIgrejaBranding(
  church: Pick<SessionIgreja, 'id' | 'code' | 'name' | 'logo_url'>
) {
  await persistTenantId(church.id);
  const payload: ActiveIgrejaBranding = {
    id: church.id,
    code: church.code,
    name: church.name,
    logo_url: church.logo_url?.trim() || null,
  };
  await AsyncStorage.setItem(USER_TENANT_BRANDING_STORAGE_KEY, JSON.stringify(payload));
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
      await persistActiveIgrejaBranding(match);
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
  await AsyncStorage.multiRemove([USER_TENANT_ID_STORAGE_KEY, USER_TENANT_BRANDING_STORAGE_KEY]);
}

export async function listSessionIgrejas(): Promise<SessionIgreja[]> {
  const { data, error } = await supabase.rpc('list_session_igrejas');
  if (error) {
    throw error;
  }
  if (!Array.isArray(data)) {
    return [];
  }
  return data
    .map((row) => mapSessionIgreja(row as Record<string, unknown>))
    .filter((row): row is SessionIgreja => row != null);
}

/** Precisa escolher igreja? (>1 disponível) */
export async function shouldPromptTenantSelection(): Promise<boolean> {
  const churches = await listSessionIgrejas();
  return churches.length > 1;
}

export async function activateSessionTenant(tenantId: string): Promise<{ success: boolean; message: string }> {
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
    await persistTenantId(id);
    try {
      const churches = await listSessionIgrejas();
      const church = churches.find((row) => row.id === id);
      if (church) {
        await persistActiveIgrejaBranding(church);
      }
    } catch {
      // tenant id já persistido; branding pode ser resolvido depois
    }
    clearEntityPrefixCache();
    clearAppParameterCache();
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
          'RPC ausente. Execute scripts/multi-tenant-18-criar-igreja-admin.sql no Supabase.',
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

    return { success: false, message };
  }

  return data as {
    success?: boolean;
    message?: string;
    tenant_id?: string;
    code?: string;
    name?: string;
    logo_url?: string | null;
  };
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

export const buildSelecionarIgrejaRoute = (phone: string) => ({
  pathname: '/selecionar-igreja' as const,
  params: {
    phone: encodeURIComponent(phone),
  },
});

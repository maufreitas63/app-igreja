import AsyncStorage from '@react-native-async-storage/async-storage';
import { normalizeOptionalHttpsUrl } from '@/lib/socialUrl';
import { supabase } from '@/lib/supabase';
import { isSupabaseRpcMissingError } from '@/lib/supabaseRpc';

export const EXIT_WEBSITE_REDIRECT_STORAGE_KEY = 'exit_website_redirect_settings';

export type ExitWebsiteRedirectSettings = {
  /** Igreja à qual esta preferência pertence. */
  tenantId: string | null;
  enabled: boolean;
  websiteUrl: string | null;
};

function asSettings(raw: unknown): ExitWebsiteRedirectSettings | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }

  const row = raw as Record<string, unknown>;
  const tenantId =
    typeof row.tenantId === 'string' && row.tenantId.trim()
      ? row.tenantId.trim()
      : null;
  const websiteUrl = normalizeOptionalHttpsUrl(
    typeof row.websiteUrl === 'string' ? row.websiteUrl : null
  );

  return {
    tenantId,
    enabled: row.enabled === true && Boolean(websiteUrl),
    websiteUrl,
  };
}

export async function persistExitWebsiteRedirectSettings(
  settings: ExitWebsiteRedirectSettings
): Promise<void> {
  const websiteUrl = normalizeOptionalHttpsUrl(settings.websiteUrl);
  const tenantId = settings.tenantId?.trim() || null;
  const payload: ExitWebsiteRedirectSettings = {
    tenantId,
    // Só redireciona com flag ligada E URL preenchida, sempre da mesma igreja.
    enabled: settings.enabled === true && Boolean(websiteUrl) && Boolean(tenantId),
    websiteUrl: settings.enabled === true ? websiteUrl : null,
  };
  await AsyncStorage.setItem(EXIT_WEBSITE_REDIRECT_STORAGE_KEY, JSON.stringify(payload));
}

export async function getStoredExitWebsiteRedirectSettings(): Promise<ExitWebsiteRedirectSettings | null> {
  const raw = await AsyncStorage.getItem(EXIT_WEBSITE_REDIRECT_STORAGE_KEY);
  if (!raw?.trim()) {
    return null;
  }

  try {
    return asSettings(JSON.parse(raw));
  } catch {
    return null;
  }
}

export async function clearExitWebsiteRedirectSettings(): Promise<void> {
  await AsyncStorage.removeItem(EXIT_WEBSITE_REDIRECT_STORAGE_KEY);
}

async function fetchSessionExitWebsiteRedirect(): Promise<ExitWebsiteRedirectSettings | null> {
  const { getStoredTenantId } = await import('@/lib/tenantSession');
  const tenantId = (await getStoredTenantId())?.trim() || null;

  try {
    const { data, error } = await supabase.rpc('get_session_exit_website_redirect');
    if (error) {
      if (isSupabaseRpcMissingError(error, 'get_session_exit_website_redirect')) {
        return {
          tenantId,
          enabled: false,
          websiteUrl: null,
        };
      }
      return null;
    }

    const row =
      data && typeof data === 'object' && !Array.isArray(data)
        ? (data as Record<string, unknown>)
        : null;
    const websiteUrl = normalizeOptionalHttpsUrl(
      typeof row?.website_url === 'string' ? row.website_url : null
    );
    const enabled = row?.enabled === true && Boolean(websiteUrl);

    return {
      tenantId,
      enabled,
      websiteUrl: enabled ? websiteUrl : null,
    };
  } catch {
    return null;
  }
}

/**
 * URL do site oficial para redirecionar no Sair.
 * Só retorna valor se a instância ATIVA tiver «Ao sair» ligado e URL preenchida.
 * Cache local sem tenant (legado) ou de outra igreja é ignorado.
 */
export async function resolveExitWebsiteRedirectUrl(): Promise<string | null> {
  const { getStoredTenantId } = await import('@/lib/tenantSession');
  const tenantId = (await getStoredTenantId())?.trim() || null;

  if (!tenantId) {
    await clearExitWebsiteRedirectSettings();
    return null;
  }

  // Fonte de verdade: RPC da sessão atual (não reaproveita cache de outra igreja).
  const sessionSettings = await fetchSessionExitWebsiteRedirect();
  if (sessionSettings) {
    await persistExitWebsiteRedirectSettings({
      tenantId,
      enabled: sessionSettings.enabled,
      websiteUrl: sessionSettings.websiteUrl,
    });

    if (sessionSettings.enabled && sessionSettings.websiteUrl) {
      return sessionSettings.websiteUrl;
    }

    return null;
  }

  const stored = await getStoredExitWebsiteRedirectSettings();
  if (
    stored?.tenantId === tenantId
    && stored.enabled
    && stored.websiteUrl
  ) {
    return stored.websiteUrl;
  }

  return null;
}

/** Atualiza cache local a partir da igreja ativa (website + flag). */
export async function syncExitWebsiteRedirectCache(options?: {
  tenantId?: string | null;
  enabled?: boolean | null;
  websiteUrl?: string | null;
}): Promise<void> {
  const { getStoredTenantId } = await import('@/lib/tenantSession');
  const activeTenantId = (await getStoredTenantId())?.trim() || null;
  const tenantId = options?.tenantId?.trim() || activeTenantId;

  if (!tenantId) {
    await clearExitWebsiteRedirectSettings();
    return;
  }

  if (typeof options?.enabled === 'boolean') {
    // Só grava no cache se for a instância ativa — evita “vazar” URL de outra igreja.
    if (activeTenantId && tenantId !== activeTenantId) {
      return;
    }

    await persistExitWebsiteRedirectSettings({
      tenantId,
      enabled: options.enabled,
      websiteUrl: options.websiteUrl ?? null,
    });
    return;
  }

  await resolveExitWebsiteRedirectUrl();
}

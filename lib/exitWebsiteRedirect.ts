import AsyncStorage from '@react-native-async-storage/async-storage';
import { normalizeOptionalHttpsUrl } from '@/lib/socialUrl';
import { supabase } from '@/lib/supabase';
import { isSupabaseRpcMissingError } from '@/lib/supabaseRpc';

export const EXIT_WEBSITE_REDIRECT_STORAGE_KEY = 'exit_website_redirect_settings';

export type ExitWebsiteRedirectSettings = {
  enabled: boolean;
  websiteUrl: string | null;
};

export async function persistExitWebsiteRedirectSettings(
  settings: ExitWebsiteRedirectSettings
): Promise<void> {
  const websiteUrl = normalizeOptionalHttpsUrl(settings.websiteUrl);
  const payload: ExitWebsiteRedirectSettings = {
    enabled: settings.enabled === true && Boolean(websiteUrl),
    websiteUrl,
  };
  await AsyncStorage.setItem(EXIT_WEBSITE_REDIRECT_STORAGE_KEY, JSON.stringify(payload));
}

export async function getStoredExitWebsiteRedirectSettings(): Promise<ExitWebsiteRedirectSettings | null> {
  const raw = await AsyncStorage.getItem(EXIT_WEBSITE_REDIRECT_STORAGE_KEY);
  if (!raw?.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<ExitWebsiteRedirectSettings>;
    const websiteUrl = normalizeOptionalHttpsUrl(
      typeof parsed.websiteUrl === 'string' ? parsed.websiteUrl : null
    );
    return {
      enabled: parsed.enabled === true && Boolean(websiteUrl),
      websiteUrl,
    };
  } catch {
    return null;
  }
}

export async function clearExitWebsiteRedirectSettings(): Promise<void> {
  await AsyncStorage.removeItem(EXIT_WEBSITE_REDIRECT_STORAGE_KEY);
}

/** Preferência da instância ativa para redirecionar ao site oficial no Sair. */
export async function resolveExitWebsiteRedirectUrl(): Promise<string | null> {
  const stored = await getStoredExitWebsiteRedirectSettings();
  if (stored?.enabled && stored.websiteUrl) {
    return stored.websiteUrl;
  }

  try {
    const { data, error } = await supabase.rpc('get_session_exit_website_redirect');
    if (error) {
      if (isSupabaseRpcMissingError(error, 'get_session_exit_website_redirect')) {
        return null;
      }
      return null;
    }

    const row =
      data && typeof data === 'object' && !Array.isArray(data)
        ? (data as Record<string, unknown>)
        : null;
    const enabled = row?.enabled === true;
    const websiteUrl = normalizeOptionalHttpsUrl(
      typeof row?.website_url === 'string' ? row.website_url : null
    );

    if (!enabled || !websiteUrl) {
      return null;
    }

    await persistExitWebsiteRedirectSettings({ enabled: true, websiteUrl });
    return websiteUrl;
  } catch {
    return null;
  }
}

/** Atualiza cache local a partir da igreja ativa (website + flag). */
export async function syncExitWebsiteRedirectCache(options?: {
  enabled?: boolean | null;
  websiteUrl?: string | null;
}): Promise<void> {
  if (options && typeof options.enabled === 'boolean') {
    await persistExitWebsiteRedirectSettings({
      enabled: options.enabled,
      websiteUrl: options.websiteUrl ?? null,
    });
    return;
  }

  const { getStoredTenantId } = await import('@/lib/tenantSession');
  const tenantId = await getStoredTenantId();
  if (!tenantId) {
    await clearExitWebsiteRedirectSettings();
    return;
  }

  await resolveExitWebsiteRedirectUrl();
}

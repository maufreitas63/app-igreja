import { getAppParameterValue } from '@/lib/appParameters';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

function stripTrailingSlash(url: string) {
  return url.replace(/\/+$/, '');
}

/**
 * Resolve a URL pública da instância ativa para deep links / QR Code.
 * Prefere parâmetros por tenant; no web cai no origin atual (subdomínio da instância).
 */
export async function resolveInstancePublicUrl(): Promise<string | null> {
  const fromApp = (await getAppParameterValue('app_public_url'))?.trim();
  if (fromApp) {
    return stripTrailingSlash(fromApp);
  }

  const fromMedia = (await getAppParameterValue('media_authorization_app_url'))?.trim();
  if (fromMedia) {
    return stripTrailingSlash(fromMedia);
  }

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const origin = window.location?.origin?.trim();
    if (origin && /^https?:\/\//i.test(origin)) {
      return stripTrailingSlash(origin);
    }
  }

  const linkingUrl = Linking.createURL('/').trim();
  if (/^https?:\/\//i.test(linkingUrl)) {
    return stripTrailingSlash(linkingUrl);
  }

  return null;
}

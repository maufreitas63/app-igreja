import { getAppParameterValue } from '@/lib/appParameters';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

/** Base pública de produção (Cloudflare Pages). */
export const DEFAULT_PRODUCTION_APP_URL = 'https://app-igreja.pages.dev';

function stripTrailingSlash(url: string) {
  return url.replace(/\/+$/, '');
}

function normalizeCandidate(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) {
    return null;
  }

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(withProtocol);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return null;
    }
    return stripTrailingSlash(parsed.toString());
  } catch {
    return null;
  }
}

/** URLs que não abrem em celular de visitantes (dev, placeholder, rede privada). */
export function isUsablePublicAppUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') {
      return false;
    }

    const host = parsed.hostname.toLowerCase();
    if (
      host === 'localhost'
      || host === '127.0.0.1'
      || host === '0.0.0.0'
      || host.endsWith('.local')
      || host.includes('seu-app')
      || host.includes('seu-dominio')
      || host.includes('example.com')
      || host.includes('example.org')
    ) {
      return false;
    }

    if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

function firstUsable(candidates: Array<string | null | undefined>): string | null {
  for (const candidate of candidates) {
    const normalized = normalizeCandidate(candidate);
    if (normalized && isUsablePublicAppUrl(normalized)) {
      return normalized;
    }
  }
  return null;
}

/**
 * Monta a URL compartilhável da instância (`?igreja=IBEP`).
 * Sempre HTTPS público — nunca localhost nem placeholder.
 */
export function buildInstanceShareUrl(
  baseUrl: string,
  churchCode?: string | null
): string {
  const base = stripTrailingSlash(baseUrl);
  const code = churchCode?.trim().toUpperCase();
  if (!code) {
    return base;
  }

  const url = new URL(base);
  url.searchParams.set('igreja', code);
  return url.toString();
}

/**
 * Resolve a URL pública da instância ativa para QR Code / deep link.
 * Ordem: env → app_public_url → media_authorization_app_url → origin web → produção.
 * Descarta localhost e placeholders para o celular conseguir abrir o app.
 */
export async function resolveInstancePublicUrl(options?: {
  churchCode?: string | null;
}): Promise<string | null> {
  const fromEnv = process.env.EXPO_PUBLIC_APP_URL?.trim() || null;
  const fromApp = (await getAppParameterValue('app_public_url'))?.trim() || null;
  const fromMedia = (await getAppParameterValue('media_authorization_app_url'))?.trim() || null;

  let fromOrigin: string | null = null;
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    fromOrigin = window.location?.origin?.trim() || null;
  }

  let fromLinking: string | null = null;
  try {
    const linkingUrl = Linking.createURL('/').trim();
    if (/^https?:\/\//i.test(linkingUrl)) {
      fromLinking = linkingUrl;
    }
  } catch {
    fromLinking = null;
  }

  const base =
    firstUsable([fromEnv, fromApp, fromMedia, fromOrigin, fromLinking, DEFAULT_PRODUCTION_APP_URL])
    ?? DEFAULT_PRODUCTION_APP_URL;

  return buildInstanceShareUrl(base, options?.churchCode);
}

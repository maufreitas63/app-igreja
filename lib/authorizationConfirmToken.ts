import { Platform } from 'react-native';

const TOKEN_HEX_LENGTH = 64;

export function normalizeAuthorizationConfirmToken(value: string | null | undefined): string | null {
  if (!value?.trim()) {
    return null;
  }

  let decoded = value.trim();

  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    // mantém valor original
  }

  const hex = decoded.replace(/[^a-fA-F0-9]/g, '').toLowerCase();

  if (hex.length < TOKEN_HEX_LENGTH) {
    return null;
  }

  return hex.slice(0, TOKEN_HEX_LENGTH);
}

export function readAuthorizationConfirmTokenFromWeb(): string | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return null;
  }

  const searchToken = new URLSearchParams(window.location.search).get('token');
  const hashQuery = window.location.hash.includes('?')
    ? window.location.hash.slice(window.location.hash.indexOf('?') + 1)
    : '';
  const hashToken = hashQuery ? new URLSearchParams(hashQuery).get('token') : null;

  return normalizeAuthorizationConfirmToken(searchToken ?? hashToken);
}

export function resolveAuthorizationConfirmToken(
  paramToken: string | string[] | undefined
): string | null {
  const fromParams = normalizeAuthorizationConfirmToken(
    Array.isArray(paramToken) ? paramToken[0] : paramToken
  );

  if (fromParams) {
    return fromParams;
  }

  return readAuthorizationConfirmTokenFromWeb();
}

import { Platform } from 'react-native';

export const AUTHORIZATION_TOKEN_HEX_LENGTH = 64;

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

  if (hex.length < AUTHORIZATION_TOKEN_HEX_LENGTH) {
    return null;
  }

  return hex.slice(0, AUTHORIZATION_TOKEN_HEX_LENGTH);
}

export function readRawAuthorizationTokenFromWeb(): string | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return null;
  }

  const fromSearch = new URLSearchParams(window.location.search).get('token');
  if (fromSearch?.trim()) {
    return fromSearch.trim();
  }

  const hashQuery = window.location.hash.includes('?')
    ? window.location.hash.slice(window.location.hash.indexOf('?') + 1)
    : '';
  const fromHash = hashQuery ? new URLSearchParams(hashQuery).get('token') : null;
  if (fromHash?.trim()) {
    return fromHash.trim();
  }

  const match = window.location.href.match(/[?&]token=([^&#]+)/i);
  if (!match?.[1]) {
    return null;
  }

  try {
    return decodeURIComponent(match[1]).trim();
  } catch {
    return match[1].trim();
  }
}

export function readAuthorizationConfirmTokenFromWeb(): string | null {
  return normalizeAuthorizationConfirmToken(readRawAuthorizationTokenFromWeb());
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

export function describeInvalidAuthorizationToken(rawToken: string | null | undefined): string {
  if (!rawToken?.trim()) {
    return 'Link inválido ou incompleto. Copie o link inteiro do e-mail ou solicite um novo envio pelo aplicativo.';
  }

  if (rawToken.includes('teste-diagnostico') || rawToken.includes('teste')) {
    return 'Este link é só do teste de envio (script 03) e não confirma autorização. Envie pelo aplicativo e use o e-mail novo com token longo.';
  }

  const hexLength = rawToken.replace(/[^a-fA-F0-9]/g, '').length;

  if (hexLength < AUTHORIZATION_TOKEN_HEX_LENGTH) {
    return `Link incompleto (token com ${hexLength} caracteres; esperado ${AUTHORIZATION_TOKEN_HEX_LENGTH}). Copie o link inteiro do e-mail ou solicite novo envio.`;
  }

  return 'Link inválido ou incompleto. Solicite um novo envio pelo aplicativo.';
}

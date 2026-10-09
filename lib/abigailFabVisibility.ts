/**
 * A home do membro é `/(tabs)`. O grupo some da URL, então o pathname
 * também fica `/` — igual à tela de login (`app/index.tsx`).
 * A diferença está nos segmentos: login `[]`, início `['(tabs)']`.
 */
const PRE_AUTH_SEGMENTS = new Set([
  'index',
  'register',
  'forgot-password',
  'selecionar-igreja',
  'configurar',
  'sessao-encerrada',
  'totem-checkin',
  'agenda-cancelar',
  'cracha-visitante',
  'alianca-indicacao',
]);

const PRE_AUTH_PATHS = new Set([
  '/',
  '/index',
  '/register',
  '/forgot-password',
  '/selecionar-igreja',
  '/configurar',
  '/sessao-encerrada',
  '/totem-checkin',
  '/agenda-cancelar',
  '/cracha-visitante',
  '/alianca-indicacao',
]);

let preAuthScreenFocused = false;
const preAuthListeners = new Set<() => void>();

export function setPreAuthScreenFocused(focused: boolean) {
  if (preAuthScreenFocused === focused) {
    return;
  }

  preAuthScreenFocused = focused;
  preAuthListeners.forEach((listener) => listener());
}

export function isPreAuthScreenFocused() {
  return preAuthScreenFocused;
}

export function subscribePreAuthScreenFocused(listener: () => void) {
  preAuthListeners.add(listener);
  return () => {
    preAuthListeners.delete(listener);
  };
}

export function isAbigailFabRouteAllowed(pathname: string, segments: readonly string[]): boolean {
  const root = segments[0] ?? '';

  if (root === '(tabs)') {
    return true;
  }

  if (!root || PRE_AUTH_SEGMENTS.has(root)) {
    return false;
  }

  const normalized = pathname.replace(/\/+$/, '') || '/';

  if (PRE_AUTH_PATHS.has(normalized)) {
    return false;
  }

  return true;
}

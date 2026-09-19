/**
 * Janela em que o menu lateral está navegando.
 * No web o Modal do RN chama history.back() ao fechar; o Expo Router trata isso
 * como voltar e desfaz Perfil/Ghost. Interceptamos o popstate na captura.
 */
const DRAWER_NAV_WINDOW_MS = 2500;

let drawerNavUntil = 0;
let pendingDestination: string | null = null;
let captureInstalled = false;

function currentHref() {
  if (typeof window === 'undefined') {
    return null;
  }

  return `${window.location.pathname}${window.location.search}`;
}

function restorePendingDestination() {
  if (typeof window === 'undefined') {
    return;
  }

  const href = pendingDestination || currentHref();
  if (!href) {
    return;
  }

  try {
    window.history.pushState({ drawerNav: true }, '', href);
  } catch {
    // ignore
  }
}

function onPopStateCapture(event: PopStateEvent) {
  if (!isDrawerNavigationPending()) {
    return;
  }

  event.stopImmediatePropagation();
  restorePendingDestination();
}

function ensureCaptureListener() {
  if (captureInstalled || typeof window === 'undefined') {
    return;
  }

  captureInstalled = true;
  window.addEventListener('popstate', onPopStateCapture, true);
}

export function installDrawerNavigationCapture() {
  ensureCaptureListener();
}

export function markDrawerNavigation(destinationHref?: string | null) {
  ensureCaptureListener();
  drawerNavUntil = Date.now() + DRAWER_NAV_WINDOW_MS;

  if (destinationHref?.trim()) {
    pendingDestination = destinationHref.trim();
    return;
  }

  pendingDestination = currentHref();
}

export function isDrawerNavigationPending() {
  return Date.now() < drawerNavUntil;
}

export function pinDrawerDestinationFromLocation() {
  markDrawerNavigation();
}

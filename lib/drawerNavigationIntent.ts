import { ghostBlocksHomeBounce, isMemberHomeHref } from '@/lib/ghostNavigation';

/**
 * Janela em que o menu lateral está navegando.
 * Não regrava o histórico para o Início — isso desfaz Perfil/Ghost.
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
  if (typeof window === 'undefined' || ghostBlocksHomeBounce()) {
    return;
  }

  const href = pendingDestination;
  if (!href || isMemberHomeHref(href)) {
    return;
  }

  try {
    window.history.pushState({ drawerNav: true }, '', href);
  } catch {
    // ignore
  }
}

function onPopStateCapture(event: PopStateEvent) {
  if (ghostBlocksHomeBounce() || !isDrawerNavigationPending()) {
    return;
  }

  if (!pendingDestination || isMemberHomeHref(pendingDestination)) {
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

  const next = destinationHref?.trim() || null;
  if (next && !isMemberHomeHref(next)) {
    pendingDestination = next;
  }
}

export function isDrawerNavigationPending() {
  return Date.now() < drawerNavUntil;
}

export function pinDrawerDestinationFromLocation() {
  const href = currentHref();
  if (href && !isMemberHomeHref(href)) {
    markDrawerNavigation(href);
    return;
  }

  markDrawerNavigation();
}

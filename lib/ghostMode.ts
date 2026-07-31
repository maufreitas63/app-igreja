/**
 * Modo Ghost — override de identidade em memória (reset em hard refresh / logout).
 * O servidor valida o header x-ghost-profile-id contra a sessão real.
 */

export type GhostModeState = {
  targetProfileId: string;
  targetFullName: string;
  realProfileId: string;
  startedAt: string;
  /** Igreja ativa antes do Ghost (restaurada ao sair). */
  previousTenantId: string | null;
  previousTenantBranding: {
    id: string;
    code: string;
    name: string;
    logo_url: string | null;
  } | null;
};

let ghostState: GhostModeState | null = null;
const listeners = new Set<() => void>();

const notifyGhostModeListeners = () => {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch (error) {
      console.error('ghostMode listener:', error);
    }
  });
};

export function subscribeGhostMode(listener: () => void) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function getGhostModeState(): GhostModeState | null {
  return ghostState;
}

export function isGhostModeActive(): boolean {
  return ghostState !== null;
}

export function getGhostEffectiveProfileId(): string | null {
  return ghostState?.targetProfileId?.trim() || null;
}

export function getGhostRealProfileId(): string | null {
  return ghostState?.realProfileId?.trim() || null;
}

export function setGhostModeState(next: GhostModeState) {
  ghostState = next;
  notifyGhostModeListeners();
}

export function clearGhostModeState() {
  if (!ghostState) {
    return;
  }

  ghostState = null;
  notifyGhostModeListeners();
}

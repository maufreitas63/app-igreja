const STORAGE_KEY = 'app-igreja:debug-clicks';

type TraceDetail = Record<string, unknown> | undefined;

declare global {
  interface Window {
    __appClickTrace?: {
      enable: () => void;
      disable: () => void;
      isEnabled: () => boolean;
    };
  }
}

export function isClickTraceEnabled() {
  if (!__DEV__) {
    return false;
  }

  if (typeof localStorage !== 'undefined') {
    return localStorage.getItem(STORAGE_KEY) === '1';
  }

  return false;
}

export function enableClickTrace() {
  if (!__DEV__ || typeof localStorage === 'undefined') {
    return;
  }

  localStorage.setItem(STORAGE_KEY, '1');
  console.info('[click] trace habilitado — recarregue a página se necessário.');
}

export function disableClickTrace() {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY);
  }

  console.info('[click] trace desabilitado.');
}

export function traceClick(scope: string, action: string, detail?: TraceDetail) {
  if (!isClickTraceEnabled()) {
    return;
  }

  const label = `[click:${scope}] ${action}`;

  if (detail && Object.keys(detail).length > 0) {
    console.log(label, detail);
    return;
  }

  console.log(label);
}

export function installDevClickTraceConsoleHelpers() {
  if (!__DEV__ || typeof window === 'undefined') {
    return;
  }

  window.__appClickTrace = {
    enable: enableClickTrace,
    disable: disableClickTrace,
    isEnabled: isClickTraceEnabled,
  };

  if (isClickTraceEnabled()) {
    console.info('[click] trace ativo. Desabilite com __appClickTrace.disable()');
    return;
  }

  console.info('[click] para depurar cliques: __appClickTrace.enable() e recarregue a página.');
}

export function readDebugClicksFromUrl() {
  if (!__DEV__ || typeof window === 'undefined') {
    return;
  }

  const params = new URLSearchParams(window.location.search);

  if (params.get('debugClicks') === '1') {
    enableClickTrace();
  }
}

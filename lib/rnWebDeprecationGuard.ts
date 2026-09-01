/**
 * RN Web emite os mesmos dois avisos em cada render SSR do Metro
 * (`warnOnce` reinicia a cada worker). As origens restantes estão em
 * expo-router / react-navigation, não no código da app.
 */
const SUPPRESSED_FRAGMENTS = [
  'props.pointerEvents is deprecated',
  '"shadow*" style props are deprecated',
];

declare global {
  var __rnWebDeprecationGuardInstalled: boolean | undefined;
}

export function installRnWebDeprecationGuard(): void {
  if (globalThis.__rnWebDeprecationGuardInstalled) {
    return;
  }
  globalThis.__rnWebDeprecationGuardInstalled = true;

  const originalWarn = console.warn.bind(console);
  console.warn = (...args: unknown[]) => {
    const text = args
      .map((arg) => (typeof arg === 'string' ? arg : ''))
      .join(' ');
    if (SUPPRESSED_FRAGMENTS.some((fragment) => text.includes(fragment))) {
      return;
    }
    originalWarn(...args);
  };
}

installRnWebDeprecationGuard();

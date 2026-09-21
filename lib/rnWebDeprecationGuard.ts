/**
 * RN Web emite os mesmos dois avisos em cada render SSR do Metro
 * (`warnOnce` reinicia a cada worker). As origens restantes estão em
 * expo-router / react-navigation, não no código da app.
 *
 * Este módulo deve ser o primeiro import dos entrypoints (`_layout`)
 * e também é instalado em `metro.config.js` para o processo SSR.
 */
const SUPPRESSED_FRAGMENTS = [
  'props.pointerEvents is deprecated',
  '"shadow*" style props are deprecated',
];

declare global {
  var __rnWebDeprecationGuardInstalled: boolean | undefined;
}

function isSuppressed(args: unknown[]) {
  const text = args
    .map((arg) => {
      if (typeof arg === 'string') {
        return arg;
      }

      if (arg instanceof Error) {
        return arg.message;
      }

      return '';
    })
    .join(' ');

  return SUPPRESSED_FRAGMENTS.some((fragment) => text.includes(fragment));
}

export function installRnWebDeprecationGuard(): void {
  if (globalThis.__rnWebDeprecationGuardInstalled) {
    return;
  }
  globalThis.__rnWebDeprecationGuardInstalled = true;

  const originalWarn = console.warn.bind(console);
  const originalError = console.error.bind(console);

  console.warn = (...args: unknown[]) => {
    if (isSuppressed(args)) {
      return;
    }
    originalWarn(...args);
  };

  console.error = (...args: unknown[]) => {
    if (isSuppressed(args)) {
      return;
    }
    originalError(...args);
  };
}

installRnWebDeprecationGuard();

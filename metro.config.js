const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** Silencia avisos do RN Web no SSR do Metro (warnOnce reinicia em cada worker). */
if (!global.__rnWebDeprecationGuardInstalled) {
  global.__rnWebDeprecationGuardInstalled = true;
  const originalWarn = console.warn.bind(console);
  const originalError = console.error.bind(console);
  const isSuppressed = (...args) => {
    const text = args.map((arg) => (typeof arg === 'string' ? arg : '')).join(' ');
    return (
      text.includes('props.pointerEvents is deprecated')
      || text.includes('"shadow*" style props are deprecated')
    );
  };
  console.warn = (...args) => {
    if (isSuppressed(...args)) {
      return;
    }
    originalWarn(...args);
  };
  console.error = (...args) => {
    if (isSuppressed(...args)) {
      return;
    }
    originalError(...args);
  };
}

const config = getDefaultConfig(__dirname);

config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  buffer: path.resolve(__dirname, 'node_modules/buffer/'),
};

// Adicionamos a exclusão para evitar que o React Compiler tente 
// transformar o código interno do React Native que causa o erro
config.transformer = {
  ...config.transformer,
  unstable_allowRequireContext: true,
};

// O pacote Node `ws` não deve entrar no bundle Android/iOS.
const previousResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    (platform === 'android' || platform === 'ios')
    && (moduleName === 'ws' || moduleName.startsWith('ws/'))
  ) {
    return { type: 'empty' };
  }

  if (typeof previousResolveRequest === 'function') {
    return previousResolveRequest(context, moduleName, platform);
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;

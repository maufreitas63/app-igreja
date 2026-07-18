const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

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

module.exports = config;
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, repoRoot, 'EXPO_PUBLIC_');

  return {
    root: __dirname,
    base: '/cadastro-familia/',
    plugins: [react()],
    resolve: {
      alias: {
        '@': repoRoot,
        // Evita que Rollup parseie Flow em react-native/index.js (quebra build:family-form).
        'react-native': 'react-native-web',
        'react-native-toast-message': path.join(__dirname, 'shims', 'react-native-toast-message.ts'),
        '@react-native-async-storage/async-storage': path.join(
          __dirname,
          'shims',
          'async-storage.ts'
        ),
      },
    },
    define: {
      'process.env.EXPO_PUBLIC_SUPABASE_URL': JSON.stringify(env.EXPO_PUBLIC_SUPABASE_URL ?? ''),
      'process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY': JSON.stringify(env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? ''),
      'process.env.NODE_ENV': JSON.stringify(mode),
    },
    build: {
      outDir: path.join(repoRoot, 'dist', 'cadastro-familia'),
      emptyOutDir: true,
    },
  };
});

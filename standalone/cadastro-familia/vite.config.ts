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

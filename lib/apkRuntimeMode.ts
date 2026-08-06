import { Platform } from 'react-native';
import { DEFAULT_PRODUCTION_APP_URL } from '@/lib/instancePublicUrl';

/**
 * APK/iOS nativo: modo de execução.
 * - `pwa` — shell WebView carrega o PWA de produção (paridade total com a web).
 * - `native` / vazio fora do EAS — stack React Native nativa (Expo Router).
 */
export function getApkShellMode(): 'pwa' | 'native' {
  if (Platform.OS === 'web') {
    return 'native';
  }

  const raw = (process.env.EXPO_PUBLIC_APK_SHELL_MODE || '').trim().toLowerCase();

  if (raw === 'pwa' || raw === 'web' || raw === '1' || raw === 'true') {
    return 'pwa';
  }

  return 'native';
}

export function isApkPwaShellEnabled(): boolean {
  return getApkShellMode() === 'pwa';
}

/** URL do PWA embutido no shell (produção Cloudflare por padrão). */
export function resolvePwaShellEntryUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_APP_URL?.trim();
  if (fromEnv) {
    try {
      const parsed = new URL(
        /^https?:\/\//i.test(fromEnv) ? fromEnv : `https://${fromEnv}`
      );
      return parsed.toString().replace(/\/+$/, '');
    } catch {
      // fallback
    }
  }

  return DEFAULT_PRODUCTION_APP_URL;
}

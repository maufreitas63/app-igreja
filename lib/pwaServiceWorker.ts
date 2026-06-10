import { Platform } from 'react-native';

let registrationStarted = false;

/** Registra o service worker do PWA (somente web, uma vez por sessão). */
export function registerPwaServiceWorker() {
  if (Platform.OS !== 'web' || registrationStarted || typeof navigator === 'undefined') {
    return;
  }

  if (!('serviceWorker' in navigator)) {
    return;
  }

  registrationStarted = true;

  const register = () => {
    void navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.warn('Falha ao registrar service worker do PWA:', error);
      registrationStarted = false;
    });
  };

  if (typeof window !== 'undefined' && document.readyState === 'complete') {
    register();
    return;
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('load', register, { once: true });
  }
}

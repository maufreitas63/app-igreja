import { FAMILY_REGISTRATION_PUBLIC_PATH } from '@/lib/familyRegistration';
import { useLayoutEffect } from 'react';
import { Platform } from 'react-native';

/** Redireciona para a página standalone (fora do PWA) quando o Expo Router intercepta a rota. */
export default function CadastroFamiliaRedirectScreen() {
  useLayoutEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      return;
    }

    const standaloneUrl = `${window.location.origin}${FAMILY_REGISTRATION_PUBLIC_PATH}`;
    const isStandaloneDocument = Boolean(
      document.querySelector(`script[src*="${FAMILY_REGISTRATION_PUBLIC_PATH}assets/"]`)
    );

    if (!isStandaloneDocument) {
      window.location.replace(standaloneUrl);
    }
  }, []);

  return null;
}

import { loadNomeFantasiaPreference } from '@/lib/profileDisplayName';
import { useEffect } from 'react';

/** Carrega `app_parameters.n_fantasia` no início da sessão para nomes de exibição. */
export function usePreloadNomeFantasiaPreference() {
  useEffect(() => {
    void loadNomeFantasiaPreference();
  }, []);
}

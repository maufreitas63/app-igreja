import { useScreenAccessGuard, type ScreenAccessStatus } from '@/hooks/useScreenAccessGuard';
import { ACCESS_DASHBOARD_CARD } from '@/lib/accessControl';

/** Acesso à rota `/ofertas` — exige card dashboard.card.offerings. */
export function useOfferingsScreenAccess(redirectPath: string = '/(tabs)/dashboard'): ScreenAccessStatus {
  return useScreenAccessGuard({
    resourceKey: ACCESS_DASHBOARD_CARD.offerings,
    deniedMessage: 'Você não tem permissão para abrir Dízimos e Ofertas.',
    redirectPath,
  });
}

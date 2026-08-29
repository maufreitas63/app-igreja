import { useScreenAccessGuard, type ScreenAccessStatus } from '@/hooks/useScreenAccessGuard';
import { ACCESS_DASHBOARD_CARD } from '@/lib/accessControl';
import { MEMBER_HOME_PATH } from '@/lib/failClosedNavigation';

/** Acesso à rota `/ofertas` — exige card dashboard.card.offerings. */
export function useOfferingsScreenAccess(redirectPath: string = MEMBER_HOME_PATH): ScreenAccessStatus {
  return useScreenAccessGuard({
    resourceKey: ACCESS_DASHBOARD_CARD.offerings,
    deniedMessage: 'Você não tem permissão para abrir Dízimos e Ofertas.',
    redirectPath,
  });
}

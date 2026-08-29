import { useScreenAccessGuard, type ScreenAccessStatus } from '@/hooks/useScreenAccessGuard';
import { DRAWER_EVENT_ORCHESTRATOR_RESOURCE } from '@/lib/drawerMenuAccess';
import { MEMBER_HOME_PATH } from '@/lib/failClosedNavigation';

/** Acesso à rota `/admin/orquestrador` — exige painel maintenance.card.event_orchestration. */
export function useEventOrchestratorScreenAccess(
  redirectPath: string = MEMBER_HOME_PATH
): ScreenAccessStatus {
  return useScreenAccessGuard({
    resourceKey: DRAWER_EVENT_ORCHESTRATOR_RESOURCE,
    deniedMessage: 'Você não tem permissão para abrir a Manutenção de Avisos.',
    redirectPath,
  });
}

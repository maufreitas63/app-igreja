import { useLgpdScreenAccess } from '@/hooks/useLgpdScreenAccess';
import type { ScreenAccessStatus } from '@/hooks/useScreenAccessGuard';

type MediaAuthorizationAccessState = {
  status: ScreenAccessStatus;
  sessionProfileId: string | null;
};

/** Mesma regra de sessão da rota LGPD — login válido, sem card do dashboard. */
export function useMediaAuthorizationAccess(): MediaAuthorizationAccessState {
  const { status, sessionProfileId } = useLgpdScreenAccess(
    '/(tabs)',
    'Faça login para abrir a autorização de mídia.'
  );
  return { status, sessionProfileId };
}

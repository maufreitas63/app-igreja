import { useLeadershipRouteGuard } from '@/hooks/useLeadershipRouteGuard';
import { useLgpdScreenAccess } from '@/hooks/useLgpdScreenAccess';
import { FAIL_CLOSED_REDIRECT_PATH } from '@/lib/failClosedNavigation';
import type { ScreenAccessStatus } from '@/hooks/useScreenAccessGuard';

type MediaAuthorizationAccessState = {
  status: ScreenAccessStatus;
  sessionProfileId: string | null;
};

/** Autorização de mídia operacional — só liderança. Confirmação por e-mail permanece pública. */
export function useMediaAuthorizationAccess(): MediaAuthorizationAccessState {
  const leadershipStatus = useLeadershipRouteGuard({
    deniedMessage: 'Você não tem permissão para abrir a autorização de mídia.',
    allowRoomManagers: true,
  });
  const { status: sessionStatus, sessionProfileId } = useLgpdScreenAccess(
    FAIL_CLOSED_REDIRECT_PATH,
    'Faça login para abrir a autorização de mídia.'
  );

  if (leadershipStatus === 'checking' || sessionStatus === 'checking') {
    return { status: 'checking', sessionProfileId: null };
  }

  if (leadershipStatus !== 'allowed' || sessionStatus !== 'allowed' || !sessionProfileId) {
    return { status: 'denied', sessionProfileId: null };
  }

  return { status: 'allowed', sessionProfileId };
}

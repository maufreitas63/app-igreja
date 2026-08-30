import { ACCESS_SCREEN, sessionHasAccess } from '@/lib/accessControl';
import { checkSessionIsSuperAdmin } from '@/lib/maintenanceAccessControlApi';
import { denyScreenAccessAndRedirect } from '@/lib/screenAccessDenyRedirect';
import { FAIL_CLOSED_REDIRECT_PATH } from '@/lib/failClosedNavigation';
import { useLgpdScreenAccess } from '@/hooks/useLgpdScreenAccess';
import type { ScreenAccessStatus } from '@/hooks/useScreenAccessGuard';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';

type MediaAuthorizationAccessState = {
  status: ScreenAccessStatus;
  sessionProfileId: string | null;
};

/** Autorização de mídia operacional — grant `/autorizacao-midia` ou Super Admin. */
export function useMediaAuthorizationAccess(): MediaAuthorizationAccessState {
  const router = useRouter();
  const { status: sessionStatus, sessionProfileId } = useLgpdScreenAccess(
    FAIL_CLOSED_REDIRECT_PATH,
    'Faça login para abrir a autorização de mídia.'
  );
  const [leadershipStatus, setLeadershipStatus] = useState<ScreenAccessStatus>('checking');

  useFocusEffect(
    useCallback(() => {
      let active = true;

      void (async () => {
        setLeadershipStatus('checking');

        try {
          const [isSuperAdmin, hasGrant] = await Promise.all([
            checkSessionIsSuperAdmin().catch(() => false),
            sessionHasAccess('screen', ACCESS_SCREEN.autorizacaoMidia, 'view'),
          ]);

          if (!active) {
            return;
          }

          if (isSuperAdmin === true || hasGrant === true) {
            setLeadershipStatus('allowed');
            return;
          }

          setLeadershipStatus('denied');
          denyScreenAccessAndRedirect(
            router,
            FAIL_CLOSED_REDIRECT_PATH,
            'Acesso negado',
            'Você não tem permissão para abrir a autorização de mídia.'
          );
        } catch {
          if (!active) {
            return;
          }

          setLeadershipStatus('denied');
          denyScreenAccessAndRedirect(
            router,
            FAIL_CLOSED_REDIRECT_PATH,
            'Acesso negado',
            'Você não tem permissão para abrir a autorização de mídia.'
          );
        }
      })();

      return () => {
        active = false;
      };
    }, [router])
  );

  if (leadershipStatus === 'checking' || sessionStatus === 'checking') {
    return { status: 'checking', sessionProfileId: null };
  }

  if (leadershipStatus !== 'allowed' || sessionStatus !== 'allowed' || !sessionProfileId) {
    return { status: 'denied', sessionProfileId: null };
  }

  return { status: 'allowed', sessionProfileId };
}

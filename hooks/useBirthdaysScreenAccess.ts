import {
  ACCESS_DASHBOARD_CARD,
  ACL_UNAVAILABLE_MESSAGE,
  getAccessControlRpcStatus,
  isAclStrictMode,
  sessionHasAccess,
} from '@/lib/accessControl';
import { fetchProfileHasActiveMembership } from '@/lib/profileMembershipStatus';
import { resolveEffectiveProfileId } from '@/lib/sessionProfile';
import { getGhostModeState, subscribeGhostMode } from '@/lib/ghostMode';
import { denyScreenAccessAndRedirect } from '@/lib/screenAccessDenyRedirect';
import type { ScreenAccessStatus } from '@/hooks/useScreenAccessGuard';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

/** Acesso à rota `/aniversariantes` — exige card dashboard.card.birthdays. */
export function useBirthdaysScreenAccess(redirectPath: string = '/(tabs)'): ScreenAccessStatus {
  const router = useRouter();
  const [status, setStatus] = useState<ScreenAccessStatus>('checking');
  const hasAllowedRef = useRef(false);
  const [ghostTargetId, setGhostTargetId] = useState(
    () => getGhostModeState()?.targetProfileId ?? null
  );

  useEffect(
    () =>
      subscribeGhostMode(() => {
        hasAllowedRef.current = false;
        setGhostTargetId(getGhostModeState()?.targetProfileId ?? null);
      }),
    []
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;

      void (async () => {
        if (!hasAllowedRef.current) {
          setStatus('checking');
        }

        const aclStatus = await getAccessControlRpcStatus();

        if (!active) {
          return;
        }

        if (aclStatus === 'missing' && isAclStrictMode()) {
          setStatus('denied');
          denyScreenAccessAndRedirect(router, redirectPath, 'ACL indisponível', ACL_UNAVAILABLE_MESSAGE);
          return;
        }

        const profileId = await resolveEffectiveProfileId();
        const [hasBirthdaysCard, activeMembership] = await Promise.all([
          sessionHasAccess('screen', ACCESS_DASHBOARD_CARD.birthdays, 'view'),
          profileId ? fetchProfileHasActiveMembership(profileId) : Promise.resolve(false),
        ]);

        if (!active) {
          return;
        }

        if (!hasBirthdaysCard || !activeMembership) {
          setStatus('denied');
          denyScreenAccessAndRedirect(
            router,
            redirectPath,
            'Acesso negado',
            'Você não tem permissão para abrir Aniversariantes.'
          );
          return;
        }

        hasAllowedRef.current = true;
        setStatus('allowed');
      })();

      return () => {
        active = false;
      };
    }, [ghostTargetId, redirectPath, router])
  );

  return status;
}

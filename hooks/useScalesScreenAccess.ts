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

/** Acesso à rota `/escalas` — exige card dashboard.card.vigilance_scales. */
export function useScalesScreenAccess(redirectPath: string = '/(tabs)/dashboard'): ScreenAccessStatus {
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
        const [hasScalesCard, activeMembership] = await Promise.all([
          sessionHasAccess('screen', ACCESS_DASHBOARD_CARD.vigilanceScales, 'view'),
          profileId ? fetchProfileHasActiveMembership(profileId) : Promise.resolve(false),
        ]);

        if (!active) {
          return;
        }

        if (!hasScalesCard || !activeMembership) {
          setStatus('denied');
          denyScreenAccessAndRedirect(
            router,
            redirectPath,
            'Acesso negado',
            'Você não tem permissão para abrir Escalas.'
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

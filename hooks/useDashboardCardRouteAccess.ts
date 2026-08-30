import {
  ACL_UNAVAILABLE_MESSAGE,
  getAccessControlRpcStatus,
  isAclStrictMode,
  sessionHasAccess,
} from '@/lib/accessControl';
import { MEMBER_HOME_PATH } from '@/lib/failClosedNavigation';
import { fetchProfileHasActiveMembership } from '@/lib/profileMembershipStatus';
import { resolveEffectiveProfileId } from '@/lib/sessionProfile';
import { getGhostModeState, subscribeGhostMode } from '@/lib/ghostMode';
import { denyScreenAccessAndRedirect } from '@/lib/screenAccessDenyRedirect';
import type { ScreenAccessStatus } from '@/hooks/useScreenAccessGuard';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

type Options = {
  resourceKey: string;
  deniedMessage: string;
  requireActiveMembership?: boolean;
  redirectPath?: string;
};

/** Acesso a rota dedicada que herda ACL de `dashboard.card.*` (e vínculo ativo, se exigido). */
export function useDashboardCardRouteAccess({
  resourceKey,
  deniedMessage,
  requireActiveMembership = false,
  redirectPath = MEMBER_HOME_PATH,
}: Options): ScreenAccessStatus {
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
        const [hasCard, activeMembership] = await Promise.all([
          sessionHasAccess('screen', resourceKey, 'view'),
          requireActiveMembership
            ? profileId
              ? fetchProfileHasActiveMembership(profileId)
              : Promise.resolve(false)
            : Promise.resolve(true),
        ]);

        if (!active) {
          return;
        }

        if (!hasCard || !activeMembership) {
          setStatus('denied');
          denyScreenAccessAndRedirect(router, redirectPath, 'Acesso negado', deniedMessage);
          return;
        }

        hasAllowedRef.current = true;
        setStatus('allowed');
      })();

      return () => {
        active = false;
      };
    }, [deniedMessage, ghostTargetId, redirectPath, requireActiveMembership, resourceKey, router])
  );

  return status;
}

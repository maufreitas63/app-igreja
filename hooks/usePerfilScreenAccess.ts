import {
  ACL_UNAVAILABLE_MESSAGE,
  getAccessControlRpcStatus,
  isAclStrictMode,
  loadDashboardCardViewAccess,
} from '@/lib/accessControl';
import {
  isDashboardCardFullyAllowed,
  loadDashboardLinkedScreenAccess,
} from '@/lib/dashboardScreenAccess';
import { DASHBOARD_CARD_BLOCKED_MESSAGES } from '@/lib/dashboardCardScreenLinks';
import { getGhostModeState, subscribeGhostMode } from '@/lib/ghostMode';
import { loadEffectiveSessionProfile } from '@/lib/loadSessionProfile';
import { MEMBER_HOME_PATH } from '@/lib/failClosedNavigation';
import { denyScreenAccessAndRedirect } from '@/lib/screenAccessDenyRedirect';
import { resolveEffectiveProfileId } from '@/lib/sessionProfile';
import type { ScreenAccessStatus } from '@/hooks/useScreenAccessGuard';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

/** Acesso à rota `/perfil` — exige card dashboard.card.grouped_manage (ou telas filhas vinculadas). */
export function usePerfilScreenAccess(redirectPath: string = MEMBER_HOME_PATH): ScreenAccessStatus {
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

        const profileId =
          (await resolveEffectiveProfileId())
          ?? (await loadEffectiveSessionProfile())?.id?.trim()
          ?? null;

        if (!profileId) {
          setStatus('denied');
          denyScreenAccessAndRedirect(
            router,
            redirectPath,
            'Acesso negado',
            DASHBOARD_CARD_BLOCKED_MESSAGES.grouped_manage
              ?? 'Você não tem permissão para abrir Perfil & Identidade.'
          );
          return;
        }

        const [cardAccess, screenAccess] = await Promise.all([
          loadDashboardCardViewAccess(profileId, { forceRefresh: Boolean(ghostTargetId) }),
          loadDashboardLinkedScreenAccess(profileId, { forceRefresh: Boolean(ghostTargetId) }),
        ]);

        if (!active) {
          return;
        }

        const allowed = isDashboardCardFullyAllowed('grouped_manage', cardAccess, screenAccess);

        if (!allowed) {
          setStatus('denied');
          denyScreenAccessAndRedirect(
            router,
            redirectPath,
            'Acesso negado',
            DASHBOARD_CARD_BLOCKED_MESSAGES.grouped_manage
              ?? 'Você não tem permissão para abrir Perfil & Identidade.'
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

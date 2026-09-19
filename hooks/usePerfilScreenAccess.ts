import {
  ACL_UNAVAILABLE_MESSAGE,
  getAccessControlRpcStatus,
  isAclStrictMode,
} from '@/lib/accessControl';
import { DASHBOARD_CARD_BLOCKED_MESSAGES } from '@/lib/dashboardCardScreenLinks';
import { getGhostModeState, subscribeGhostMode } from '@/lib/ghostMode';
import { loadEffectiveSessionProfile } from '@/lib/loadSessionProfile';
import { MEMBER_HOME_PATH } from '@/lib/failClosedNavigation';
import { denyScreenAccessAndRedirect } from '@/lib/screenAccessDenyRedirect';
import { resolveEffectiveProfileId } from '@/lib/sessionProfile';
import type { ScreenAccessStatus } from '@/hooks/useScreenAccessGuard';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

/** Acesso à rota `/perfil` — identidade da sessão efetiva (inclui Ghost). */
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

        // Perfil é a identidade da sessão efetiva (inclui Ghost). Não exige o card
        // congelado grouped_manage — senão o membro cai no Início ao abrir o menu.
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

import {
  ACL_UNAVAILABLE_MESSAGE,
  getAccessControlRpcStatus,
  isAclStrictMode,
} from '@/lib/accessControl';
import { traceClick } from '@/lib/devClickTrace';
import { getGhostModeState, subscribeGhostMode } from '@/lib/ghostMode';
import { loadEffectiveSessionProfile } from '@/lib/loadSessionProfile';
import { denyScreenAccessAndRedirect } from '@/lib/screenAccessDenyRedirect';
import { resolveEffectiveProfileId } from '@/lib/sessionProfile';
import type { ScreenAccessStatus } from '@/hooks/useScreenAccessGuard';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

type LgpdScreenAccessState = {
  status: ScreenAccessStatus;
  sessionProfileId: string | null;
};

/** Acesso à rota `/lgpd` — sessão válida, sem exigir card do dashboard. */
export function useLgpdScreenAccess(redirectPath: string = '/(tabs)'): LgpdScreenAccessState {
  const router = useRouter();
  const [status, setStatus] = useState<ScreenAccessStatus>('checking');
  const [sessionProfileId, setSessionProfileId] = useState<string | null>(null);
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
          traceClick('lgpd-access', 'denied-acl-missing');
          setStatus('denied');
          denyScreenAccessAndRedirect(router, redirectPath, 'ACL indisponível', ACL_UNAVAILABLE_MESSAGE);
          return;
        }

        const profileId =
          (await resolveEffectiveProfileId())
          ?? (await loadEffectiveSessionProfile())?.id?.trim()
          ?? null;

        if (!active) {
          return;
        }

        if (!profileId) {
          traceClick('lgpd-access', 'denied-no-session');
          setSessionProfileId(null);
          setStatus('denied');
          denyScreenAccessAndRedirect(
            router,
            redirectPath,
            'Acesso negado',
            'Faça login para abrir os termos de privacidade.'
          );
          return;
        }

        hasAllowedRef.current = true;
        traceClick('lgpd-access', 'allowed', { profileId });
        setSessionProfileId(profileId);
        setStatus('allowed');
      })();

      return () => {
        active = false;
      };
    }, [ghostTargetId, redirectPath, router])
  );

  return { status, sessionProfileId };
}

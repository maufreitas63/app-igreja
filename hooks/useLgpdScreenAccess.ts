import {
  ACL_UNAVAILABLE_MESSAGE,
  getAccessControlRpcStatus,
  isAclStrictMode,
} from '@/lib/accessControl';
import { traceClick } from '@/lib/devClickTrace';
import { loadEffectiveSessionProfile } from '@/lib/loadSessionProfile';
import { getStoredUserPhone } from '@/lib/userSession';
import type { ScreenAccessStatus } from '@/hooks/useScreenAccessGuard';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Alert } from 'react-native';

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
          Alert.alert('ACL indisponível', ACL_UNAVAILABLE_MESSAGE, [
            { text: 'OK', onPress: () => router.replace(redirectPath) },
          ]);
          return;
        }

        const phone = await getStoredUserPhone();
        const sessionProfile = phone ? await loadEffectiveSessionProfile(phone) : null;
        const profileId = sessionProfile?.id?.trim() ?? null;

        if (!active) {
          return;
        }

        if (!profileId) {
          traceClick('lgpd-access', 'denied-no-session');
          setSessionProfileId(null);
          setStatus('denied');
          Alert.alert('Acesso negado', 'Faça login para abrir os termos de privacidade.', [
            { text: 'OK', onPress: () => router.replace(redirectPath) },
          ]);
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
    }, [redirectPath, router])
  );

  return { status, sessionProfileId };
}

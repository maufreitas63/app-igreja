import { hasStoredMemberSessionToken } from '@/lib/memberSession';
import { SIGN_OUT_QUERY_PARAM } from '@/lib/userSession';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';

/** Bloqueia `(tabs)` sem login recente (token de sessão). */
export function useMemberSessionRouteGuard() {
  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      let active = true;

      void (async () => {
        const hasSession = await hasStoredMemberSessionToken();

        if (!active || hasSession) {
          return;
        }

        router.replace({
          pathname: '/',
          params: { [SIGN_OUT_QUERY_PARAM]: '1' },
        });
      })();

      return () => {
        active = false;
      };
    }, [router])
  );
}

import {
  ACL_UNAVAILABLE_MESSAGE,
  getAccessControlRpcStatus,
  isAclStrictMode,
  sessionHasAccess,
} from '@/lib/accessControl';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert } from 'react-native';

export type ScreenAccessStatus = 'checking' | 'allowed' | 'denied' | 'skipped';

type ScreenAccessGuardOptions = {
  resourceKey: string;
  deniedMessage: string;
  deniedTitle?: string;
  redirectPath?: string;
  enabled?: boolean;
  /** Quando true, não bloqueia (ex.: fluxo de cadastro com `phone` na rota). */
  skipCheck?: boolean;
};

export function useScreenAccessGuard({
  resourceKey,
  deniedMessage,
  deniedTitle = 'Acesso negado',
  redirectPath = '/(tabs)/dashboard',
  enabled = true,
  skipCheck = false,
}: ScreenAccessGuardOptions): ScreenAccessStatus {
  const router = useRouter();
  const [status, setStatus] = useState<ScreenAccessStatus>(
    skipCheck || !enabled ? 'skipped' : 'checking'
  );

  useFocusEffect(
    useCallback(() => {
      if (!enabled || skipCheck) {
        setStatus('skipped');
        return undefined;
      }

      let active = true;
      setStatus('checking');

      void (async () => {
        const aclStatus = await getAccessControlRpcStatus();

        if (!active) {
          return;
        }

        if (aclStatus === 'missing' && isAclStrictMode()) {
          setStatus('denied');
          Alert.alert('ACL indisponível', ACL_UNAVAILABLE_MESSAGE, [
            { text: 'OK', onPress: () => router.replace(redirectPath) },
          ]);
          return;
        }

        const allowed = await sessionHasAccess('screen', resourceKey, 'view');

        if (!active) {
          return;
        }

        if (!allowed) {
          setStatus('denied');
          Alert.alert(deniedTitle, deniedMessage, [
            { text: 'OK', onPress: () => router.replace(redirectPath) },
          ]);
          return;
        }

        setStatus('allowed');
      })();

      return () => {
        active = false;
      };
    }, [deniedMessage, deniedTitle, enabled, redirectPath, resourceKey, router, skipCheck])
  );

  return skipCheck || !enabled ? 'skipped' : status;
}

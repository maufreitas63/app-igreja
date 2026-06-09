import {
  ACL_UNAVAILABLE_MESSAGE,
  getAccessControlRpcStatus,
  isAclStrictMode,
  sessionHasAccess,
} from '@/lib/accessControl';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Alert } from 'react-native';

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
}: ScreenAccessGuardOptions) {
  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      if (!enabled || skipCheck) {
        return undefined;
      }

      let active = true;

      void (async () => {
        const aclStatus = await getAccessControlRpcStatus();

        if (!active) {
          return;
        }

        if (aclStatus === 'missing' && isAclStrictMode()) {
          Alert.alert('ACL indisponível', ACL_UNAVAILABLE_MESSAGE, [
            { text: 'OK', onPress: () => router.replace(redirectPath) },
          ]);
          return;
        }

        const allowed = await sessionHasAccess('screen', resourceKey, 'view');

        if (!active || allowed) {
          return;
        }

        Alert.alert(deniedTitle, deniedMessage, [
          { text: 'OK', onPress: () => router.replace(redirectPath) },
        ]);
      })();

      return () => {
        active = false;
      };
    }, [deniedMessage, deniedTitle, enabled, redirectPath, resourceKey, router, skipCheck])
  );
}

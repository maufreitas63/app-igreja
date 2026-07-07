import {
  ACCESS_DASHBOARD_CARD,
  ACL_UNAVAILABLE_MESSAGE,
  getAccessControlRpcStatus,
  isAclStrictMode,
  sessionHasAccess,
} from '@/lib/accessControl';
import { fetchProfileHasActiveMembership } from '@/lib/profileMembershipStatus';
import { resolveEffectiveProfileId } from '@/lib/sessionProfile';
import type { ScreenAccessStatus } from '@/hooks/useScreenAccessGuard';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Alert } from 'react-native';

/** Acesso à rota `/escalas` — exige card dashboard.card.vigilance_scales. */
export function useScalesScreenAccess(redirectPath: string = '/(tabs)'): ScreenAccessStatus {
  const router = useRouter();
  const [status, setStatus] = useState<ScreenAccessStatus>('checking');
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
          setStatus('denied');
          Alert.alert('ACL indisponível', ACL_UNAVAILABLE_MESSAGE, [
            { text: 'OK', onPress: () => router.replace(redirectPath) },
          ]);
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
          Alert.alert('Acesso negado', 'Você não tem permissão para abrir Escalas.', [
            { text: 'OK', onPress: () => router.replace(redirectPath) },
          ]);
          return;
        }

        hasAllowedRef.current = true;
        setStatus('allowed');
      })();

      return () => {
        active = false;
      };
    }, [redirectPath, router])
  );

  return status;
}

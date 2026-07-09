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
import { loadEffectiveSessionProfile } from '@/lib/loadSessionProfile';
import { getStoredUserPhone } from '@/lib/userSession';
import type { ScreenAccessStatus } from '@/hooks/useScreenAccessGuard';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Alert } from 'react-native';

/** Acesso à rota `/perfil` — exige card dashboard.card.grouped_manage (ou telas filhas vinculadas). */
export function usePerfilScreenAccess(redirectPath: string = '/(tabs)'): ScreenAccessStatus {
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

        const phone = await getStoredUserPhone();
        const sessionProfile = phone ? await loadEffectiveSessionProfile(phone) : null;
        const profileId = sessionProfile?.id?.trim() ?? null;

        if (!profileId) {
          setStatus('denied');
          Alert.alert(
            'Acesso negado',
            DASHBOARD_CARD_BLOCKED_MESSAGES.grouped_manage ??
              'Você não tem permissão para abrir Perfil & Identidade.',
            [{ text: 'OK', onPress: () => router.replace(redirectPath) }]
          );
          return;
        }

        const [cardAccess, screenAccess] = await Promise.all([
          loadDashboardCardViewAccess(profileId),
          loadDashboardLinkedScreenAccess(profileId),
        ]);

        if (!active) {
          return;
        }

        const allowed = isDashboardCardFullyAllowed('grouped_manage', cardAccess, screenAccess);

        if (!allowed) {
          setStatus('denied');
          Alert.alert(
            'Acesso negado',
            DASHBOARD_CARD_BLOCKED_MESSAGES.grouped_manage ??
              'Você não tem permissão para abrir Perfil & Identidade.',
            [{ text: 'OK', onPress: () => router.replace(redirectPath) }]
          );
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

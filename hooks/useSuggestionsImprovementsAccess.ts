import {
  ACCESS_DASHBOARD_CARD,
  getAccessControlRpcStatus,
  isAclStrictMode,
  sessionHasAccess,
  ACL_UNAVAILABLE_MESSAGE,
} from '@/lib/accessControl';
import { isSuggestionsImprovementsAccessAllowed } from '@/lib/drawerMenuAccess';
import { fetchProfileHasActiveMembership } from '@/lib/profileMembershipStatus';
import { resolveEffectiveProfileId } from '@/lib/sessionProfile';
import { getGhostModeState, subscribeGhostMode } from '@/lib/ghostMode';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import type { ScreenAccessStatus } from '@/hooks/useScreenAccessGuard';

const SUGGESTIONS_MAINTENANCE_RESOURCE = 'maintenance.card.suggestions_improvements';

export function useSuggestionsImprovementsAccess(options?: {
  redirectPath?: string;
}): ScreenAccessStatus {
  const router = useRouter();
  const redirectPath = options?.redirectPath ?? '/(tabs)/dashboard';
  const [ghostTargetId, setGhostTargetId] = useState(
    () => getGhostModeState()?.targetProfileId ?? null
  );
  const [status, setStatus] = useState<ScreenAccessStatus>('checking');
  const hasAllowedRef = useRef(false);

  useEffect(
    () =>
      subscribeGhostMode(() => {
        setGhostTargetId(getGhostModeState()?.targetProfileId ?? null);
      }),
    []
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;

      void (async () => {
        try {
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
          const [hasAdministrativo, hasMaintenancePanel, activeMembership] = await Promise.all([
            sessionHasAccess('screen', ACCESS_DASHBOARD_CARD.administrativo, 'view'),
            sessionHasAccess('screen', SUGGESTIONS_MAINTENANCE_RESOURCE, 'view'),
            profileId ? fetchProfileHasActiveMembership(profileId) : Promise.resolve(false),
          ]);

          if (!active) {
            return;
          }

          const allowed = isSuggestionsImprovementsAccessAllowed({
            hasAdministrativoCard: hasAdministrativo,
            hasMaintenancePanel,
            hasActiveMembership: activeMembership,
          });

          if (!allowed) {
            setStatus('denied');
            Alert.alert(
              'Sem permissão',
              'Você não tem acesso para registrar sugestões e melhorias.',
              [{ text: 'OK', onPress: () => router.replace(redirectPath) }]
            );
            return;
          }

          hasAllowedRef.current = true;
          setStatus('allowed');
        } catch (error) {
          console.error('Erro ao verificar acesso a sugestões e melhorias:', error);
          if (!active) {
            return;
          }

          setStatus('denied');
          Alert.alert(
            'Erro de acesso',
            'Não foi possível verificar sua permissão. Tente novamente.',
            [{ text: 'OK', onPress: () => router.replace(redirectPath) }]
          );
        }
      })();

      return () => {
        active = false;
      };
    }, [ghostTargetId, redirectPath, router])
  );

  return status;
}

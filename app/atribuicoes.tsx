import { AtribuicoesClass } from '@/components/AtribuicoesClass';
import { CloseFooterBar } from '@/components/minimal/CloseFooterBar';
import { MinimalScreenLayout } from '@/components/minimal/MinimalScreenLayout';
import { ScreenAccessGate } from '@/components/ScreenAccessGate';
import type { ScreenAccessStatus } from '@/hooks/useScreenAccessGuard';
import { MEMBER_HOME_PATH } from '@/lib/failClosedNavigation';
import { ghostPassScreenAccess } from '@/lib/ghostNavigation';
import { denyScreenAccessAndRedirect } from '@/lib/screenAccessDenyRedirect';
import { sessionCanAccessAtribuicoes } from '@/lib/atribuicoesApi';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';

const DENIED_MESSAGE = 'Apenas a Equipe Pastoral e o Super Administrador acessam Atribuições.';

function useAtribuicoesAccess(): ScreenAccessStatus {
  const router = useRouter();
  const [status, setStatus] = useState<ScreenAccessStatus>('checking');

  useFocusEffect(
    useCallback(() => {
      let active = true;

      void (async () => {
        if (ghostPassScreenAccess()) {
          if (active) setStatus('allowed');
          return;
        }

        const allowed = await sessionCanAccessAtribuicoes();

        if (!active) {
          return;
        }

        if (!allowed) {
          setStatus('denied');
          denyScreenAccessAndRedirect(router, MEMBER_HOME_PATH, 'Acesso negado', DENIED_MESSAGE);
          return;
        }

        setStatus('allowed');
      })();

      return () => {
        active = false;
      };
    }, [router])
  );

  return status;
}

export default function AtribuicoesScreen() {
  const router = useRouter();
  const accessStatus = useAtribuicoesAccess();

  const handleClose = useCallback(() => {
    router.replace({
      pathname: '/maintenance-dashboard',
      params: {
        panel: 'mudanca_papeis',
        presentation: 'minimal',
      },
    });
  }, [router]);


  return (
    <ScreenAccessGate status={accessStatus}>
      <MinimalScreenLayout scroll={false} footer={<CloseFooterBar onPress={handleClose} />}>
        <AtribuicoesClass isActive={accessStatus === 'allowed'} />
      </MinimalScreenLayout>
    </ScreenAccessGate>
  );
}

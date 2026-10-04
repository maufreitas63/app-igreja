import { confirmExitApplication } from '@/lib/userSession';
import { useNavigation } from 'expo-router';
import { useEffect, useRef } from 'react';

/**
 * No Índice: gesto/ação GO_BACK/POP (inclui voltar do sistema em alguns hosts)
 * abre o diálogo Encerrar sessão em vez de sair da tela.
 * Não intercepta NAVIGATE/PUSH/REPLACE (abrir Perfil, Financeiro, etc.).
 */
export function useHomeBackExitConfirmation() {
  const navigation = useNavigation();
  const dialogOpenRef = useRef(false);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      const actionType = String(event.data?.action?.type ?? '');

      if (actionType !== 'GO_BACK' && actionType !== 'POP' && actionType !== 'POP_TO_TOP') {
        return;
      }

      event.preventDefault();

      if (dialogOpenRef.current) {
        return;
      }

      dialogOpenRef.current = true;
      void confirmExitApplication().finally(() => {
        dialogOpenRef.current = false;
      });
    });

    return unsubscribe;
  }, [navigation]);
}

import { useAppDrawer } from '@/context/AppDrawerContext';
import { confirmExitApplication } from '@/lib/userSession';
import { useNavigation } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

/** Arraste para baixo no topo da tela inicial — o mesmo gesto do pull-to-refresh. */
const PULL_EXIT_DISTANCE = 88;

function scrollableAncestorCanMoveUp(start: EventTarget | null): boolean {
  let node = start instanceof Element ? start : null;

  while (node) {
    const overflowY = window.getComputedStyle(node).overflowY;
    const canScroll =
      (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay')
      && node.scrollHeight > node.clientHeight + 1;

    if (canScroll && node.scrollTop > 0) {
      return true;
    }

    node = node.parentElement;
  }

  const scrollingElement = document.scrollingElement;
  return Boolean(scrollingElement && scrollingElement.scrollTop > 0);
}

/**
 * No Índice: gesto/ação GO_BACK/POP (inclui voltar do sistema em alguns hosts)
 * abre o diálogo Encerrar sessão em vez de sair da tela.
 * No celular, arrastar a tela para baixo também abre esse diálogo
 * em vez de recarregar e cair em Boas-vindas.
 * Não intercepta NAVIGATE/PUSH/REPLACE (abrir Perfil, Financeiro, etc.).
 */
export function useHomeBackExitConfirmation() {
  const navigation = useNavigation();
  const { isOpen: drawerOpen } = useAppDrawer();
  const dialogOpenRef = useRef(false);
  const drawerOpenRef = useRef(drawerOpen);
  drawerOpenRef.current = drawerOpen;

  const askExitSession = () => {
    if (dialogOpenRef.current || drawerOpenRef.current) {
      return;
    }

    dialogOpenRef.current = true;
    void confirmExitApplication().finally(() => {
      dialogOpenRef.current = false;
    });
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      const actionType = String(event.data?.action?.type ?? '');

      if (actionType !== 'GO_BACK' && actionType !== 'POP' && actionType !== 'POP_TO_TOP') {
        return;
      }

      event.preventDefault();
      askExitSession();
    });

    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof document === 'undefined') {
      return undefined;
    }

    const html = document.documentElement;
    const body = document.body;
    const previousHtmlOverscroll = html.style.overscrollBehaviorY;
    const previousBodyOverscroll = body.style.overscrollBehaviorY;
    html.style.overscrollBehaviorY = 'none';
    body.style.overscrollBehaviorY = 'none';

    let startX = 0;
    let startY = 0;
    let tracking = false;

    const resetTracking = () => {
      tracking = false;
    };

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1 || drawerOpenRef.current || dialogOpenRef.current) {
        tracking = false;
        return;
      }

      if (scrollableAncestorCanMoveUp(event.target)) {
        tracking = false;
        return;
      }

      startX = event.touches[0].clientX;
      startY = event.touches[0].clientY;
      tracking = true;
    };

    const onTouchMove = (event: TouchEvent) => {
      if (!tracking || event.touches.length !== 1) {
        return;
      }

      const deltaX = event.touches[0].clientX - startX;
      const deltaY = event.touches[0].clientY - startY;

      if (deltaY > 12 && deltaY > Math.abs(deltaX)) {
        event.preventDefault();
      }
    };

    const onTouchEnd = (event: TouchEvent) => {
      if (!tracking) {
        return;
      }

      tracking = false;
      const touch = event.changedTouches[0];
      if (!touch) {
        return;
      }

      const deltaX = touch.clientX - startX;
      const deltaY = touch.clientY - startY;

      if (deltaY >= PULL_EXIT_DISTANCE && deltaY > Math.abs(deltaX)) {
        askExitSession();
      }
    };

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('touchcancel', resetTracking);

    return () => {
      html.style.overscrollBehaviorY = previousHtmlOverscroll;
      body.style.overscrollBehaviorY = previousBodyOverscroll;
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', resetTracking);
    };
  }, []);
}

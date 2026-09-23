import { isAppIndexScreen } from '@/components/AppBackHandler';
import type { AppDrawerMenuItemResolved } from '@/hooks/useAppDrawerMenu';
import { navigateDrawerMenuItem, type AppDrawerModuleKey } from '@/lib/appDrawerMenu';
import { confirmExitApplication } from '@/lib/userSession';
import { useGlobalSearchParams, usePathname, useRouter, useSegments } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

const SWIPE_DISTANCE = 88;

const MEMBER_MENU_PATHS: { moduleKey: AppDrawerModuleKey; path: string }[] = [
  { moduleKey: 'menu_perfil', path: '/perfil' },
  { moduleKey: 'gestao_financeira', path: '/financial' },
  { moduleKey: 'menu_small_group', path: '/pequeno-grupo' },
  { moduleKey: 'menu_escalas', path: '/escalas' },
  { moduleKey: 'menu_opportunity_mural', path: '/mural-oportunidades' },
  { moduleKey: 'menu_generosity_mural', path: '/mural-generosidade' },
  { moduleKey: 'menu_apoio_mutuo', path: '/apoio-mutuo' },
  { moduleKey: 'suggestions_improvements', path: '/suggestions-improvements' },
  { moduleKey: 'menu_como_faco', path: '/como-faco' },
  { moduleKey: 'menu_redes_sociais', path: '/redes-sociais' },
  { moduleKey: 'menu_sobre_conecta', path: '/sobre-conecta' },
];

function normalizePath(pathname: string) {
  const trimmed = pathname.replace(/\/+$/, '');
  return trimmed || '/';
}

function memberModuleForLocation(
  pathname: string,
  segments: readonly string[],
  catalog: string
): AppDrawerModuleKey | null {
  if (isAppIndexScreen(pathname, segments)) {
    return 'events_panel';
  }

  const path = normalizePath(pathname);

  if (path === '/como-faco' && catalog === 'manutencao') {
    return null;
  }

  return MEMBER_MENU_PATHS.find((item) => item.path === path)?.moduleKey ?? null;
}

function canScroll(node: Element, direction: 'up' | 'down') {
  const overflowY = window.getComputedStyle(node).overflowY;
  const scrollable =
    (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay')
    && node.scrollHeight > node.clientHeight + 1;

  if (!scrollable) {
    return false;
  }

  if (direction === 'up') {
    return node.scrollTop > 0;
  }

  return node.scrollTop + node.clientHeight < node.scrollHeight - 1;
}

function pageCanScroll(start: EventTarget | null, direction: 'up' | 'down') {
  let node = start instanceof Element ? start : null;

  while (node) {
    if (canScroll(node, direction)) {
      return true;
    }

    node = node.parentElement;
  }

  const scrollingElement = document.scrollingElement;

  if (!scrollingElement) {
    return false;
  }

  if (direction === 'up') {
    return scrollingElement.scrollTop > 0;
  }

  return scrollingElement.scrollTop + scrollingElement.clientHeight < scrollingElement.scrollHeight - 1;
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return false;
  }

  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

type UseMemberMenuSwipeArgs = {
  items: AppDrawerMenuItemResolved[];
  suspended: boolean;
};

/**
 * No celular, o arraste vertical percorre o menu lateral acima da engrenagem,
 * só com as telas que a pessoa pode abrir.
 * Para baixo: item anterior. Na tela inicial, o diálogo Encerrar sessão.
 * Para cima: próximo item. No último, volta à tela principal.
 * O gesto só vale quando a própria tela não tem mais conteúdo naquela direção.
 */
export function useMemberMenuSwipe({ items, suspended }: UseMemberMenuSwipeArgs) {
  const router = useRouter();
  const pathname = usePathname();
  const segments = useSegments();
  const params = useGlobalSearchParams<{ catalog?: string | string[] }>();
  const catalog = Array.isArray(params.catalog) ? params.catalog[0] ?? '' : params.catalog ?? '';
  const itemsRef = useRef(items);
  const suspendedRef = useRef(suspended);
  const busyRef = useRef(false);
  itemsRef.current = items;
  suspendedRef.current = suspended;

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof document === 'undefined') {
      return undefined;
    }

    const currentModule = memberModuleForLocation(pathname, segments, catalog);

    if (!currentModule) {
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
    let atTop = false;
    let atBottom = false;
    let tracking = false;

    const goTo = (moduleKey: AppDrawerModuleKey) => {
      if (busyRef.current) {
        return;
      }

      busyRef.current = true;
      const method = currentModule === 'events_panel' && moduleKey !== 'events_panel' ? 'push' : 'replace';
      void navigateDrawerMenuItem(router, moduleKey, method).finally(() => {
        window.setTimeout(() => {
          busyRef.current = false;
        }, 400);
      });
    };

    const move = (direction: 'prev' | 'next') => {
      if (suspendedRef.current || busyRef.current) {
        return;
      }

      const sequence = itemsRef.current.filter((item) => item.enabled && !item.pendingRoute);
      const index = sequence.findIndex((item) => item.moduleKey === currentModule);

      if (index < 0) {
        return;
      }

      if (direction === 'prev') {
        if (index === 0) {
          busyRef.current = true;
          void confirmExitApplication().finally(() => {
            busyRef.current = false;
          });
          return;
        }

        const previous = sequence[index - 1];
        if (previous) {
          goTo(previous.moduleKey);
        }
        return;
      }

      if (index >= sequence.length - 1) {
        if (currentModule !== 'events_panel') {
          goTo('events_panel');
        }
        return;
      }

      const next = sequence[index + 1];
      if (next) {
        goTo(next.moduleKey);
      }
    };

    const resetTracking = () => {
      tracking = false;
    };

    const onTouchStart = (event: TouchEvent) => {
      if (
        event.touches.length !== 1
        || suspendedRef.current
        || busyRef.current
        || isEditableTarget(event.target)
        || document.getElementById('confirm-dialog-overlay')
      ) {
        tracking = false;
        return;
      }

      atTop = !pageCanScroll(event.target, 'up');
      atBottom = !pageCanScroll(event.target, 'down');

      if (!atTop && !atBottom) {
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
      const vertical = Math.abs(deltaY) > Math.abs(deltaX);

      if (atTop && deltaY > 12 && vertical) {
        event.preventDefault();
      }

      if (atBottom && deltaY < -12 && vertical) {
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

      if (Math.abs(deltaY) < SWIPE_DISTANCE || Math.abs(deltaY) <= Math.abs(deltaX)) {
        return;
      }

      if (deltaY > 0 && atTop) {
        move('prev');
        return;
      }

      if (deltaY < 0 && atBottom) {
        move('next');
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
  }, [catalog, pathname, router, segments]);
}

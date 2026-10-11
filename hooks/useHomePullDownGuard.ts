import { useEffect } from 'react';
import { Platform } from 'react-native';

const HOME_PULL_LOCK_CLASS = 'home-pull-locked';

let pullDownActive = false;

/** O gesto vertical para baixo na home não deve virar voltar nem recarregar. */
export function consumeHomePullDownGesture() {
  if (!pullDownActive) {
    return false;
  }

  pullDownActive = false;
  return true;
}

const markHomePullDown = () => {
  pullDownActive = true;
  window.setTimeout(() => {
    pullDownActive = false;
  }, 700);
};

const canScrollTowardStart = (target: EventTarget | null) => {
  let node = target instanceof Element ? target : null;

  while (node) {
    const style = window.getComputedStyle(node);
    const scrolls = style.overflowY === 'auto' || style.overflowY === 'scroll';

    if (scrolls && node.scrollHeight > node.clientHeight + 1 && node.scrollTop > 0) {
      return true;
    }

    node = node.parentElement;
  }

  return false;
};

/**
 * Na tela inicial, arrastar para baixo não recarrega a página nem dispara a saída do app.
 */
export function useHomePullDownGuard() {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') {
      return undefined;
    }

    const root = document.documentElement;
    root.classList.add(HOME_PULL_LOCK_CLASS);

    let startX = 0;
    let startY = 0;

    const onTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      startX = touch?.clientX ?? 0;
      startY = touch?.clientY ?? 0;
    };

    const onTouchMove = (event: TouchEvent) => {
      const touch = event.touches[0];

      if (!touch) {
        return;
      }

      const deltaX = touch.clientX - startX;
      const deltaY = touch.clientY - startY;

      if (deltaY <= 8 || Math.abs(deltaY) <= Math.abs(deltaX)) {
        return;
      }

      if (canScrollTowardStart(event.target)) {
        return;
      }

      markHomePullDown();
      event.preventDefault();
    };

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: false });

    return () => {
      root.classList.remove(HOME_PULL_LOCK_CLASS);
      pullDownActive = false;
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
    };
  }, []);
}

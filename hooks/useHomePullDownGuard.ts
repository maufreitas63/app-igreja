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

const verticalScroller = (target: EventTarget | null) => {
  let node = target instanceof Element ? target : null;

  while (node && node !== document.body) {
    const style = window.getComputedStyle(node);
    const overflowY = style.overflowY;
    const scrolls = overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay';

    if (scrolls && node.scrollHeight > node.clientHeight + 1) {
      return node;
    }

    node = node.parentElement;
  }

  return null;
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

      if (Math.abs(deltaY) <= 8 || Math.abs(deltaY) <= Math.abs(deltaX)) {
        return;
      }

      const scroller = verticalScroller(event.target);

      if (scroller) {
        const atStart = scroller.scrollTop <= 0;
        const pullingPastStart = deltaY > 0 && atStart;

        if (!pullingPastStart) {
          return;
        }
      } else if (deltaY <= 0) {
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

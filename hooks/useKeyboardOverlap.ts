import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/** Distância (px) em que o teclado cobre a parte de baixo da janela de layout. */
export function useKeyboardOverlap() {
  const [overlap, setOverlap] = useState(0);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const viewport = window.visualViewport;
      const update = () => {
        const height = viewport?.height ?? window.innerHeight;
        const offsetTop = viewport?.offsetTop ?? 0;
        setOverlap(Math.max(0, Math.round(window.innerHeight - height - offsetTop)));
      };

      update();
      viewport?.addEventListener('resize', update);
      viewport?.addEventListener('scroll', update);
      window.addEventListener('resize', update);

      return () => {
        viewport?.removeEventListener('resize', update);
        viewport?.removeEventListener('scroll', update);
        window.removeEventListener('resize', update);
      };
    }

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (event) => {
      setOverlap(Math.max(0, Math.round(event.endCoordinates?.height ?? 0)));
    });
    const hideSub = Keyboard.addListener(hideEvent, () => setOverlap(0));

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return overlap;
}

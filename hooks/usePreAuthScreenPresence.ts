import { setPreAuthScreenFocused } from '@/lib/abigailFabVisibility';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

/** Tela anterior à senha de 4 dígitos e à abertura do início. */
export function usePreAuthScreenPresence() {
  useFocusEffect(
    useCallback(() => {
      setPreAuthScreenFocused(true);
      return () => setPreAuthScreenFocused(false);
    }, [])
  );
}

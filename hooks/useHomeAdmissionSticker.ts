import {
  fetchHomeAdmissionStickerState,
  type HomeAdmissionStickerState,
} from '@/lib/homeAdmissionStickerApi';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

const HIDDEN: HomeAdmissionStickerState = {
  visible: false,
  hasNewRegistrations: false,
  hasReceptionPending: false,
};

export function useHomeAdmissionSticker(isActive = true) {
  const [state, setState] = useState<HomeAdmissionStickerState>(HIDDEN);
  const [loading, setLoading] = useState(false);

  const refetch = useCallback(async () => {
    if (!isActive) {
      setState(HIDDEN);
      return;
    }

    setLoading(true);
    try {
      setState(await fetchHomeAdmissionStickerState());
    } catch (error) {
      console.warn('Sticker de admissão:', error);
      setState(HIDDEN);
    } finally {
      setLoading(false);
    }
  }, [isActive]);

  useFocusEffect(
    useCallback(() => {
      if (!isActive) {
        return;
      }
      void refetch();
    }, [isActive, refetch])
  );

  return { ...state, loading, refetch };
}

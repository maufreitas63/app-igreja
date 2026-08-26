import { showAppToast } from '@/lib/appToast';
import { hasStoredMemberSession } from '@/lib/memberSession';
import { fetchUnreadScaleSwapNotices, markScaleSwapNoticesRead } from '@/lib/scaleSwapApi';
import React, { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

const POLL_MS = 60_000;

/** Avisa o substituto (e o solicitante) sobre pedidos de troca de escala. */
export function ScaleSwapNoticesListener() {
  const lastNoticeIdRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const poll = async () => {
      const hasSession = await hasStoredMemberSession();

      if (!hasSession || cancelled) {
        return;
      }

      const notices = await fetchUnreadScaleSwapNotices();
      const unread = notices[0];

      if (!unread || unread.id === lastNoticeIdRef.current) {
        return;
      }

      lastNoticeIdRef.current = unread.id;
      showAppToast({
        type: 'info',
        text1: unread.title,
        text2: unread.body,
      });
      void markScaleSwapNoticesRead();
    };

    void poll();
    timer = setInterval(() => {
      void poll();
    }, POLL_MS);

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void poll();
      }
    });

    return () => {
      cancelled = true;

      if (timer) {
        clearInterval(timer);
      }

      sub.remove();
    };
  }, []);

  return null;
}

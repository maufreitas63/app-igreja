import { fetchMyPastoralSlotNotices, markPastoralSlotNoticesRead } from '@/lib/pastoralSlotsApi';
import { hasStoredMemberSession } from '@/lib/memberSession';
import { showAppToast } from '@/lib/appToast';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

const POLL_MS = 60_000;

/** Dispara avisos automáticos 2h antes do atendimento (membro e pastor). */
export function PastoralAppointmentReminderListener() {
  const lastNoticeIdRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const poll = async () => {
      const hasSession = await hasStoredMemberSession();

      if (!hasSession || cancelled) {
        return;
      }

      const notices = await fetchMyPastoralSlotNotices();
      const unread = notices.find((notice) => !notice.read_at);

      if (!unread || unread.id === lastNoticeIdRef.current) {
        return;
      }

      lastNoticeIdRef.current = unread.id;
      showAppToast({
        type: 'info',
        text1: unread.title,
        text2: unread.body,
      });
      void markPastoralSlotNoticesRead();
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

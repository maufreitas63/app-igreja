import { listPendingFamilyReceptionSubmissions } from '@/lib/familyReceptionNotificationApi';
import { notifySuperAdminOfNewFamilyReceptionSubmissions } from '@/lib/familyReceptionNotification';
import { useEffect, useRef } from 'react';

const DEFAULT_POLL_INTERVAL_MS = 60_000;

export function useFamilyReceptionSuperAdminNotifier(
  enabled: boolean,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS
) {
  const pollInFlightRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;

    const poll = async () => {
      if (pollInFlightRef.current || cancelled) {
        return;
      }

      pollInFlightRef.current = true;

      try {
        const submissions = await listPendingFamilyReceptionSubmissions();
        await notifySuperAdminOfNewFamilyReceptionSubmissions(submissions);
      } catch (error) {
        console.warn('Falha ao verificar novos lotes da recepção familiar:', error);
      } finally {
        pollInFlightRef.current = false;
      }
    };

    void poll();

    const intervalId = setInterval(() => {
      void poll();
    }, pollIntervalMs);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [enabled, pollIntervalMs]);
}

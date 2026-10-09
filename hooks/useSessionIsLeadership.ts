import { sessionCanUseAiAssistant } from '@/lib/aiLeadershipAccess';
import { subscribeGhostMode } from '@/lib/ghostMode';
import { useCallback, useEffect, useRef, useState } from 'react';

export function useSessionCanUseAiAssistant(enabled = true) {
  const [allowed, setAllowed] = useState(false);
  const requestRef = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;

    if (!enabled) {
      setAllowed(false);
      return false;
    }

    try {
      const next = await sessionCanUseAiAssistant();

      if (requestRef.current === requestId) {
        setAllowed(next);
      }

      return next;
    } catch {
      if (requestRef.current === requestId) {
        setAllowed(false);
      }

      return false;
    }
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    return subscribeGhostMode(() => {
      void refresh();
    });
  }, [enabled, refresh]);

  return { allowed, refresh };
}

import { sessionCanUseAiAssistant } from '@/lib/aiLeadershipAccess';
import { subscribeGhostMode } from '@/lib/ghostMode';
import { useCallback, useEffect, useState } from 'react';

export function useSessionCanUseAiAssistant() {
  const [allowed, setAllowed] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setAllowed(await sessionCanUseAiAssistant());
    } catch {
      setAllowed(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => subscribeGhostMode(() => void refresh()), [refresh]);

  return { allowed, refresh };
}

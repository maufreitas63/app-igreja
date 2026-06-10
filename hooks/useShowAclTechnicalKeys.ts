import { isExibirNomesTecnicosEnabled } from '@/lib/appParameters';
import { checkSessionIsSuperAdmin } from '@/lib/maintenanceAccessControlApi';
import { useEffect, useState } from 'react';

export function useShowAclTechnicalKeys(enabled = true) {
  const [showTechnicalKeys, setShowTechnicalKeys] = useState(false);
  const [loading, setLoading] = useState(enabled);

  useEffect(() => {
    if (!enabled) {
      setShowTechnicalKeys(false);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void (async () => {
      try {
        const isSuperAdmin = await checkSessionIsSuperAdmin();
        if (!isSuperAdmin) {
          if (!cancelled) {
            setShowTechnicalKeys(false);
          }
          return;
        }

        const shouldShow = await isExibirNomesTecnicosEnabled();
        if (!cancelled) {
          setShowTechnicalKeys(shouldShow);
        }
      } catch {
        if (!cancelled) {
          setShowTechnicalKeys(false);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { showTechnicalKeys, loading };
}

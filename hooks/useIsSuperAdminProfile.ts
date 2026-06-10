import { checkSessionIsSuperAdmin } from '@/lib/maintenanceAccessControlApi';
import { useEffect, useState } from 'react';

export function useIsSuperAdminProfile(enabled = true) {
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(enabled);

  useEffect(() => {
    if (!enabled) {
      setIsSuperAdmin(false);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void checkSessionIsSuperAdmin()
      .then((allowed) => {
        if (!cancelled) {
          setIsSuperAdmin(allowed);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setIsSuperAdmin(false);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { isSuperAdmin, loading };
}

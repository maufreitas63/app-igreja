import {
  recordProfileScreenVisit,
  resolveRouteScreenVisit,
} from '@/lib/profileScreenVisitTracking';
import { usePathname, useSegments } from 'expo-router';
import { useEffect } from 'react';

export function useProfileScreenVisitTracker() {
  const pathname = usePathname();
  const segments = useSegments();

  useEffect(() => {
    const visit = resolveRouteScreenVisit(pathname, segments);

    if (!visit) {
      return;
    }

    void recordProfileScreenVisit(visit.screenKey, visit.screenLabel);
  }, [pathname, segments]);
}

import { isClickTraceEnabled, traceClick } from '@/lib/devClickTrace';
import { usePathname, useSegments } from 'expo-router';
import { useEffect, useRef } from 'react';

/** Em dev, registra mudanças de rota quando o trace de cliques está ativo. */
export function useDevNavigationTrace() {
  const pathname = usePathname();
  const segments = useSegments();
  const previousPathRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isClickTraceEnabled()) {
      return;
    }

    const current = `${pathname}?segments=${segments.join('/')}`;

    if (previousPathRef.current === current) {
      return;
    }

    traceClick('navigation', 'route-change', {
      from: previousPathRef.current,
      to: pathname,
      segments,
    });

    previousPathRef.current = current;
  }, [pathname, segments]);
}

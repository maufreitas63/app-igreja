import { isTotemDeviceSession } from '@/lib/totemDevice';
import { usePathname, useRouter } from 'expo-router';
import { useEffect } from 'react';

const isAllowedTotemPath = (pathname: string | null) => {
  if (!pathname) {
    return false;
  }

  const normalized = pathname.replace(/\/$/, '') || '/';

  return (
    normalized === '/' ||
    normalized === '/index' ||
    normalized === '/totem-checkin' ||
    normalized.startsWith('/totem-checkin')
  );
};

/** Impede dispositivo totem de acessar outras telas além do login e do leitor QR. */
export const useTotemDeviceRouteGuard = () => {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    let active = true;

    void (async () => {
      const isTotem = await isTotemDeviceSession();

      if (!active || !isTotem || isAllowedTotemPath(pathname)) {
        return;
      }

      router.replace('/totem-checkin');
    })();

    return () => {
      active = false;
    };
  }, [pathname, router]);
};

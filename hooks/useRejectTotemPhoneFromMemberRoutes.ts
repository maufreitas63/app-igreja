import { isTotemExclusivePhone } from '@/lib/totemDevice';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';

/** Redireciona celular reservado ao totem para fora de cadastro/LGPD/painel. */
export const useRejectTotemPhoneFromMemberRoutes = (phone: string | null | undefined) => {
  const router = useRouter();

  useEffect(() => {
    let active = true;

    void (async () => {
      if (!phone?.trim()) {
        return;
      }

      const isTotem = await isTotemExclusivePhone(phone);

      if (!active || !isTotem) {
        return;
      }

      router.replace('/');
    })();

    return () => {
      active = false;
    };
  }, [phone, router]);
};

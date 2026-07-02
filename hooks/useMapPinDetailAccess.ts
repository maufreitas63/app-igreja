import { ACCESS_SCREEN, checkOperatorIsSuperAdmin, sessionHasAccess } from '@/lib/accessControl';
import { useCallback, useEffect, useState } from 'react';

export const MAP_PIN_DETAIL_DENIED_MESSAGE =
  'Você pode ver o mapa geral, mas não tem permissão para abrir a localização de outros usuários.';

export function useMapPinDetailAccess() {
  const [canViewMapPinDetails, setCanViewMapPinDetails] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);

    try {
      const [operatorSuperAdmin, allowed] = await Promise.all([
        checkOperatorIsSuperAdmin(),
        sessionHasAccess('screen', ACCESS_SCREEN.mapGeolocationPinDetail, 'view'),
      ]);

      setCanViewMapPinDetails(operatorSuperAdmin || allowed);
    } catch {
      setCanViewMapPinDetails(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { canViewMapPinDetails, loading, refresh };
}

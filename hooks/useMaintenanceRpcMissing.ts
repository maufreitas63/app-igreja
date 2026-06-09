import { useCallback, useState } from 'react';

/** Estado compartilhado para cards de manutenção quando RPCs SQL ainda não foram aplicadas. */
export function useMaintenanceRpcMissing() {
  const [rpcMissing, setRpcMissing] = useState(false);

  const beginMaintenanceRequest = useCallback(() => {
    setRpcMissing(false);
  }, []);

  const resolveMaintenanceRpcError = useCallback(
    (err: unknown, missingToken: string, hint: string): string | null => {
      if (err instanceof Error && err.message === missingToken) {
        setRpcMissing(true);
        return hint;
      }

      return null;
    },
    []
  );

  return {
    rpcMissing,
    setRpcMissing,
    beginMaintenanceRequest,
    resolveMaintenanceRpcError,
  };
}

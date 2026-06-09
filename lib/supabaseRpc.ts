/** Detecta RPC ausente no PostgREST / Supabase (PGRST202, could not find, etc.). */
export const isSupabaseRpcMissing = (message: string, functionName: string) => {
  const normalized = message.toLowerCase();
  const fn = functionName.toLowerCase();

  return (
    normalized.includes(fn)
    && (normalized.includes('could not find')
      || normalized.includes('does not exist')
      || normalized.includes('pgrst202'))
  );
};

export const isSupabaseRpcMissingError = (
  error: { message?: string; code?: string } | null | undefined,
  functionName: string
) => {
  if (!error) {
    return false;
  }

  if (error.code === 'PGRST202') {
    return true;
  }

  return isSupabaseRpcMissing(error.message ?? '', functionName);
};

/** Normaliza boolean retornado por RPC PostgREST (evita confiar em cast direto). */
export const coerceRpcBoolean = (value: unknown): boolean => {
  if (value === true || value === 'true' || value === 1 || value === '1') {
    return true;
  }

  return false;
};

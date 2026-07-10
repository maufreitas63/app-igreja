import { DEFAULT_ENTITY_PREFIX, resolveEntityPrefixOrFallback } from '@/lib/entityPrefixCore';
import { supabaseBrowser } from '@/lib/supabaseBrowser';

let cachedEntityPrefix: string | null = null;
let inflightEntityPrefix: Promise<string> | null = null;

async function fetchEntityPrefixFromSupabase(): Promise<string | null> {
  const { data: rpcData, error: rpcError } = await supabaseBrowser.rpc('get_app_parameter_value', {
    p_parameter: 'Parm_entidade',
  });

  if (!rpcError && typeof rpcData === 'string' && rpcData.trim()) {
    return rpcData;
  }

  const { data: rows, error } = await supabaseBrowser
    .from('app_parameters')
    .select('parameter, value')
    .ilike('parameter', 'Parm_entidade');

  if (error) {
    throw error;
  }

  const match = rows?.find((row) => (row.parameter ?? '').trim() === 'Parm_entidade')
    ?? rows?.find((row) => (row.parameter ?? '').trim().toLowerCase() === 'parm_entidade');

  return match?.value?.trim() || null;
}

/** Prefixo da entidade para páginas web standalone (sem dependência do app Expo). */
export async function getEntityPrefixBrowser(): Promise<string> {
  if (cachedEntityPrefix) {
    return cachedEntityPrefix;
  }

  if (inflightEntityPrefix) {
    return inflightEntityPrefix;
  }

  inflightEntityPrefix = (async () => {
    try {
      const value = await fetchEntityPrefixFromSupabase();
      cachedEntityPrefix = resolveEntityPrefixOrFallback(value);
      return cachedEntityPrefix;
    } catch (error) {
      console.error('Erro ao carregar Parm_entidade:', error);
      cachedEntityPrefix = resolveEntityPrefixOrFallback(DEFAULT_ENTITY_PREFIX);
      return cachedEntityPrefix;
    } finally {
      inflightEntityPrefix = null;
    }
  })();

  return inflightEntityPrefix;
}

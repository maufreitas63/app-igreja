import { isAppParameterNo } from '@/lib/checkInVisibility';
import { supabase } from '@/lib/supabase';

export const EXIBIR_NOMES_TECNICOS_PARAMETER = 'Exibir_nomes_tecnicos';
export const LGPD_ATIVO_PARAMETER = 'LGPD_Ativo';

const PARAMETER_CACHE_TTL_MS = 5 * 60 * 1000;

type CacheEntry = {
  value: string | null;
  expiresAt: number;
};

const parameterCache = new Map<string, CacheEntry>();
const inflightRequests = new Map<string, Promise<string | null>>();

async function fetchAppParameterValue(parameter: string): Promise<string | null> {
  const { data: rpcData, error: rpcError } = await supabase.rpc('get_app_parameter_value', {
    p_parameter: parameter,
  });

  if (!rpcError) {
    return typeof rpcData === 'string' && rpcData.trim() ? rpcData : null;
  }

  const { data, error } = await supabase
    .from('app_parameters')
    .select('value')
    .eq('parameter', parameter)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data?.value?.trim() || null;
}

export function clearAppParameterCache(parameter?: string) {
  if (!parameter?.trim()) {
    parameterCache.clear();
    inflightRequests.clear();
    return;
  }

  const key = parameter.trim();
  parameterCache.delete(key);
  inflightRequests.delete(key);
}

export async function getAppParameterValue(parameter: string) {
  const normalizedParameter = parameter.trim();

  if (!normalizedParameter) {
    return null;
  }

  const cached = parameterCache.get(normalizedParameter);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const inflight = inflightRequests.get(normalizedParameter);
  if (inflight) {
    return inflight;
  }

  const request = fetchAppParameterValue(normalizedParameter)
    .then((value) => {
      parameterCache.set(normalizedParameter, {
        value,
        expiresAt: Date.now() + PARAMETER_CACHE_TTL_MS,
      });
      return value;
    })
    .finally(() => {
      inflightRequests.delete(normalizedParameter);
    });

  inflightRequests.set(normalizedParameter, request);
  return request;
}

export function isAppParameterSim(value: string | null | undefined) {
  return (value ?? '').trim().toLocaleLowerCase() === 'sim';
}

export function resolveLgpdAtivoFromParameter(value: string | null | undefined) {
  if (value == null || !value.trim()) {
    return true;
  }

  return !isAppParameterNo(value);
}

export function isProfileLgpdPending(
  lgpdAccepted: boolean | null | undefined,
  lgpdAtivo: boolean
) {
  return lgpdAtivo && lgpdAccepted === false;
}

export async function isLgpdAtivoEnabled() {
  const value = await getAppParameterValue(LGPD_ATIVO_PARAMETER);
  return resolveLgpdAtivoFromParameter(value);
}

export async function saveAppParameterValue(parameter: string, value: string) {
  const normalizedParameter = parameter.trim();
  const normalizedValue = value.trim();

  if (!normalizedParameter) {
    throw new Error('Parâmetro inválido.');
  }

  const { error } = await supabase
    .from('app_parameters')
    .upsert(
      { parameter: normalizedParameter, value: normalizedValue },
      { onConflict: 'parameter' }
    );

  if (error) {
    throw error;
  }

  clearAppParameterCache(normalizedParameter);
}

export async function isExibirNomesTecnicosEnabled() {
  const value = await getAppParameterValue(EXIBIR_NOMES_TECNICOS_PARAMETER);
  return isAppParameterSim(value);
}

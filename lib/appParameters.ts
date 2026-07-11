import AsyncStorage from '@react-native-async-storage/async-storage';
import { isAppParameterNo } from '@/lib/checkInVisibility';
import { resolveActorProfileId } from '@/lib/maintenanceAccessControlApi';
import { supabase } from '@/lib/supabase';
import { isSupabaseRpcMissing } from '@/lib/supabaseRpc';

export const EXIBIR_NOMES_TECNICOS_PARAMETER = 'Exibir_nomes_tecnicos';
export const LGPD_ATIVO_PARAMETER = 'LGPD_Ativo';

export const SALVAR_APP_PARAMETER_ADMIN_SQL_HINT =
  'Execute no Supabase: scripts/salvar-app-parameter-admin.sql';

/** Espelha `USER_TENANT_ID_STORAGE_KEY` sem importar tenantSession (evita ciclo). */
const TENANT_ID_STORAGE_KEY = 'user_tenant_id';

const PARAMETER_CACHE_TTL_MS = 5 * 60 * 1000;

type CacheEntry = {
  value: string | null;
  expiresAt: number;
};

const parameterCache = new Map<string, CacheEntry>();
const inflightRequests = new Map<string, Promise<string | null>>();

function buildParameterCacheKey(parameter: string, tenantId: string | null) {
  return `${tenantId ?? 'none'}::${parameter}`;
}

async function readStoredTenantId(): Promise<string | null> {
  const raw = (await AsyncStorage.getItem(TENANT_ID_STORAGE_KEY))?.trim();
  return raw || null;
}

async function fetchAppParameterValue(parameter: string): Promise<string | null> {
  const { data: rpcData, error: rpcError } = await supabase.rpc('get_app_parameter_value', {
    p_parameter: parameter,
  });

  if (!rpcError) {
    return typeof rpcData === 'string' && rpcData.trim() ? rpcData : null;
  }

  const tenantId = await readStoredTenantId();
  let query = supabase.from('app_parameters').select('parameter, value').ilike('parameter', parameter);

  if (tenantId) {
    query = query.eq('tenant_id', tenantId);
  }

  const { data: rows, error } = await query;

  if (error) {
    throw error;
  }

  const match = rows?.find((row) => (row.parameter ?? '').trim() === parameter.trim())
    ?? rows?.find((row) => (row.parameter ?? '').trim().toLowerCase() === parameter.trim().toLowerCase());

  return match?.value?.trim() || null;
}

export function clearAppParameterCache(parameter?: string) {
  if (!parameter?.trim()) {
    parameterCache.clear();
    inflightRequests.clear();
    return;
  }

  const needle = `::${parameter.trim()}`;
  for (const key of [...parameterCache.keys()]) {
    if (key.endsWith(needle) || key === parameter.trim()) {
      parameterCache.delete(key);
    }
  }
  for (const key of [...inflightRequests.keys()]) {
    if (key.endsWith(needle) || key === parameter.trim()) {
      inflightRequests.delete(key);
    }
  }
}

export async function getAppParameterValue(parameter: string) {
  const normalizedParameter = parameter.trim();

  if (!normalizedParameter) {
    return null;
  }

  const tenantId = await readStoredTenantId();
  const cacheKey = buildParameterCacheKey(normalizedParameter, tenantId);

  const cached = parameterCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const inflight = inflightRequests.get(cacheKey);
  if (inflight) {
    return inflight;
  }

  const request = fetchAppParameterValue(normalizedParameter)
    .then((value) => {
      parameterCache.set(cacheKey, {
        value,
        expiresAt: Date.now() + PARAMETER_CACHE_TTL_MS,
      });
      return value;
    })
    .finally(() => {
      inflightRequests.delete(cacheKey);
    });

  inflightRequests.set(cacheKey, request);
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

function parseRpcJsonPayload(data: unknown): Record<string, unknown> {
  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data) as unknown;
      return typeof parsed === 'object' && parsed !== null
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }

  return typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {};
}

function isRlsViolationMessage(message: string) {
  const normalized = message.toLowerCase();
  return normalized.includes('row-level security') || normalized.includes('42501');
}

async function saveAppParameterDirect(parameter: string, value: string) {
  const { data: rows, error: selectError } = await supabase
    .from('app_parameters')
    .select('parameter')
    .ilike('parameter', parameter);

  if (selectError) {
    throw selectError;
  }

  const existing = rows?.find(
    (row) => (row.parameter ?? '').trim().toLowerCase() === parameter.toLowerCase()
  );

  if (existing?.parameter) {
    const { error: updateError } = await supabase
      .from('app_parameters')
      .update({ value })
      .eq('parameter', existing.parameter);

    if (updateError) {
      throw updateError;
    }

    return;
  }

  const { error: insertError } = await supabase
    .from('app_parameters')
    .insert({ parameter, value });

  if (insertError) {
    throw insertError;
  }
}

export async function saveAppParameterValue(parameter: string, value: string) {
  const normalizedParameter = parameter.trim();
  const normalizedValue = value.trim();

  if (!normalizedParameter) {
    throw new Error('Parâmetro inválido.');
  }

  const actorProfileId = await resolveActorProfileId();

  if (!actorProfileId) {
    throw new Error('Sessão inválida. Saia e entre novamente.');
  }

  const { data, error } = await supabase.rpc('salvar_app_parameter_admin', {
    p_actor_profile_id: actorProfileId,
    p_parameter: normalizedParameter,
    p_value: normalizedValue,
  });

  if (error) {
    const message = error.message ?? '';

    if (isSupabaseRpcMissing(message.toLowerCase(), 'salvar_app_parameter_admin')) {
      try {
        await saveAppParameterDirect(normalizedParameter, normalizedValue);
        clearAppParameterCache(normalizedParameter);
        return;
      } catch (directError) {
        throw new Error(
          `Função salvar_app_parameter_admin não encontrada e gravação direta falhou.\n\n${SALVAR_APP_PARAMETER_ADMIN_SQL_HINT}`
        );
      }
    }

    if (isRlsViolationMessage(message)) {
      try {
        await saveAppParameterDirect(normalizedParameter, normalizedValue);
        clearAppParameterCache(normalizedParameter);
        return;
      } catch (directError) {
        throw new Error(
          `${message}\n\nExecute no Supabase: scripts/salvar-app-parameter-admin.sql (políticas de escrita super_admin).`
        );
      }
    }

    throw new Error(message || 'Não foi possível salvar o parâmetro.');
  }

  const payload = parseRpcJsonPayload(data);

  if (payload.success !== true) {
    const rpcMessage =
      typeof payload.message === 'string' && payload.message.trim()
        ? payload.message
        : 'Não foi possível salvar o parâmetro.';

    if (isRlsViolationMessage(rpcMessage)) {
      try {
        await saveAppParameterDirect(normalizedParameter, normalizedValue);
        clearAppParameterCache(normalizedParameter);
        return;
      } catch (directError) {
        throw new Error(
          `${rpcMessage}\n\nExecute no Supabase: scripts/salvar-app-parameter-admin.sql (políticas de escrita super_admin).`
        );
      }
    }

    throw new Error(rpcMessage);
  }

  clearAppParameterCache(normalizedParameter);
}

export async function isExibirNomesTecnicosEnabled() {
  const value = await getAppParameterValue(EXIBIR_NOMES_TECNICOS_PARAMETER);
  return isAppParameterSim(value);
}

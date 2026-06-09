import { parseRegisterScaleRpc } from '@/lib/maintenanceScales';
import { supabase } from '@/lib/supabase';
import { isSupabaseRpcMissing } from '@/lib/supabaseRpc';

export const MAINTENANCE_SCALE_TYPES_SQL_HINT =
  'Execute no Supabase: scripts/vigilancia-escalas.sql, scripts/escalas-multi-vagas.sql e scripts/escalas-tipos-maintenance-rpc.sql.';

export const MAINTENANCE_SCALE_TYPES_RPC_MISSING = 'MAINTENANCE_SCALE_TYPES_RPC_MISSING';

export type ScaleCycleMode = 'individual' | 'equipe';

export type MaintenanceScaleTypeRecord = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  vagasPorServico: number;
  modoCiclo: ScaleCycleMode;
  createdAt: string | null;
  updatedAt: string | null;
};

const throwRpcMissing = () => {
  const schemaError = new Error(MAINTENANCE_SCALE_TYPES_RPC_MISSING);
  schemaError.name = 'MaintenanceScaleTypesRpcMissing';
  throw schemaError;
};

export const normalizeScaleTypeCode = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');

const parseScaleTypeRows = (data: unknown): MaintenanceScaleTypeRecord[] => {
  if (!Array.isArray(data)) {
    return [];
  }

  return data
    .map((row) => {
      const record = row as Record<string, unknown>;
      const id = String(record.id ?? '').trim();
      const code = String(record.codigo ?? record.code ?? '').trim();
      const name = String(record.nome ?? record.name ?? '').trim();

      if (!id || !code || !name) {
        return null;
      }

      const vagasRaw = record.vagas_por_servico ?? record.vagasPorServico;
      const vagasPorServico =
        typeof vagasRaw === 'number'
          ? Math.max(1, Math.min(vagasRaw, 50))
          : typeof vagasRaw === 'string'
            ? Math.max(1, Math.min(Number.parseInt(vagasRaw, 10) || 1, 50))
            : 1;

      const modoRaw = String(record.modo_ciclo ?? record.modoCiclo ?? 'individual').toLowerCase();

      return {
        id,
        code,
        name,
        isActive: record.is_ativa === true || record.is_ativa === 'true' || record.isActive === true,
        vagasPorServico,
        modoCiclo: modoRaw === 'equipe' ? 'equipe' : 'individual',
        createdAt: record.created_at != null ? String(record.created_at) : null,
        updatedAt: record.updated_at != null ? String(record.updated_at) : null,
      } satisfies MaintenanceScaleTypeRecord;
    })
    .filter((row): row is MaintenanceScaleTypeRecord => row !== null);
};

export async function fetchMaintenanceScaleTypesAll() {
  const { data, error } = await supabase.rpc('listar_tipos_escala_manutencao');

  if (error) {
    const message = (error.message ?? '').toLowerCase();

    if (isSupabaseRpcMissing(message, 'listar_tipos_escala_manutencao')) {
      throwRpcMissing();
    }

    throw error;
  }

  return parseScaleTypeRows(data);
}

async function fetchMaintenanceScaleTypesDirect() {
  const { data, error } = await supabase
    .from('tipos_escala')
    .select('id, codigo, nome, is_ativa, vagas_por_servico, modo_ciclo, created_at, updated_at')
    .order('is_ativa', { ascending: false })
    .order('nome', { ascending: true });

  if (error) {
    throw error;
  }

  return parseScaleTypeRows(data);
}

export async function listMaintenanceScaleTypes() {
  try {
    return await fetchMaintenanceScaleTypesAll();
  } catch (err) {
    if (err instanceof Error && err.message === MAINTENANCE_SCALE_TYPES_RPC_MISSING) {
      return fetchMaintenanceScaleTypesDirect();
    }

    throw err;
  }
}

export async function createMaintenanceScaleType(
  code: string,
  name: string,
  vagasPorServico = 1,
  modoCiclo: ScaleCycleMode = 'individual'
) {
  const normalizedCode = normalizeScaleTypeCode(code);
  const trimmedName = name.trim();
  const vagas = Math.max(1, Math.min(vagasPorServico, 50));
  const modo = modoCiclo === 'equipe' ? 'equipe' : 'individual';

  const { data, error } = await supabase.rpc('cadastrar_tipo_escala', {
    p_codigo: normalizedCode,
    p_nome: trimmedName,
    p_vagas_por_servico: vagas,
    p_modo_ciclo: modo,
  });

  if (error) {
    const message = (error.message ?? '').toLowerCase();

    if (isSupabaseRpcMissing(message, 'cadastrar_tipo_escala')) {
      return createMaintenanceScaleTypeDirect(normalizedCode, trimmedName);
    }

    throw error;
  }

  return parseRegisterScaleRpc(data);
}

async function createMaintenanceScaleTypeDirect(code: string, name: string) {
  const { data, error } = await supabase
    .from('tipos_escala')
    .insert({ codigo: code, nome: name, is_ativa: true })
    .select('id, codigo, nome')
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data?.id) {
    return { success: false as const, message: 'Não foi possível cadastrar o tipo de escala.' };
  }

  return {
    success: true as const,
    message: 'Tipo de escala cadastrado.',
    status: String(data.nome),
  };
}

export async function updateMaintenanceScaleType(
  id: string,
  code: string,
  name: string,
  isActive = true,
  vagasPorServico?: number,
  modoCiclo?: ScaleCycleMode
) {
  const normalizedCode = normalizeScaleTypeCode(code);
  const trimmedName = name.trim();

  const payload: Record<string, unknown> = {
    p_id: id,
    p_codigo: normalizedCode,
    p_nome: trimmedName,
    p_is_ativa: isActive,
  };

  if (vagasPorServico != null) {
    payload.p_vagas_por_servico = Math.max(1, Math.min(vagasPorServico, 50));
  }

  if (modoCiclo != null) {
    payload.p_modo_ciclo = modoCiclo === 'equipe' ? 'equipe' : 'individual';
  }

  const { data, error } = await supabase.rpc('atualizar_tipo_escala', payload);

  if (error) {
    const message = (error.message ?? '').toLowerCase();

    if (isSupabaseRpcMissing(message, 'atualizar_tipo_escala')) {
      return updateMaintenanceScaleTypeDirect(id, normalizedCode, trimmedName, isActive);
    }

    throw error;
  }

  return parseRegisterScaleRpc(data);
}

async function updateMaintenanceScaleTypeDirect(
  id: string,
  code: string,
  name: string,
  isActive: boolean
) {
  const { data, error } = await supabase
    .from('tipos_escala')
    .update({
      codigo: code,
      nome: name,
      is_ativa: isActive,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('id')
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data?.id) {
    return { success: false as const, message: 'Tipo de escala não encontrado ou sem permissão.' };
  }

  return { success: true as const, message: 'Tipo de escala atualizado.' };
}

export async function deleteMaintenanceScaleType(id: string) {
  const { data, error } = await supabase.rpc('excluir_tipo_escala', {
    p_id: id,
  });

  if (error) {
    const message = (error.message ?? '').toLowerCase();

    if (isSupabaseRpcMissing(message, 'excluir_tipo_escala')) {
      return deleteMaintenanceScaleTypeDirect(id);
    }

    throw error;
  }

  const parsed = parseRegisterScaleRpc(data);

  if (!parsed.success) {
    try {
      return await deleteMaintenanceScaleTypeDirect(id);
    } catch {
      return parsed;
    }
  }

  return parsed;
}

async function deleteMaintenanceScaleTypeDirect(id: string) {
  const { data, error } = await supabase.from('tipos_escala').delete().eq('id', id).select('id');

  if (error) {
    throw error;
  }

  if (!data?.length) {
    return { success: false as const, message: 'Tipo de escala não encontrado ou sem permissão.' };
  }

  return { success: true as const, message: 'Tipo de escala removido.' };
}

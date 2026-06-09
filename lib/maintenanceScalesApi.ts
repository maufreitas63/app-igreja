import {
  normalizeScaleServiceDateIso,
  parseMaintenanceScaleVolunteerRows,
  parseRegisterScaleRpc,
  type MaintenanceScaleLogEntry,
  type MaintenanceScaleType,
  type MaintenanceScaleVolunteer,
} from '@/lib/maintenanceScales';
import { fetchPermittedScaleTypes, SCALE_PERMITTED_RPC_MISSING } from '@/lib/scaleAccess';
import { supabase } from '@/lib/supabase';

type ScaleTypeRow = {
  id?: string;
  codigo?: string;
  nome?: string;
};

type ScaleLogRow = {
  id?: string;
  tipo_escala_id?: string;
  tipo_escala_codigo?: string;
  tipo_escala_nome?: string;
  data_servico?: string;
  voluntario_id?: string;
  volunteer_name?: string;
};

const parseScaleTypes = (rows: ScaleTypeRow[] | null) =>
  (rows ?? [])
    .map((row) => {
      const id = row.id?.trim();
      const code = row.codigo?.trim();
      const name = row.nome?.trim();

      if (!id || !code || !name) {
        return null;
      }

      return { id, code, name } satisfies MaintenanceScaleType;
    })
    .filter((row): row is MaintenanceScaleType => row !== null)
    .sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'));

const pickLogField = (row: Record<string, unknown>, ...keys: string[]) => {
  for (const key of keys) {
    const match = Object.keys(row).find((entry) => entry.toLowerCase() === key.toLowerCase());

    if (match == null || row[match] == null) {
      continue;
    }

    const value = String(row[match]).trim();

    if (value) {
      return value;
    }
  }

  return '';
};

const normalizeScaleLogRows = (data: unknown): Record<string, unknown>[] => {
  if (!data) {
    return [];
  }

  if (Array.isArray(data)) {
    return data.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object');
  }

  if (typeof data === 'object') {
    return [data as Record<string, unknown>];
  }

  return [];
};

const parseScaleLogs = (data: unknown) =>
  normalizeScaleLogRows(data)
    .map((row) => {
      const id = pickLogField(row, 'id');
      const scaleTypeId = pickLogField(row, 'tipo_escala_id');
      const scaleTypeCode = pickLogField(row, 'tipo_escala_codigo');
      const scaleTypeName = pickLogField(row, 'tipo_escala_nome');
      const serviceDateRaw = pickLogField(row, 'data_servico');
      const serviceDate = normalizeScaleServiceDateIso(serviceDateRaw);
      const volunteerId = pickLogField(row, 'voluntario_id');
      const volunteerName = pickLogField(row, 'volunteer_name', 'nome');

      if (
        !id
        || !scaleTypeId
        || !scaleTypeCode
        || !scaleTypeName
        || !serviceDate
        || !volunteerId
        || !volunteerName
      ) {
        return null;
      }

      return {
        id,
        scaleTypeId,
        scaleTypeCode,
        scaleTypeName,
        serviceDate,
        volunteerId,
        volunteerName,
      } satisfies MaintenanceScaleLogEntry;
    })
    .filter((row): row is MaintenanceScaleLogEntry => row !== null);

export async function fetchMaintenanceScaleTypes() {
  try {
    const permitted = await fetchPermittedScaleTypes('view');

    return parseScaleTypes(
      permitted.map((row) => ({
        id: row.id,
        codigo: row.code,
        nome: row.name,
      }))
    );
  } catch (permittedError) {
    if (
      !(permittedError instanceof Error)
      || permittedError.message !== SCALE_PERMITTED_RPC_MISSING
    ) {
      throw permittedError;
    }
  }

  const { data, error } = await supabase.rpc('listar_tipos_escala');

  if (error) {
    throw error;
  }

  return parseScaleTypes((data as ScaleTypeRow[] | null) ?? []);
}

export async function fetchMaintenanceScaleLogs() {
  const { data, error } = await supabase.rpc('listar_escalas');

  if (error) {
    throw error;
  }

  return parseScaleLogs(data);
}

export async function fetchMaintenanceScaleVolunteers(scaleTypeId: string) {
  const { data, error } = await supabase.rpc('listar_voluntarios_escala', {
    p_tipo_escala_id: scaleTypeId,
  });

  if (error) {
    const message = (error.message ?? '').toLowerCase();

    if (
      message.includes('listar_voluntarios_escala')
      && (message.includes('could not find') || message.includes('does not exist'))
    ) {
      const schemaError = new Error(MAINTENANCE_SCALES_RPC_MISSING);
      schemaError.name = 'MaintenanceScalesRpcMissing';
      throw schemaError;
    }

    throw error;
  }

  return parseMaintenanceScaleVolunteerRows(data);
}

export const MAINTENANCE_SCALES_RPC_MISSING = 'MAINTENANCE_SCALES_RPC_MISSING';

export async function registerMaintenanceScaleManual(
  scaleTypeId: string,
  volunteerId: string,
  serviceDate: string
) {
  const { data, error } = await supabase.rpc('registrar_escala_manual', {
    p_tipo_escala_id: scaleTypeId,
    p_voluntario_id: volunteerId,
    p_data_servico: serviceDate,
  });

  if (error) {
    const message = (error.message ?? '').toLowerCase();

    if (
      message.includes('registrar_escala_manual')
      && (message.includes('could not find') || message.includes('does not exist'))
    ) {
      const schemaError = new Error(MAINTENANCE_SCALES_RPC_MISSING);
      schemaError.name = 'MaintenanceScalesRpcMissing';
      throw schemaError;
    }

    throw error;
  }

  return parseRegisterScaleRpc(data);
}

async function deleteMaintenanceScaleViaRpc(scaleLogId: string) {
  const { data, error } = await supabase.rpc('excluir_escala', {
    p_escala_log_id: scaleLogId,
  });

  if (error) {
    const message = (error.message ?? '').toLowerCase();

    if (
      message.includes('excluir_escala')
      && (message.includes('could not find') || message.includes('does not exist'))
    ) {
      const schemaError = new Error(MAINTENANCE_SCALES_RPC_MISSING);
      schemaError.name = 'MaintenanceScalesRpcMissing';
      throw schemaError;
    }

    throw error;
  }

  return parseRegisterScaleRpc(data);
}

/** Remove uma linha de `public.escalas_log` pelo `id`. */
export async function deleteMaintenanceScale(scaleLogId: string) {
  const id = scaleLogId.trim();

  if (!id) {
    return { success: false as const, message: 'Escala não informada.' };
  }

  const { data, error } = await supabase.from('escalas_log').delete().eq('id', id).select('id');

  if (error) {
    const message = (error.message ?? '').toLowerCase();
    const blockedByRls =
      message.includes('permission')
      || message.includes('policy')
      || message.includes('42501')
      || message.includes('row-level')
      || message.includes('not allowed');

    if (blockedByRls) {
      return deleteMaintenanceScaleViaRpc(id);
    }

    throw error;
  }

  if (data?.length) {
    return { success: true as const, message: 'Escala removida.' };
  }

  return deleteMaintenanceScaleViaRpc(id);
}

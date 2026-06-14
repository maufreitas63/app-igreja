import {
  parseMaintenanceScaleVolunteerRows,
  parseRegisterScaleRpc,
  type MaintenanceScaleType,
  type MaintenanceScaleVolunteer,
} from '@/lib/maintenanceScales';
import { mapProfileSearchRows } from '@/lib/profileSearchRow';
import { supabase } from '@/lib/supabase';

export const MAINTENANCE_SCALE_VOLUNTEERS_RPC_MISSING = 'MAINTENANCE_SCALE_VOLUNTEERS_RPC_MISSING';

export type ProfileForScaleVolunteer = {
  id: string;
  fullName: string;
  phone: string | null;
  memberCode: string | null;
};

export { fetchMaintenanceScaleTypes } from '@/lib/maintenanceScalesApi';

export async function fetchVolunteersForScaleType(scaleTypeId: string) {
  const { data, error } = await supabase.rpc('listar_voluntarios_escala', {
    p_tipo_escala_id: scaleTypeId,
  });

  if (error) {
    throw error;
  }

  return parseMaintenanceScaleVolunteerRows(data);
}

/** Busca perfis em `profiles` pelo campo `full_name`. */
export async function searchProfilesForScaleVolunteer(query: string, limit = 25) {
  const normalized = query.trim();

  if (normalized.length < 2) {
    return [];
  }

  const pattern = `%${normalized.replace(/[%_]/g, '')}%`;

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, phone, codigo_membro')
    .not('full_name', 'is', null)
    .neq('full_name', '')
    .ilike('full_name', pattern)
    .order('full_name', { ascending: true })
    .limit(limit);

  if (error) {
    throw error;
  }

  return mapProfileSearchRows(data) as ProfileForScaleVolunteer[];
}

const readRpcIntegerField = (row: Record<string, unknown>, key: string) => {
  const match = Object.keys(row).find((entry) => entry.toLowerCase() === key.toLowerCase());

  if (match == null || row[match] == null) {
    return null;
  }

  const raw = row[match];

  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return Math.trunc(raw);
  }

  const parsed = Number.parseInt(String(raw).trim(), 10);

  return Number.isFinite(parsed) ? parsed : null;
};

/** MAX(ordem_sequencial) + 1 para o tipo de escala (inclui linhas com ordem já gravada). */
export async function computeNextVolunteerSequenceOrder(scaleTypeId: string) {
  const { data, error } = await supabase
    .from('voluntarios_escala')
    .select('ordem_sequencial')
    .eq('tipo_escala_id', scaleTypeId);

  if (error) {
    throw error;
  }

  const maxOrder = ((data as Array<{ ordem_sequencial?: number | null }> | null) ?? []).reduce(
    (currentMax, row) => Math.max(currentMax, row.ordem_sequencial ?? 0),
    0
  );

  return maxOrder + 1;
}

export async function ensureVolunteerSequenceOrder(scaleTypeId: string, volunteerId: string) {
  const { data: garantirData, error: garantirError } = await supabase.rpc(
    'garantir_ordem_sequencial_voluntario',
    {
      p_tipo_escala_id: scaleTypeId,
      p_voluntario_id: volunteerId,
    }
  );

  if (!garantirError && garantirData && typeof garantirData === 'object') {
    const row = garantirData as Record<string, unknown>;
    const success = row.success === true || row.success === 'true';
    const ordem = readRpcIntegerField(row, 'ordem_sequencial');

    if (success && ordem != null) {
      return ordem;
    }
  }

  const { data: current, error: readError } = await supabase
    .from('voluntarios_escala')
    .select('ordem_sequencial')
    .eq('id', volunteerId)
    .eq('tipo_escala_id', scaleTypeId)
    .maybeSingle();

  if (readError) {
    throw readError;
  }

  if (current?.ordem_sequencial != null) {
    return current.ordem_sequencial;
  }

  const nextOrder = await computeNextVolunteerSequenceOrder(scaleTypeId);

  const { data: updated, error: updateError } = await supabase
    .from('voluntarios_escala')
    .update({ ordem_sequencial: nextOrder })
    .eq('id', volunteerId)
    .eq('tipo_escala_id', scaleTypeId)
    .select('ordem_sequencial')
    .maybeSingle();

  if (updateError) {
    throw updateError;
  }

  return updated?.ordem_sequencial ?? nextOrder;
}

export async function registerScaleVolunteer(scaleTypeId: string, profileId: string) {
  const { data, error } = await supabase.rpc('cadastrar_voluntario_escala', {
    p_tipo_escala_id: scaleTypeId,
    p_profile_id: profileId,
  });

  if (error) {
    const message = (error.message ?? '').toLowerCase();

    if (
      message.includes('cadastrar_voluntario_escala')
      && (message.includes('could not find') || message.includes('does not exist'))
    ) {
      const schemaError = new Error(MAINTENANCE_SCALE_VOLUNTEERS_RPC_MISSING);
      schemaError.name = 'MaintenanceScaleVolunteersRpcMissing';
      throw schemaError;
    }

    throw error;
  }

  const parsed = parseRegisterScaleRpc(data);

  if (parsed.success && parsed.volunteerId) {
    if (parsed.sequenceOrder != null) {
      return parsed;
    }

    try {
      const ordem = await ensureVolunteerSequenceOrder(scaleTypeId, parsed.volunteerId);

      return {
        ...parsed,
        sequenceOrder: ordem,
        message: parsed.message ?? 'Servo associado à escala com sucesso.',
      };
    } catch (ensureError) {
      console.error('Erro ao garantir ordem_sequencial do voluntário:', ensureError);
    }
  }

  return parsed;
}

const isRemoverRpcMissing = (message: string) =>
  message.includes('remover_voluntario_escala')
  && (message.includes('could not find') || message.includes('does not exist'));

export async function removeScaleVolunteer(scaleTypeId: string, volunteerId: string) {
  const { data, error } = await supabase.rpc('remover_voluntario_escala', {
    p_tipo_escala_id: scaleTypeId,
    p_voluntario_id: volunteerId,
  });

  if (!error) {
    const parsed = parseRegisterScaleRpc(data);

    if (parsed.success) {
      return parsed;
    }
  } else {
    const message = (error.message ?? '').toLowerCase();

    if (!isRemoverRpcMissing(message)) {
      throw error;
    }
  }

  const { data: deletedRows, error: deleteError } = await supabase
    .from('voluntarios_escala')
    .delete()
    .eq('id', volunteerId)
    .eq('tipo_escala_id', scaleTypeId)
    .select('id');

  if (deleteError) {
    const message = (deleteError.message ?? '').toLowerCase();

    if (
      message.includes('row-level security')
      || message.includes('permission denied')
      || message.includes('42501')
    ) {
      return {
        success: false as const,
        message:
          'Sem permissão para excluir. Execute scripts/escalas-volunteers-rpc.sql no Supabase.',
      };
    }

    throw deleteError;
  }

  if (!deletedRows?.length) {
    return {
      success: false as const,
      message: 'Servo não encontrado neste tipo de escala.',
    };
  }

  return {
    success: true as const,
    message: 'Servo removido da lista deste tipo de escala.',
  };
}

export type { MaintenanceScaleType, MaintenanceScaleVolunteer };

import { formatShortName } from '@/lib/formatShortName';
import {
  canAdvanceToPastoralFollowUpStage,
  formatPastoralRequestForLabel,
  getPastoralFollowUpStageBlockedMessage,
  isPastoralFollowUpStage,
  normalizePastoralFollowUpStage,
  type PastoralBeneficiaryType,
  type PastoralFollowUpStage,
  type PastoralRequestHistoryItem,
} from '@/lib/pastoralRequest';
import { supabase } from '@/lib/supabase';

export const MAINTENANCE_PASTORAL_SQL_HINT =
  'Execute no Supabase: scripts/pastoral-requests-fields.sql e scripts/pastoral-maintenance-rpc.sql.';

export const MAINTENANCE_PASTORAL_RPC_MISSING = 'MAINTENANCE_PASTORAL_RPC_MISSING';

export type PastoralSubmitterOption = {
  profileId: string;
  fullName: string;
  shortName: string;
  phone: string | null;
  requestCount: number;
};

export type MaintenancePastoralRequestView = PastoralRequestHistoryItem & {
  submitterName: string;
  phone: string | null;
  requestForLabel: string;
  followUpStage: PastoralFollowUpStage | null;
};

const isUpdateStatusRpcMissing = (message: string) =>
  message.includes('atualizar_status_pedido_pastoral')
  && (message.includes('could not find') || message.includes('does not exist') || message.includes('PGRST202'));

const parseRpcJsonObject = (data: unknown): Record<string, unknown> | null => {
  let payload: unknown = data;

  if (typeof data === 'string') {
    try {
      payload = JSON.parse(data) as unknown;
    } catch {
      return null;
    }
  }

  if (Array.isArray(payload)) {
    const first = payload[0];

    if (first && typeof first === 'object') {
      payload = first;
    }
  }

  if (!payload || typeof payload !== 'object') {
    return null;
  }

  return payload as Record<string, unknown>;
};

const isRpcSuccess = (row: Record<string, unknown>) =>
  row.success === true || row.success === 'true';

async function updatePastoralRequestFollowUpStageDirect(
  requestId: string,
  stage: PastoralFollowUpStage
) {
  const { data, error } = await supabase
    .from('pastoral_requests')
    .update({
      status: stage,
      updated_at: new Date().toISOString(),
    })
    .eq('id', requestId)
    .select('status, updated_at')
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data?.status) {
    return {
      success: false as const,
      message: 'Pedido pastoral não encontrado ou sem permissão para atualizar.',
    };
  }

  const status = normalizePastoralFollowUpStage(String(data.status));

  return {
    success: true as const,
    message: 'Estágio de acompanhamento atualizado.',
    status: status ?? stage,
    updatedAt:
      data.updated_at != null ? String(data.updated_at) : new Date().toISOString(),
  };
}

const isListRpcMissing = (message: string) =>
  message.includes('listar_solicitantes_pedido_pastoral')
  && (message.includes('could not find') || message.includes('does not exist') || message.includes('PGRST202'));

export async function fetchPastoralSubmitterOptions() {
  const { data, error } = await supabase.rpc('listar_solicitantes_pedido_pastoral');

  if (error) {
    const message = (error.message ?? '').toLowerCase();

    if (isListRpcMissing(message)) {
      const schemaError = new Error(MAINTENANCE_PASTORAL_RPC_MISSING);
      schemaError.name = 'MaintenancePastoralRpcMissing';
      throw schemaError;
    }

    throw error;
  }

  return ((data as Array<Record<string, unknown>> | null) ?? [])
    .map((row) => {
      const profileId = String(row.profile_id ?? row.profileId ?? '').trim();
      const fullName = String(row.full_name ?? row.fullName ?? '').trim();

      if (!profileId || !fullName) {
        return null;
      }

      const requestCountRaw = row.request_count ?? row.requestCount ?? 0;
      const requestCount = Number.parseInt(String(requestCountRaw), 10);

      return {
        profileId,
        fullName,
        shortName: formatShortName(fullName),
        phone: row.phone != null ? String(row.phone).trim() || null : null,
        requestCount: Number.isFinite(requestCount) ? requestCount : 0,
      } satisfies PastoralSubmitterOption;
    })
    .filter((row): row is PastoralSubmitterOption => row !== null)
    .sort((left, right) => left.shortName.localeCompare(right.shortName, 'pt-BR'));
}

export async function fetchPastoralSubmitterProfile(profileId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, phone')
    .eq('id', profileId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data?.id) {
    return null;
  }

  const fullName = String(data.full_name ?? '').trim() || '—';

  return {
    profileId: String(data.id),
    fullName,
    shortName: formatShortName(fullName),
    phone: data.phone != null ? String(data.phone).trim() || null : null,
  };
}

export async function fetchMaintenancePastoralRequestsForProfile(
  profileId: string,
  submitterName: string,
  submitterPhone: string | null
): Promise<MaintenancePastoralRequestView[]> {
  const { data, error } = await supabase
    .from('pastoral_requests')
    .select(
      'id, created_at, motivo, situacao, description, destination_label, request_for, beneficiary_name, beneficiary_relationship, beneficiary_details, status, confidential, updated_at'
    )
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  const rows = ((data as Array<Record<string, unknown>> | null) ?? []).map((record) => {
    const requestForRaw = record.request_for;

    return {
      id: String(record.id),
      created_at: String(record.created_at),
      motivo: record.motivo != null ? String(record.motivo) : null,
      situacao: record.situacao != null ? String(record.situacao) : null,
      description: record.description != null ? String(record.description) : null,
      destination_label:
        record.destination_label != null ? String(record.destination_label) : null,
      request_for:
        requestForRaw === 'self' || requestForRaw === 'family' || requestForRaw === 'third_party'
          ? (requestForRaw as PastoralBeneficiaryType)
          : null,
      beneficiary_name:
        record.beneficiary_name != null ? String(record.beneficiary_name) : null,
      beneficiary_relationship:
        record.beneficiary_relationship != null
          ? String(record.beneficiary_relationship)
          : null,
      beneficiary_details:
        record.beneficiary_details != null ? String(record.beneficiary_details) : null,
      status: record.status != null ? String(record.status) : null,
      updated_at: record.updated_at != null ? String(record.updated_at) : null,
      confidential: Boolean(record.confidential),
    } satisfies PastoralRequestHistoryItem;
  });

  return rows.map((row) => ({
    ...row,
    submitterName,
    phone: submitterPhone ?? null,
    requestForLabel: formatPastoralRequestForLabel(row.request_for),
    followUpStage: normalizePastoralFollowUpStage(row.status),
  }));
}

export async function updatePastoralRequestFollowUpStage(
  requestId: string,
  stage: PastoralFollowUpStage,
  currentStage: PastoralFollowUpStage | null = null
) {
  if (!isPastoralFollowUpStage(stage)) {
    return { success: false as const, message: 'Estágio de acompanhamento inválido.' };
  }

  if (!canAdvanceToPastoralFollowUpStage(currentStage, stage)) {
    return {
      success: false as const,
      message:
        getPastoralFollowUpStageBlockedMessage(currentStage, stage)
        ?? 'Não é possível avançar para este estágio agora.',
    };
  }

  try {
    const directResult = await updatePastoralRequestFollowUpStageDirect(requestId, stage);

    if (directResult.success) {
      return directResult;
    }
  } catch (directError) {
    console.warn('Update direto em pastoral_requests falhou, tentando RPC:', directError);
  }

  const { data, error } = await supabase.rpc('atualizar_status_pedido_pastoral', {
    p_request_id: requestId,
    p_status: stage,
  });

  if (error) {
    const message = (error.message ?? '').toLowerCase();

    if (isUpdateStatusRpcMissing(message)) {
      return updatePastoralRequestFollowUpStageDirect(requestId, stage);
    }

    throw error;
  }

  const row = parseRpcJsonObject(data);

  if (!row) {
    return updatePastoralRequestFollowUpStageDirect(requestId, stage);
  }

  if (!isRpcSuccess(row)) {
    try {
      const directFallback = await updatePastoralRequestFollowUpStageDirect(requestId, stage);

      if (directFallback.success) {
        return directFallback;
      }
    } catch {
      // mantém erro da RPC abaixo
    }

    return {
      success: false as const,
      message:
        typeof row.message === 'string'
          ? row.message
          : 'Não foi possível atualizar o estágio.',
      status: normalizePastoralFollowUpStage(
        typeof row.status === 'string' ? row.status : null
      ),
      updatedAt: typeof row.updated_at === 'string' ? row.updated_at : null,
    };
  }

  const normalizedStatus = normalizePastoralFollowUpStage(
    typeof row.status === 'string' ? row.status : stage
  );

  return {
    success: true as const,
    message: typeof row.message === 'string' ? row.message : undefined,
    status: normalizedStatus ?? stage,
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : null,
  };
}

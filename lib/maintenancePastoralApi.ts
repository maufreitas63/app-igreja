import { formatShortName } from '@/lib/formatShortName';
import { resolveActorProfileId } from '@/lib/maintenanceAccessControlApi';
import {
  filterPastoralRequestsForSession,
  type PastoralCareAccessContext,
} from '@/lib/pastoralAccess';
import { supabase } from '@/lib/supabase';
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
export const MAINTENANCE_PASTORAL_SQL_HINT =
  'Execute no Supabase: scripts/pastoral-requests-fields.sql, scripts/access-control-pastoral-intercessao.sql, scripts/pastoral-maintenance-rpc.sql, scripts/pastoral-request-handler.sql e scripts/pastoral-request-cancellation.sql.';

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

const parseOptionalTextField = (value: unknown) => {
  if (value == null) {
    return null;
  }

  const text = String(value).trim();
  return text || null;
};

async function resolveActorHandlerFields() {
  const profileId = await resolveActorProfileId();

  if (!profileId) {
    return null;
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', profileId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return {
    handler_profile_id: profileId,
    handler_name: data?.full_name?.trim() || 'Responsável',
  };
}

async function updatePastoralRequestFollowUpStageDirect(
  requestId: string,
  stage: PastoralFollowUpStage,
  options?: { assignHandler?: boolean }
) {
  const updatePayload: Record<string, unknown> = {
    status: stage,
    updated_at: new Date().toISOString(),
  };

  if (stage === 'Acolher' && options?.assignHandler !== false) {
    const handler = await resolveActorHandlerFields();

    if (handler) {
      updatePayload.handler_profile_id = handler.handler_profile_id;
      updatePayload.handler_name = handler.handler_name;
    }
  }

  const { data, error } = await supabase
    .from('pastoral_requests')
    .update(updatePayload)
    .eq('id', requestId)
    .select('status, updated_at, handler_profile_id, handler_name')
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
    handlerProfileId: parseOptionalTextField(data.handler_profile_id),
    handlerName: parseOptionalTextField(data.handler_name),
  };
}

const isListRpcMissing = (message: string) =>
  message.includes('listar_solicitantes_pedido_pastoral')
  && (message.includes('could not find') || message.includes('does not exist') || message.includes('PGRST202'));

const isProfileRequestsRpcMissing = (message: string) =>
  message.includes('listar_pedidos_pastoral_perfil')
  && (message.includes('could not find') || message.includes('does not exist') || message.includes('PGRST202'));

const mapPastoralRequestRecord = (record: Record<string, unknown>) => {
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
    handler_profile_id:
      record.handler_profile_id != null ? String(record.handler_profile_id).trim() || null : null,
    handler_name: record.handler_name != null ? String(record.handler_name).trim() || null : null,
    cancellation_requested_at:
      record.cancellation_requested_at != null
        ? String(record.cancellation_requested_at).trim() || null
        : null,
  } satisfies PastoralRequestHistoryItem;
};

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

async function fetchMaintenancePastoralRequestsViaRpc(profileId: string) {
  const { data, error } = await supabase.rpc('listar_pedidos_pastoral_perfil', {
    p_profile_id: profileId,
  });

  if (error) {
    const message = (error.message ?? '').toLowerCase();

    if (isProfileRequestsRpcMissing(message)) {
      return null;
    }

    throw error;
  }

  return ((data as Array<Record<string, unknown>> | null) ?? []).map(mapPastoralRequestRecord);
}

async function fetchMaintenancePastoralRequestsDirect(profileId: string) {
  const { data, error } = await supabase
    .from('pastoral_requests')
    .select(
      'id, created_at, motivo, situacao, description, destination_label, request_for, beneficiary_name, beneficiary_relationship, beneficiary_details, status, confidential, updated_at, handler_profile_id, handler_name, cancellation_requested_at'
    )
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return ((data as Array<Record<string, unknown>> | null) ?? []).map(mapPastoralRequestRecord);
}

export async function fetchMaintenancePastoralRequestsForProfile(
  profileId: string,
  submitterName: string,
  submitterPhone: string | null,
  accessContext?: PastoralCareAccessContext
): Promise<MaintenancePastoralRequestView[]> {
  const rpcRows = await fetchMaintenancePastoralRequestsViaRpc(profileId);
  const sourceRows = rpcRows ?? (await fetchMaintenancePastoralRequestsDirect(profileId));
  const rows = accessContext
    ? filterPastoralRequestsForSession(sourceRows, accessContext)
    : sourceRows;

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
      handlerProfileId: parseOptionalTextField(row.handler_profile_id),
      handlerName: parseOptionalTextField(row.handler_name),
    };
  }

  const normalizedStatus = normalizePastoralFollowUpStage(
    typeof row.status === 'string' ? row.status : stage
  );

  let handlerProfileId = parseOptionalTextField(row.handler_profile_id);
  let handlerName = parseOptionalTextField(row.handler_name);

  if (stage === 'Acolher' && !handlerProfileId) {
    try {
      const directHandlerResult = await updatePastoralRequestFollowUpStageDirect(requestId, stage);

      if (directHandlerResult.success) {
        return directHandlerResult;
      }
    } catch (directHandlerError) {
      console.warn('Não foi possível gravar responsável pelo acolhimento:', directHandlerError);
    }

    const handler = await resolveActorHandlerFields();

    if (handler) {
      handlerProfileId = handler.handler_profile_id;
      handlerName = handler.handler_name;
    }
  }

  return {
    success: true as const,
    message: typeof row.message === 'string' ? row.message : undefined,
    status: normalizedStatus ?? stage,
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : null,
    handlerProfileId,
    handlerName,
  };
}

const isApproveCancellationRpcMissing = (message: string) =>
  message.includes('approve_pastoral_cancellation')
  && (message.includes('could not find') || message.includes('does not exist') || message.includes('PGRST202'));

export async function approvePastoralCancellation(requestId: string) {
  const trimmedRequestId = requestId.trim();

  if (!trimmedRequestId) {
    return { success: false as const, message: 'Pedido inválido.' };
  }

  const { data, error } = await supabase.rpc('approve_pastoral_cancellation', {
    p_request_id: trimmedRequestId,
  });

  if (error) {
    const message = (error.message ?? '').toLowerCase();

    if (isApproveCancellationRpcMissing(message)) {
      return {
        success: false as const,
        message:
          'Cancelamento indisponível no servidor. Execute scripts/pastoral-request-cancellation.sql no Supabase.',
      };
    }

    throw error;
  }

  const row = parseRpcJsonObject(data);

  if (!row) {
    return { success: false as const, message: 'Não foi possível cancelar o pedido.' };
  }

  if (!isRpcSuccess(row)) {
    return {
      success: false as const,
      message:
        typeof row.message === 'string'
          ? row.message
          : 'Não foi possível cancelar o pedido.',
    };
  }

  return {
    success: true as const,
    message: typeof row.message === 'string' ? row.message : undefined,
  };
}

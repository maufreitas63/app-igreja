import { resolveActorProfileId } from '@/lib/maintenanceAccessControlApi';
import { supabase } from '@/lib/supabase';
import { isSupabaseRpcMissingError } from '@/lib/supabaseRpc';

export const IGREJA_TRANSFERENCIA_SQL_HINT =
  'Execute no Supabase: scripts/igreja-transferencia-membros.sql';

export type IgrejaTransferPerson = {
  profileId: string;
  fullName: string;
  phone: string | null;
  originFamilyId: string | null;
  destFamilyId: string | null;
  destBasicRole: string | null;
};

export type IgrejaTransferRequest = {
  id: string;
  status: string;
  source: string;
  scope: string;
  originCode: string;
  originName: string;
  destinationCode: string;
  destinationName: string;
  originFamilyId: string | null;
  destFamilyId: string | null;
  note: string | null;
  decisionNote: string | null;
  createdAt: string | null;
  people: IgrejaTransferPerson[];
};

export type IgrejaTransferChurch = {
  id: string;
  code: string;
  name: string;
};

export type IgrejaTransferPreview = {
  originTenantId: string;
  originCode: string;
  originName: string;
  destinationCode: string;
  destinationName: string;
  primaryProfileId: string;
  includeFamily: boolean;
  people: IgrejaTransferPerson[];
};

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
};

const asText = (value: unknown): string | null => {
  const text = String(value ?? '').trim();
  return text || null;
};

const parsePerson = (value: unknown): IgrejaTransferPerson | null => {
  const row = asRecord(value);
  const profileId = asText(row?.profile_id ?? row?.profileId);
  const fullName = asText(row?.full_name ?? row?.fullName);

  if (!profileId || !fullName) {
    return null;
  }

  return {
    profileId,
    fullName,
    phone: asText(row?.phone),
    originFamilyId: asText(row?.origin_family_id ?? row?.originFamilyId),
    destFamilyId: asText(row?.dest_family_id ?? row?.destFamilyId),
    destBasicRole: asText(row?.dest_basic_role ?? row?.destBasicRole),
  };
};

const parsePeople = (value: unknown): IgrejaTransferPerson[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map(parsePerson).filter((row): row is IgrejaTransferPerson => row != null);
};

export const parseIgrejaTransferRequest = (value: unknown): IgrejaTransferRequest | null => {
  const row = asRecord(value);
  const id = asText(row?.id);

  if (!id) {
    return null;
  }

  return {
    id,
    status: asText(row?.status) ?? 'pending_origin',
    source: asText(row?.source) ?? '',
    scope: asText(row?.scope) ?? 'person',
    originCode: asText(row?.origin_code ?? row?.originCode) ?? '',
    originName: asText(row?.origin_name ?? row?.originName) ?? '',
    destinationCode: asText(row?.destination_code ?? row?.destinationCode) ?? '',
    destinationName: asText(row?.destination_name ?? row?.destinationName) ?? '',
    originFamilyId: asText(row?.origin_family_id ?? row?.originFamilyId),
    destFamilyId: asText(row?.dest_family_id ?? row?.destFamilyId),
    note: asText(row?.note),
    decisionNote: asText(row?.decision_note ?? row?.decisionNote),
    createdAt: asText(row?.created_at ?? row?.createdAt),
    people: parsePeople(row?.people),
  };
};

const parseRpcPayload = (data: unknown): Record<string, unknown> => {
  let value: unknown = data;

  if (typeof value === 'string') {
    try {
      value = JSON.parse(value) as unknown;
    } catch {
      throw new Error('Resposta inválida do servidor.');
    }
  }

  const payload = asRecord(value) ?? (Array.isArray(value) ? asRecord(value[0]) : null);

  if (!payload) {
    throw new Error('Resposta inválida do servidor.');
  }

  return payload;
};

const throwIfRpcMissing = (error: { message?: string; code?: string } | null, fn: string) => {
  if (isSupabaseRpcMissingError(error, fn)) {
    throw new Error(IGREJA_TRANSFERENCIA_SQL_HINT);
  }
};

const requireOk = (payload: Record<string, unknown>, fallback: string) => {
  if (payload.ok === false) {
    throw new Error(asText(payload.message) ?? fallback);
  }
};

export async function solicitarTransferenciaMembroLogin(
  phone: string,
  options?: { note?: string; destinationTenantId?: string | null }
) {
  const { data, error } = await supabase.rpc('solicitar_transferencia_membro_login', {
    p_phone: phone.replace(/\D/g, ''),
    p_note: options?.note?.trim() || null,
    p_destination_tenant_id: options?.destinationTenantId?.trim() || null,
  });

  throwIfRpcMissing(error, 'solicitar_transferencia_membro_login');

  if (error) {
    throw new Error(error.message || 'Não foi possível solicitar a transferência.');
  }

  const payload = parseRpcPayload(data);
  requireOk(payload, 'Não foi possível solicitar a transferência.');

  return {
    alreadyPending: payload.already_pending === true,
    message: asText(payload.message) ?? 'Pedido enviado à igreja de origem.',
    request: parseIgrejaTransferRequest(payload.request),
  };
}

export async function listarIgrejasParaTransferencia(): Promise<IgrejaTransferChurch[]> {
  const actorProfileId = await resolveActorProfileId();

  if (!actorProfileId) {
    throw new Error('Sessão inválida. Saia e entre novamente.');
  }

  const { data, error } = await supabase.rpc('listar_igrejas_para_transferencia');
  throwIfRpcMissing(error, 'listar_igrejas_para_transferencia');

  if (error) {
    throw new Error(error.message || 'Não foi possível listar as igrejas.');
  }

  if (!Array.isArray(data)) {
    return [];
  }

  return data
    .map((row) => {
      const record = asRecord(row);
      const id = asText(record?.id);
      const code = asText(record?.code);
      const name = asText(record?.name);

      if (!id || !code || !name) {
        return null;
      }

      return { id, code, name };
    })
    .filter((row): row is IgrejaTransferChurch => row != null);
}

export async function pastoralPreviewTransferenciaEntrada(input: {
  originTenantId?: string;
  phone?: string;
  cpf?: string;
  familyCode?: string;
  includeFamily?: boolean;
}): Promise<IgrejaTransferPreview> {
  const { data, error } = await supabase.rpc('pastoral_preview_transferencia_entrada', {
    p_origin_tenant_id: input.originTenantId || null,
    p_phone: input.phone?.replace(/\D/g, '') || null,
    p_cpf: input.cpf?.replace(/\D/g, '') || null,
    p_family_code: input.familyCode?.trim().toUpperCase() || null,
    p_include_family: input.includeFamily === true,
  });

  throwIfRpcMissing(error, 'pastoral_preview_transferencia_entrada');

  if (error) {
    throw new Error(error.message || 'Não foi possível localizar o cadastro.');
  }

  const payload = parseRpcPayload(data);
  requireOk(payload, 'Não foi possível localizar o cadastro.');

  const people = parsePeople(payload.people);
  const primaryProfileId = asText(payload.primary_profile_id) ?? people[0]?.profileId;
  const originTenantId = asText(payload.origin_id) ?? asText(payload.origin_tenant_id);

  if (!primaryProfileId) {
    throw new Error('Nenhum membro encontrado com os dados informados.');
  }

  if (!originTenantId) {
    throw new Error('Não foi possível identificar a igreja de origem.');
  }

  return {
    originTenantId,
    originCode: asText(payload.origin_code) ?? '',
    originName: asText(payload.origin_name) ?? '',
    destinationCode: asText(payload.destination_code) ?? '',
    destinationName: asText(payload.destination_name) ?? '',
    primaryProfileId,
    includeFamily: payload.include_family === true,
    people,
  };
}

export async function pastoralIniciarTransferenciaEntrada(input: {
  originTenantId?: string;
  phone?: string;
  cpf?: string;
  familyCode?: string;
  includeFamily?: boolean;
  note?: string;
}) {
  const { data, error } = await supabase.rpc('pastoral_iniciar_transferencia_entrada', {
    p_origin_tenant_id: input.originTenantId || null,
    p_phone: input.phone?.replace(/\D/g, '') || null,
    p_cpf: input.cpf?.replace(/\D/g, '') || null,
    p_family_code: input.familyCode?.trim().toUpperCase() || null,
    p_include_family: input.includeFamily === true,
    p_note: input.note?.trim() || null,
  });

  throwIfRpcMissing(error, 'pastoral_iniciar_transferencia_entrada');

  if (error) {
    throw new Error(error.message || 'Não foi possível enviar o pedido.');
  }

  const payload = parseRpcPayload(data);
  requireOk(payload, 'Não foi possível enviar o pedido.');

  return {
    alreadyPending: payload.already_pending === true,
    message: asText(payload.message) ?? 'Pedido enviado à igreja de origem.',
    request: parseIgrejaTransferRequest(payload.request),
  };
}

export async function listarTransferenciasPastoral() {
  const { data, error } = await supabase.rpc('listar_transferencias_pastoral');
  throwIfRpcMissing(error, 'listar_transferencias_pastoral');

  if (error) {
    throw new Error(error.message || 'Não foi possível carregar as transferências.');
  }

  const payload = parseRpcPayload(data);
  requireOk(payload, 'Não foi possível carregar as transferências.');

  const inbound = Array.isArray(payload.inbound)
    ? payload.inbound.map(parseIgrejaTransferRequest).filter((row): row is IgrejaTransferRequest => row != null)
    : [];
  const outbound = Array.isArray(payload.outbound)
    ? payload.outbound.map(parseIgrejaTransferRequest).filter((row): row is IgrejaTransferRequest => row != null)
    : [];

  return { inbound, outbound };
}

export async function pastoralDecidirTransferenciaOrigem(
  requestId: string,
  approve: boolean,
  note?: string
) {
  const { data, error } = await supabase.rpc('pastoral_decidir_transferencia_origem', {
    p_request_id: requestId,
    p_approve: approve,
    p_note: note?.trim() || null,
  });

  throwIfRpcMissing(error, 'pastoral_decidir_transferencia_origem');

  if (error) {
    throw new Error(error.message || 'Não foi possível processar o pedido.');
  }

  const payload = parseRpcPayload(data);
  requireOk(payload, 'Não foi possível processar o pedido.');

  return {
    message: asText(payload.message) ?? (approve ? 'Transferência concluída.' : 'Pedido recusado.'),
    request: parseIgrejaTransferRequest(payload.request),
    destFamilyId: asText(payload.dest_family_id),
  };
}

export async function pastoralCancelarTransferenciaDestino(requestId: string) {
  const { data, error } = await supabase.rpc('pastoral_cancelar_transferencia_destino', {
    p_request_id: requestId,
  });

  throwIfRpcMissing(error, 'pastoral_cancelar_transferencia_destino');

  if (error) {
    throw new Error(error.message || 'Não foi possível cancelar o pedido.');
  }

  const payload = parseRpcPayload(data);
  requireOk(payload, 'Não foi possível cancelar o pedido.');

  return {
    message: asText(payload.message) ?? 'Pedido cancelado.',
    request: parseIgrejaTransferRequest(payload.request),
  };
}

export function igrejaTransferStatusLabel(status: string) {
  switch (status) {
    case 'pending_origin':
      return 'Aguardando origem';
    case 'completed':
      return 'Concluída';
    case 'rejected':
      return 'Recusada';
    case 'cancelled':
      return 'Cancelada';
    default:
      return status;
  }
}

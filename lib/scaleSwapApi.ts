/**
 * Trocas pontuais em escalas de voluntários.
 * SQL: scripts/scale-swap-requests-schema.sql
 */

import { supabase } from '@/lib/supabase';
import { isSupabaseRpcMissingError } from '@/lib/supabaseRpc';

export const SCALE_SWAP_SQL_HINT =
  'Execute no Supabase: scripts/scale-swap-requests-schema.sql';

export const SCALE_SWAP_STATUSES = [
  'pendente',
  'aceito',
  'recusado',
  'cancelado',
  'desfeito',
] as const;

export type ScaleSwapStatus = (typeof SCALE_SWAP_STATUSES)[number];

export const SCALE_SWAP_STATUS_LABEL: Record<ScaleSwapStatus, string> = {
  pendente: 'Pendente',
  aceito: 'Aceito',
  recusado: 'Recusado',
  cancelado: 'Cancelado',
  desfeito: 'Desfeito',
};

export type ScaleSwapCandidate = {
  profileId: string;
  volunteerId: string;
  volunteerName: string;
  phone: string | null;
  alreadyScheduled: boolean;
};

export type ScaleSwapRequestRow = {
  id: string;
  escalaIdOrigem: string | null;
  tipoEscalaId: string;
  tipoNome: string;
  dataServico: string;
  solicitanteProfileId: string;
  solicitanteNome: string;
  substitutoProfileId: string | null;
  substitutoNome: string | null;
  status: ScaleSwapStatus;
  motivo: string | null;
  direction: 'enviado' | 'recebido';
  createdAt: string;
  resolvedAt: string | null;
};

export type ScaleSwapAdminRow = {
  id: string;
  escalaIdOrigem: string | null;
  tipoEscalaId: string;
  tipoNome: string;
  dataServico: string;
  solicitanteNome: string;
  substitutoNome: string | null;
  status: ScaleSwapStatus;
  motivo: string | null;
  createdAt: string;
  resolvedAt: string | null;
};

export type ScaleSwapNotice = {
  id: string;
  requestId: string | null;
  title: string;
  body: string;
  createdAt: string;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

const throwIfMissing = (error: { message?: string }, name: string) => {
  if (isSupabaseRpcMissingError(error, name)) {
    throw new Error(SCALE_SWAP_SQL_HINT);
  }
};

const parseStatus = (value: unknown): ScaleSwapStatus => {
  const raw = String(value ?? '').trim().toLowerCase();

  if (
    raw === 'pendente'
    || raw === 'aceito'
    || raw === 'recusado'
    || raw === 'cancelado'
    || raw === 'desfeito'
  ) {
    return raw;
  }

  return 'pendente';
};

const rpcJson = async (name: string, args?: Record<string, unknown>) => {
  const { data, error } = await supabase.rpc(name, args ?? {});

  if (error) {
    throwIfMissing(error, name);
    throw new Error(error.message || 'Falha na troca de escala.');
  }

  return asRecord(data);
};

const rpcRows = async (name: string, args?: Record<string, unknown>) => {
  const { data, error } = await supabase.rpc(name, args ?? {});

  if (error) {
    throwIfMissing(error, name);
    throw new Error(error.message || 'Falha na troca de escala.');
  }

  return Array.isArray(data) ? data : [];
};

const asOptionalId = (value: unknown) => {
  const text = String(value ?? '').trim();
  return text || null;
};

export async function listScaleSwapCandidates(escalaLogId: string): Promise<ScaleSwapCandidate[]> {
  const rows = await rpcRows('list_scale_swap_candidates', {
    p_escala_log_id: escalaLogId,
  });

  return rows
    .map((item) => {
      const row = asRecord(item);
      const profileId = String(row.profile_id ?? '').trim();
      const volunteerId = String(row.volunteer_id ?? '').trim();
      const volunteerName = String(row.volunteer_name ?? '').trim();

      if (!profileId || !volunteerId || !volunteerName) {
        return null;
      }

      return {
        profileId,
        volunteerId,
        volunteerName,
        phone: row.phone != null && String(row.phone).trim() ? String(row.phone).trim() : null,
        alreadyScheduled: row.already_scheduled === true,
      } satisfies ScaleSwapCandidate;
    })
    .filter((row): row is ScaleSwapCandidate => row !== null);
}

export async function createScaleSwapRequest(
  escalaLogId: string,
  substitutoProfileId: string,
  motivo?: string
) {
  const payload = await rpcJson('create_scale_swap_request', {
    p_escala_log_id: escalaLogId,
    p_substituto_profile_id: substitutoProfileId,
    p_motivo: motivo?.trim() || null,
  });

  return {
    success: payload.success === true,
    message: String(payload.message ?? (payload.success === true ? 'Proposta enviada.' : 'Falha ao enviar.')),
    id: payload.id ? String(payload.id) : null,
  };
}

export async function listMyScaleSwaps(): Promise<ScaleSwapRequestRow[]> {
  const rows = await rpcRows('list_my_scale_swaps');

  return rows
    .map((item) => {
      const row = asRecord(item);
      const id = String(row.id ?? '').trim();

      if (!id) {
        return null;
      }

      return {
        id,
        escalaIdOrigem: asOptionalId(row.escala_id_origem),
        tipoEscalaId: String(row.tipo_escala_id ?? ''),
        tipoNome: String(row.tipo_nome ?? 'Escala'),
        dataServico: String(row.data_servico ?? ''),
        solicitanteProfileId: String(row.solicitante_profile_id ?? ''),
        solicitanteNome: String(row.solicitante_nome ?? 'Servo'),
        substitutoProfileId: asOptionalId(row.substituto_profile_id),
        substitutoNome: row.substituto_nome != null ? String(row.substituto_nome) : null,
        status: parseStatus(row.status),
        motivo: row.motivo != null && String(row.motivo).trim() ? String(row.motivo) : null,
        direction: row.direction === 'recebido' ? 'recebido' : 'enviado',
        createdAt: String(row.created_at ?? ''),
        resolvedAt: row.resolved_at != null ? String(row.resolved_at) : null,
      } satisfies ScaleSwapRequestRow;
    })
    .filter((row): row is ScaleSwapRequestRow => row !== null);
}

export async function respondScaleSwap(id: string, accept: boolean) {
  const payload = await rpcJson('respond_scale_swap', {
    p_id: id,
    p_accept: accept,
  });

  return {
    success: payload.success === true,
    message: String(payload.message ?? (accept ? 'Troca confirmada.' : 'Pedido recusado.')),
  };
}

export async function cancelScaleSwap(id: string) {
  const payload = await rpcJson('cancel_scale_swap', { p_id: id });

  return {
    success: payload.success === true,
    message: String(payload.message ?? 'Pedido cancelado.'),
  };
}

export async function undoScaleSwap(id: string) {
  const payload = await rpcJson('undo_scale_swap', { p_id: id });

  return {
    success: payload.success === true,
    message: String(payload.message ?? 'Troca desfeita.'),
  };
}

export async function leaderForceScaleSwap(
  escalaLogId: string,
  substitutoProfileId: string,
  motivo?: string
) {
  const payload = await rpcJson('leader_force_scale_swap', {
    p_escala_log_id: escalaLogId,
    p_substituto_profile_id: substitutoProfileId,
    p_motivo: motivo?.trim() || null,
  });

  return {
    success: payload.success === true,
    message: String(payload.message ?? 'Substituição aplicada.'),
    id: payload.id ? String(payload.id) : null,
  };
}

export async function listScaleSwapsAdmin(tipoEscalaId?: string | null): Promise<ScaleSwapAdminRow[]> {
  const rows = await rpcRows('list_scale_swaps_admin', {
    p_tipo_escala_id: tipoEscalaId ?? null,
  });

  return rows
    .map((item) => {
      const row = asRecord(item);
      const id = String(row.id ?? '').trim();

      if (!id) {
        return null;
      }

      return {
        id,
        escalaIdOrigem: asOptionalId(row.escala_id_origem),
        tipoEscalaId: String(row.tipo_escala_id ?? ''),
        tipoNome: String(row.tipo_nome ?? 'Escala'),
        dataServico: String(row.data_servico ?? ''),
        solicitanteNome: String(row.solicitante_nome ?? 'Servo'),
        substitutoNome: row.substituto_nome != null ? String(row.substituto_nome) : null,
        status: parseStatus(row.status),
        motivo: row.motivo != null && String(row.motivo).trim() ? String(row.motivo) : null,
        createdAt: String(row.created_at ?? ''),
        resolvedAt: row.resolved_at != null ? String(row.resolved_at) : null,
      } satisfies ScaleSwapAdminRow;
    })
    .filter((row): row is ScaleSwapAdminRow => row !== null);
}

export async function fetchUnreadScaleSwapNotices(): Promise<ScaleSwapNotice[]> {
  try {
    const rows = await rpcRows('list_unread_scale_swap_notices');

    return rows
      .map((item) => {
        const row = asRecord(item);
        const id = String(row.id ?? '').trim();

        if (!id) {
          return null;
        }

        return {
          id,
          requestId: asOptionalId(row.request_id),
          title: String(row.title ?? 'Troca de escala'),
          body: String(row.body ?? ''),
          createdAt: String(row.created_at ?? ''),
        } satisfies ScaleSwapNotice;
      })
      .filter((row): row is ScaleSwapNotice => row !== null);
  } catch {
    return [];
  }
}

export async function markScaleSwapNoticesRead() {
  try {
    await rpcJson('mark_scale_swap_notices_read');
  } catch {
    // Aviso já foi exibido; falha silenciosa no marcador.
  }
}

export async function setTipoEscalaAllowSwap(id: string, allow: boolean) {
  const payload = await rpcJson('set_tipo_escala_allow_swap', {
    p_id: id,
    p_allow: allow,
  });

  return {
    success: payload.success === true,
    message: String(payload.message ?? 'Permissão de troca atualizada.'),
  };
}

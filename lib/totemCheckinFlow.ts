import {
  TOTEM_CHECKIN_ALREADY_CONFIRMED_MESSAGE,
  type TotemCheckinLookupResult,
} from '@/lib/checkinStatus';
import { normalizeFamilyId } from '@/lib/totemFamilyId';
import { supabase } from '@/lib/supabase';
import { isSupabaseRpcMissingError } from '@/lib/supabaseRpc';
import type { PostgrestError } from '@supabase/supabase-js';

export const TOTEM_CHECKIN_SQL_HINT =
  'Execute no Supabase o script scripts/checkins-totem-flow.sql (tabela checkins, RPCs do totem e register_member_atomic).';

export const formatCheckinRpcError = (err: unknown): string => {
  if (!err || typeof err !== 'object') {
    return `Falha ao consultar pré-check-in.\n\n${TOTEM_CHECKIN_SQL_HINT}`;
  }

  const error = err as PostgrestError;
  const message = error.message ?? '';

  if (
    isSupabaseRpcMissingError(error, 'lookup_totem_checkin')
    || isSupabaseRpcMissingError(error, 'ensure_totem_checkin_flow')
  ) {
    return `Fluxo de check-in do totem não instalado no Supabase.\n\n${TOTEM_CHECKIN_SQL_HINT}`;
  }

  const lower = message.toLowerCase();
  if (
    error.code === '42883' ||
    (lower.includes('checkins') &&
      (lower.includes('does not exist') || lower.includes('não existe')))
  ) {
    return `Tabela checkins ausente no Supabase.\n\n${TOTEM_CHECKIN_SQL_HINT}`;
  }

  if (message.trim()) {
    return message;
  }

  return `Falha ao consultar pré-check-in.\n\n${TOTEM_CHECKIN_SQL_HINT}`;
};

export const parseTotemCheckinRpcData = (data: unknown): TotemCheckinLookupResult => {
  let payload: unknown = data;

  if (typeof data === 'string') {
    try {
      payload = JSON.parse(data) as unknown;
    } catch {
      return {
        success: false,
        code: 'NOT_FOUND',
        message: 'Resposta inválida do servidor.',
      };
    }
  }

  if (!payload || typeof payload !== 'object') {
    return {
      success: false,
      code: 'NOT_FOUND',
      message: 'Resposta inválida do servidor.',
    };
  }

  const row = payload as Record<string, unknown>;
  const code =
    typeof row.code === 'string' ? (row.code as TotemCheckinLookupResult['code']) : undefined;
  const alreadyConfirmed = row.already_confirmed === true;
  let message = typeof row.message === 'string' ? row.message : undefined;

  if (
    code === 'ALREADY_CONFIRMED' ||
    alreadyConfirmed ||
    (message && /já confirmado/i.test(message))
  ) {
    message = TOTEM_CHECKIN_ALREADY_CONFIRMED_MESSAGE;
  }

  return {
    success: row.success === true,
    code,
    message,
    pre_checkin_count:
      typeof row.pre_checkin_count === 'number' ? row.pre_checkin_count : undefined,
    confirmed_count:
      typeof row.confirmed_count === 'number' ? row.confirmed_count : undefined,
    can_confirm: row.can_confirm === true,
    already_confirmed: alreadyConfirmed,
    updated_count: typeof row.updated_count === 'number' ? row.updated_count : undefined,
  };
};

/**
 * Cria pré-check-ins faltantes para inscrições em eventos com totem_ativo ou requer_quorum.
 * Lança erro se o fluxo não puder ser garantido (C4).
 */
export const ensureTotemCheckinFlow = async (): Promise<void> => {
  const { error } = await supabase.rpc('ensure_totem_checkin_flow');

  if (!error) {
    return;
  }

  if (isSupabaseRpcMissingError(error, 'ensure_totem_checkin_flow')) {
    const { error: tableError } = await supabase.from('checkins').select('id').limit(1);

    if (!tableError) {
      return;
    }

    throw new Error(
      `Fluxo de check-in do totem indisponível: função ensure_totem_checkin_flow e tabela checkins ausentes.\n\n${TOTEM_CHECKIN_SQL_HINT}`
    );
  }

  throw new Error(formatCheckinRpcError(error));
};

/** Consulta pré-check-in via SELECT quando a RPC lookup ainda não existe. */
export const lookupTotemCheckinFallback = async (
  eventId: string,
  familyId: string
): Promise<TotemCheckinLookupResult> => {
  const normalizedFamilyId = normalizeFamilyId(familyId);

  if (!normalizedFamilyId) {
    return {
      success: false,
      code: 'NOT_FOUND',
      message: 'Código da família inválido.',
    };
  }

  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('totem_ativo, requer_quorum')
    .eq('id', eventId)
    .maybeSingle();

  if (eventError) {
    throw new Error(formatCheckinRpcError(eventError));
  }

  if (!event) {
    return {
      success: false,
      code: 'EVENT_NOT_FOUND',
      message: 'Evento não encontrado.',
    };
  }

  if (event.totem_ativo !== true && event.requer_quorum !== true) {
    return {
      success: false,
      code: 'TOTEM_INACTIVE',
      message: 'Totem não está ativo para este evento.',
    };
  }

  const { data: rows, error: checkinsError } = await supabase
    .from('checkins')
    .select('status, family_id')
    .eq('event_id', eventId);

  if (checkinsError) {
    throw new Error(formatCheckinRpcError(checkinsError));
  }

  const matched = (rows ?? []).filter(
    (row) => normalizeFamilyId(String(row.family_id ?? '')) === normalizedFamilyId
  );

  const preCount = matched.filter((row) => row.status === 'pre_checkin').length;
  const confirmedCount = matched.filter((row) => row.status === 'confirmado').length;

  return {
    success: true,
    pre_checkin_count: preCount,
    confirmed_count: confirmedCount,
    can_confirm: preCount > 0,
    already_confirmed: preCount === 0 && confirmedCount > 0,
  };
};

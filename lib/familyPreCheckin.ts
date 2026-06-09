import { parseTotemCheckinRpcData } from '@/lib/totemCheckinFlow';
import { supabase } from '@/lib/supabase';
import { normalizeFamilyId } from '@/lib/totemFamilyId';

export type PreCheckinGateEvent = {
  totem_ativo?: boolean | null;
  requer_quorum?: boolean | null;
};

export type PreCheckinGateResult = {
  hasPreCheckin: boolean;
  errorMessage: string | null;
};

export type TotemConfirmedGateResult = {
  isConfirmed: boolean;
  errorMessage: string | null;
};

const PRE_CHECKIN_GATE_ERROR =
  'Não foi possível verificar o pré-check-in. Verifique a conexão e tente novamente.';

const TOTEM_CONFIRMED_GATE_ERROR =
  'Não foi possível verificar o check-in confirmado. Verifique a conexão e tente novamente.';

/** Totem ou quórum exigem marcar a audiência antes do card de check-in. */
export const eventRequiresPreCheckinBeforeQr = (event: PreCheckinGateEvent | null | undefined) =>
  event?.totem_ativo === true || event?.requer_quorum === true;

export async function fetchFamilyHasPreCheckin(
  eventId: string | undefined,
  familyId: string | undefined,
  event: PreCheckinGateEvent | null | undefined
): Promise<PreCheckinGateResult> {
  if (!eventId || !familyId?.trim() || !eventRequiresPreCheckinBeforeQr(event)) {
    return { hasPreCheckin: true, errorMessage: null };
  }

  const normalizedFamilyId = normalizeFamilyId(familyId);

  if (!normalizedFamilyId) {
    return { hasPreCheckin: false, errorMessage: 'Código da família inválido.' };
  }

  if (event?.totem_ativo === true) {
    const { data, error } = await supabase.rpc('lookup_totem_checkin', {
      p_event_id: eventId,
      p_family_id: normalizedFamilyId,
    });

    if (error) {
      console.warn('lookup_totem_checkin (gate):', error.message);
      return { hasPreCheckin: false, errorMessage: PRE_CHECKIN_GATE_ERROR };
    }

    const result = parseTotemCheckinRpcData(data);
    if (!result.success) {
      return { hasPreCheckin: false, errorMessage: null };
    }

    return {
      hasPreCheckin: (result.pre_checkin_count ?? 0) > 0,
      errorMessage: null,
    };
  }

  const { data, error } = await supabase.rpc('get_registered_event_members', {
    p_event_id: eventId,
    p_family_id: normalizedFamilyId,
  });

  if (error) {
    console.warn('get_registered_event_members (gate):', error.message);
    return { hasPreCheckin: false, errorMessage: PRE_CHECKIN_GATE_ERROR };
  }

  return {
    hasPreCheckin: Array.isArray(data) && data.length > 0,
    errorMessage: null,
  };
}

/** Família com check-in confirmado no totem (status confirmado). */
export async function fetchFamilyHasTotemCheckinConfirmed(
  eventId: string | undefined,
  familyId: string | undefined
): Promise<TotemConfirmedGateResult> {
  if (!eventId || !familyId?.trim()) {
    return { isConfirmed: false, errorMessage: null };
  }

  const normalizedFamilyId = normalizeFamilyId(familyId);

  if (!normalizedFamilyId) {
    return { isConfirmed: false, errorMessage: 'Código da família inválido.' };
  }

  const { data, error } = await supabase.rpc('lookup_totem_checkin', {
    p_event_id: eventId,
    p_family_id: normalizedFamilyId,
  });

  if (error) {
    console.warn('lookup_totem_checkin (confirmed):', error.message);
    return { isConfirmed: false, errorMessage: TOTEM_CONFIRMED_GATE_ERROR };
  }

  const result = parseTotemCheckinRpcData(data);
  if (!result.success) {
    return { isConfirmed: false, errorMessage: null };
  }

  return {
    isConfirmed:
      result.already_confirmed === true ||
      (result.confirmed_count ?? 0) > 0 ||
      result.code === 'ALREADY_CONFIRMED',
    errorMessage: null,
  };
}

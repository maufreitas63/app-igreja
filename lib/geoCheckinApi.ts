import { supabase } from '@/lib/supabase';
import { isSupabaseRpcMissingError } from '@/lib/supabaseRpc';

export type GeoCheckinRpcResult = {
  success: boolean;
  message?: string;
  participant_names?: string[];
  requires_precheckin?: boolean;
};

const parseRpcResult = (data: unknown): GeoCheckinRpcResult => {
  if (!data || typeof data !== 'object') {
    return { success: false, message: 'Resposta inválida do servidor.' };
  }

  const record = data as Record<string, unknown>;
  const names = record.participant_names;

  return {
    success: record.success === true,
    message: typeof record.message === 'string' ? record.message : undefined,
    participant_names: Array.isArray(names)
      ? names.filter((name): name is string => typeof name === 'string')
      : undefined,
    requires_precheckin: record.requires_precheckin === true,
  };
};

const missingGeoCheckinRpcMessage =
  'Funções de check-in geo não encontradas. Execute scripts/geo-checkin-automatic.sql no Supabase.';

export async function syncFamilyEventRegistrationsAtomic(input: {
  eventId: string;
  familyId: string;
  memberIds: string[];
  latitude?: number | null;
  longitude?: number | null;
  skipGeofence?: boolean;
}): Promise<GeoCheckinRpcResult> {
  const { data, error } = await supabase.rpc('sync_family_event_registrations_atomic', {
    p_event_id: input.eventId,
    p_family_group_id: input.familyId,
    p_member_ids: input.memberIds,
    p_latitude: input.latitude ?? null,
    p_longitude: input.longitude ?? null,
    p_skip_geofence: input.skipGeofence === true,
  });

  if (error) {
    if (isSupabaseRpcMissingError(error, 'sync_family_event_registrations_atomic')) {
      throw new Error(missingGeoCheckinRpcMessage);
    }

    throw error;
  }

  const result = parseRpcResult(data);

  if (!result.success) {
    throw new Error(result.message ?? 'Não foi possível atualizar a audiência da família.');
  }

  return result;
}

export async function confirmGeoFamilyCheckinAtomic(input: {
  eventId: string;
  familyId: string;
  latitude?: number | null;
  longitude?: number | null;
  skipGeofence?: boolean;
}): Promise<GeoCheckinRpcResult> {
  const { data, error } = await supabase.rpc('confirm_geo_family_checkin_atomic', {
    p_event_id: input.eventId,
    p_family_group_id: input.familyId,
    p_latitude: input.latitude ?? null,
    p_longitude: input.longitude ?? null,
    p_skip_geofence: input.skipGeofence === true,
  });

  if (error) {
    if (isSupabaseRpcMissingError(error, 'confirm_geo_family_checkin_atomic')) {
      throw new Error(missingGeoCheckinRpcMessage);
    }

    throw error;
  }

  const result = parseRpcResult(data);

  if (!result.success) {
    if (result.requires_precheckin) {
      return result;
    }

    throw new Error(result.message ?? 'Não foi possível confirmar o check-in.');
  }

  return result;
}

export const formatGeoCheckinParticipantNames = (names: string[] | undefined) => {
  const cleaned = (names ?? []).map((name) => name.trim()).filter(Boolean);

  if (!cleaned.length) {
    return 'nenhum participante listado';
  }

  return cleaned.join(', ');
};

import { CHURCH_ROOM_SETTINGS_SQL_HINT, type ChurchRoomKey } from '@/lib/churchRoomSettings';
import { supabase } from '@/lib/supabase';
import { isSupabaseRpcMissingError } from '@/lib/supabaseRpc';
import { subscribeActiveTenantChange } from '@/lib/tenantSession';

export type RoomAssignmentProfile = {
  profile_id: string;
  full_name: string;
  phone: string | null;
  room_key: ChurchRoomKey | null;
  room_label: string | null;
};

export type AudienceRoomLabel = {
  profile_id: string;
  phone: string | null;
  full_name: string | null;
  room_key: ChurchRoomKey;
  room_label: string;
};

let audienceCacheToken = 0;
subscribeActiveTenantChange(() => {
  audienceCacheToken += 1;
});

function parseJsonArray(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) {
    return data as Record<string, unknown>[];
  }
  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data) as unknown;
      return Array.isArray(parsed) ? (parsed as Record<string, unknown>[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function mapAssignmentProfile(row: Record<string, unknown>): RoomAssignmentProfile | null {
  const profileId = String(row.profile_id ?? '').trim();
  if (!profileId) return null;
  const roomKeyRaw = String(row.room_key ?? '')
    .trim()
    .toUpperCase();
  const roomKey = /^[A-Z0-9_]{2,40}$/.test(roomKeyRaw) ? roomKeyRaw : null;

  return {
    profile_id: profileId,
    full_name: String(row.full_name ?? '').trim() || 'Sem nome',
    phone: typeof row.phone === 'string' && row.phone.trim() ? row.phone.trim() : null,
    room_key: roomKey,
    room_label:
      typeof row.room_label === 'string' && row.room_label.trim() ? row.room_label.trim() : null,
  };
}

function mapAudienceLabel(row: Record<string, unknown>): AudienceRoomLabel | null {
  const profileId = String(row.profile_id ?? '').trim();
  const roomKeyRaw = String(row.room_key ?? '')
    .trim()
    .toUpperCase();
  if (!profileId || !/^[A-Z0-9_]{2,40}$/.test(roomKeyRaw)) {
    return null;
  }
  const roomLabel = String(row.room_label ?? '').trim();
  if (!roomLabel) return null;

  return {
    profile_id: profileId,
    phone: typeof row.phone === 'string' && row.phone.trim() ? row.phone.trim() : null,
    full_name: typeof row.full_name === 'string' ? row.full_name : null,
    room_key: roomKeyRaw,
    room_label: roomLabel,
  };
}

export async function listProfilesForRoomAssignment(
  search?: string
): Promise<RoomAssignmentProfile[]> {
  const { data, error } = await supabase.rpc('list_profiles_for_room_assignment', {
    p_search: search?.trim() || null,
  });

  if (error) {
    if (isSupabaseRpcMissingError(error, 'list_profiles_for_room_assignment')) {
      throw new Error(CHURCH_ROOM_SETTINGS_SQL_HINT);
    }
    throw error;
  }

  return parseJsonArray(data)
    .map(mapAssignmentProfile)
    .filter((row): row is RoomAssignmentProfile => row != null);
}

export async function setUserRoomAssignment(
  profileId: string,
  roomKey: ChurchRoomKey
): Promise<{ success: boolean; message: string; room_label?: string }> {
  const { data, error } = await supabase.rpc('set_user_room_assignment', {
    p_profile_id: profileId,
    p_room_key: roomKey,
  });

  if (error) {
    if (isSupabaseRpcMissingError(error, 'set_user_room_assignment')) {
      return { success: false, message: CHURCH_ROOM_SETTINGS_SQL_HINT };
    }
    return { success: false, message: error.message || 'Falha ao atribuir sala.' };
  }

  const payload =
    typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {};
  audienceCacheToken += 1;

  return {
    success: payload.success === true,
    message:
      typeof payload.message === 'string' && payload.message.trim()
        ? payload.message
        : 'Atribuição salva.',
    room_label:
      typeof payload.room_label === 'string' && payload.room_label.trim()
        ? payload.room_label.trim()
        : undefined,
  };
}

export async function clearUserRoomAssignment(
  profileId: string
): Promise<{ success: boolean; message: string }> {
  const { data, error } = await supabase.rpc('clear_user_room_assignment', {
    p_profile_id: profileId,
  });

  if (error) {
    if (isSupabaseRpcMissingError(error, 'clear_user_room_assignment')) {
      return { success: false, message: CHURCH_ROOM_SETTINGS_SQL_HINT };
    }
    return { success: false, message: error.message || 'Falha ao limpar atribuição.' };
  }

  const payload =
    typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {};
  audienceCacheToken += 1;

  return {
    success: payload.success === true,
    message:
      typeof payload.message === 'string' && payload.message.trim()
        ? payload.message
        : 'Atribuição removida.',
  };
}

export async function resolveAudienceRoomLabels(
  phones: Array<string | null | undefined>
): Promise<AudienceRoomLabel[]> {
  const cleaned = Array.from(
    new Set(phones.map((phone) => (phone ?? '').trim()).filter(Boolean))
  );

  if (!cleaned.length) {
    return [];
  }

  const token = audienceCacheToken;
  const { data, error } = await supabase.rpc('resolve_audience_room_labels', {
    p_phones: cleaned,
  });

  if (error) {
    if (isSupabaseRpcMissingError(error, 'resolve_audience_room_labels')) {
      return [];
    }
    console.error('resolve_audience_room_labels:', error);
    return [];
  }

  if (token !== audienceCacheToken) {
    return [];
  }

  return parseJsonArray(data)
    .map(mapAudienceLabel)
    .filter((row): row is AudienceRoomLabel => row != null);
}

/** Mapa telefone normalizado / nome → rótulo da sala. */
export function buildAudienceRoomLabelIndex(rows: AudienceRoomLabel[]) {
  const byPhone = new Map<string, string>();
  const byDigits = new Map<string, string>();
  const byName = new Map<string, string>();

  for (const row of rows) {
    if (row.phone?.trim()) {
      byPhone.set(row.phone.trim(), row.room_label);
      const digits = row.phone.replace(/\D/g, '');
      if (digits) byDigits.set(digits, row.room_label);
    }
    const name = (row.full_name ?? '')
      .trim()
      .toLocaleLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    if (name) byName.set(name, row.room_label);
  }

  return { byPhone, byDigits, byName };
}

export function lookupAudienceRoomLabel(
  index: ReturnType<typeof buildAudienceRoomLabelIndex>,
  member: { phone?: string | null; full_name?: string | null }
): string | null {
  const phone = member.phone?.trim();
  if (phone && index.byPhone.has(phone)) {
    return index.byPhone.get(phone) ?? null;
  }
  const digits = (phone ?? '').replace(/\D/g, '');
  if (digits && index.byDigits.has(digits)) {
    return index.byDigits.get(digits) ?? null;
  }
  const name = (member.full_name ?? '')
    .trim()
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (name && index.byName.has(name)) {
    return index.byName.get(name) ?? null;
  }
  return null;
}

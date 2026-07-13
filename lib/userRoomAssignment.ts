import {
  CHURCH_ROOM_SETTINGS_SQL_HINT,
  type ChurchRoomKey,
  type ChurchRoomKind,
} from '@/lib/churchRoomSettings';
import { supabase } from '@/lib/supabase';
import { isSupabaseRpcMissingError } from '@/lib/supabaseRpc';
import { subscribeActiveTenantChange } from '@/lib/tenantSession';

export type RoomAssignmentProfile = {
  profile_id: string;
  full_name: string;
  phone: string | null;
  birth_date: string | null;
  registered_event_name: string | null;
  /** Sala efetiva (especial vigente ou padrão). */
  room_key: ChurchRoomKey | null;
  room_label: string | null;
  room_kind: ChurchRoomKind | null;
  padrao_room_key: ChurchRoomKey | null;
  padrao_room_label: string | null;
  especial_room_key: ChurchRoomKey | null;
  especial_room_label: string | null;
  especial_end_date: string | null;
};

export type AudienceRoomLabel = {
  profile_id: string;
  phone: string | null;
  full_name: string | null;
  room_key: ChurchRoomKey;
  room_label: string;
  room_kind?: ChurchRoomKind | null;
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

function normalizeRoomKey(raw: unknown): ChurchRoomKey | null {
  const roomKeyRaw = String(raw ?? '')
    .trim()
    .toUpperCase();
  return /^[A-Z0-9_]{2,40}$/.test(roomKeyRaw) ? roomKeyRaw : null;
}

function normalizeRoomKind(raw: unknown): ChurchRoomKind | null {
  const kind = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (kind === 'padrao' || kind === 'especial') return kind;
  return null;
}

function mapAssignmentProfile(row: Record<string, unknown>): RoomAssignmentProfile | null {
  const profileId = String(row.profile_id ?? '').trim();
  if (!profileId) return null;

  return {
    profile_id: profileId,
    full_name: String(row.full_name ?? '').trim() || 'Sem nome',
    phone: typeof row.phone === 'string' && row.phone.trim() ? row.phone.trim() : null,
    birth_date:
      typeof row.birth_date === 'string' && row.birth_date.trim()
        ? row.birth_date.trim()
        : null,
    registered_event_name:
      typeof row.registered_event_name === 'string' && row.registered_event_name.trim()
        ? row.registered_event_name.trim()
        : null,
    room_key: normalizeRoomKey(row.room_key),
    room_label:
      typeof row.room_label === 'string' && row.room_label.trim() ? row.room_label.trim() : null,
    room_kind: normalizeRoomKind(row.room_kind),
    padrao_room_key: normalizeRoomKey(row.padrao_room_key),
    padrao_room_label:
      typeof row.padrao_room_label === 'string' && row.padrao_room_label.trim()
        ? row.padrao_room_label.trim()
        : null,
    especial_room_key: normalizeRoomKey(row.especial_room_key),
    especial_room_label:
      typeof row.especial_room_label === 'string' && row.especial_room_label.trim()
        ? row.especial_room_label.trim()
        : null,
    especial_end_date:
      typeof row.especial_end_date === 'string' && row.especial_end_date.trim()
        ? row.especial_end_date.trim()
        : null,
  };
}

function mapAudienceLabel(row: Record<string, unknown>): AudienceRoomLabel | null {
  const profileId = String(row.profile_id ?? '').trim();
  const roomKey = normalizeRoomKey(row.room_key);
  if (!profileId || !roomKey) {
    return null;
  }
  const roomLabel = String(row.room_label ?? '').trim();
  if (!roomLabel) return null;

  return {
    profile_id: profileId,
    phone: typeof row.phone === 'string' && row.phone.trim() ? row.phone.trim() : null,
    full_name: typeof row.full_name === 'string' ? row.full_name : null,
    room_key: roomKey,
    room_label: roomLabel,
    room_kind: normalizeRoomKind(row.room_kind),
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
  roomKey: ChurchRoomKey,
  assignmentKind?: ChurchRoomKind | null
): Promise<{ success: boolean; message: string; room_label?: string }> {
  const { data, error } = await supabase.rpc('set_user_room_assignment', {
    p_profile_id: profileId,
    p_room_key: roomKey,
    p_assignment_kind: assignmentKind ?? null,
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
  profileId: string,
  assignmentKind?: ChurchRoomKind | null
): Promise<{ success: boolean; message: string }> {
  const { data, error } = await supabase.rpc('clear_user_room_assignment', {
    p_profile_id: profileId,
    p_assignment_kind: assignmentKind ?? null,
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

/** Mapa telefone normalizado / nome → sala (chave + rótulo). */
export function buildAudienceRoomLabelIndex(rows: AudienceRoomLabel[]) {
  type Entry = { room_key: string; room_label: string };
  const byPhone = new Map<string, Entry>();
  const byDigits = new Map<string, Entry>();
  const byName = new Map<string, Entry>();

  for (const row of rows) {
    const entry = { room_key: row.room_key, room_label: row.room_label };
    if (row.phone?.trim()) {
      byPhone.set(row.phone.trim(), entry);
      const digits = row.phone.replace(/\D/g, '');
      if (digits) byDigits.set(digits, entry);
    }
    const name = (row.full_name ?? '')
      .trim()
      .toLocaleLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    if (name) byName.set(name, entry);
  }

  return { byPhone, byDigits, byName };
}

export function lookupAudienceRoomLabel(
  index: ReturnType<typeof buildAudienceRoomLabelIndex>,
  member: { phone?: string | null; full_name?: string | null }
): { room_key: string; room_label: string } | null {
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

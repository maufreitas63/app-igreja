import { clearAppParameterCache } from '@/lib/appParameters';
import { supabase } from '@/lib/supabase';
import { isSupabaseRpcMissingError } from '@/lib/supabaseRpc';
import { subscribeActiveTenantChange } from '@/lib/tenantSession';

export const CHURCH_ROOM_SETTINGS_SQL_HINT =
  'Execute no Supabase: scripts/church-room-settings.sql';

export type ChurchRoomKey = 'KIDS' | 'TEENS';

export type ChurchRoomSetting = {
  id: string;
  tenant_id: string;
  room_key: ChurchRoomKey;
  display_label: string;
  badge_label: string | null;
  color_hex: string | null;
  is_enabled: boolean;
  sort_order: number;
};

export const DEFAULT_CHURCH_ROOM_SETTINGS: ChurchRoomSetting[] = [
  {
    id: 'default-kids',
    tenant_id: '',
    room_key: 'KIDS',
    display_label: 'Infantil',
    badge_label: null,
    color_hex: null,
    is_enabled: true,
    sort_order: 10,
  },
  {
    id: 'default-teens',
    tenant_id: '',
    room_key: 'TEENS',
    display_label: 'Jovens',
    badge_label: null,
    color_hex: null,
    is_enabled: true,
    sort_order: 20,
  },
];

type CacheEntry = {
  tenantToken: number;
  rows: ChurchRoomSetting[];
};

let cache: CacheEntry | null = null;
let tenantToken = 0;
let inflight: Promise<ChurchRoomSetting[]> | null = null;

subscribeActiveTenantChange(() => {
  tenantToken += 1;
  cache = null;
  inflight = null;
});

function mapRoomSetting(row: Record<string, unknown> | null | undefined): ChurchRoomSetting | null {
  const roomKey = String(row?.room_key ?? '')
    .trim()
    .toUpperCase();
  if (roomKey !== 'KIDS' && roomKey !== 'TEENS') {
    return null;
  }

  const displayLabel = String(row?.display_label ?? '').trim();
  if (!displayLabel) {
    return null;
  }

  return {
    id: String(row?.id ?? `${roomKey}`),
    tenant_id: String(row?.tenant_id ?? ''),
    room_key: roomKey,
    display_label: displayLabel,
    badge_label:
      typeof row?.badge_label === 'string' && row.badge_label.trim()
        ? row.badge_label.trim()
        : null,
    color_hex:
      typeof row?.color_hex === 'string' && row.color_hex.trim() ? row.color_hex.trim() : null,
    is_enabled: row?.is_enabled === false ? false : true,
    sort_order: Number.isFinite(Number(row?.sort_order)) ? Number(row?.sort_order) : 0,
  };
}

function parseListPayload(data: unknown): ChurchRoomSetting[] {
  const rows = Array.isArray(data)
    ? data
    : typeof data === 'string'
      ? (() => {
          try {
            return JSON.parse(data) as unknown;
          } catch {
            return [];
          }
        })()
      : [];

  if (!Array.isArray(rows)) {
    return [...DEFAULT_CHURCH_ROOM_SETTINGS];
  }

  const mapped = rows
    .map((row) => mapRoomSetting(row as Record<string, unknown>))
    .filter((row): row is ChurchRoomSetting => row != null)
    .sort((a, b) => a.sort_order - b.sort_order || a.room_key.localeCompare(b.room_key));

  if (!mapped.some((row) => row.room_key === 'KIDS')) {
    mapped.push(DEFAULT_CHURCH_ROOM_SETTINGS[0]);
  }
  if (!mapped.some((row) => row.room_key === 'TEENS')) {
    mapped.push(DEFAULT_CHURCH_ROOM_SETTINGS[1]);
  }

  return mapped.sort((a, b) => a.sort_order - b.sort_order || a.room_key.localeCompare(b.room_key));
}

export function clearChurchRoomSettingsCache() {
  cache = null;
  inflight = null;
  tenantToken += 1;
}

export function getRoomLabelFromSettings(
  settings: ChurchRoomSetting[],
  roomKey: ChurchRoomKey | null | undefined
): string | null {
  if (!roomKey) return null;
  const match = settings.find((row) => row.room_key === roomKey && row.is_enabled);
  return match?.display_label?.trim() || null;
}

export async function listChurchRoomSettings(options?: {
  forceRefresh?: boolean;
}): Promise<ChurchRoomSetting[]> {
  if (!options?.forceRefresh && cache && cache.tenantToken === tenantToken) {
    return cache.rows;
  }

  if (inflight) {
    return inflight;
  }

  const tokenAtStart = tenantToken;

  inflight = (async () => {
    const { data, error } = await supabase.rpc('list_church_room_settings');

    if (error) {
      if (isSupabaseRpcMissingError(error, 'list_church_room_settings')) {
        console.warn(CHURCH_ROOM_SETTINGS_SQL_HINT);
        return [...DEFAULT_CHURCH_ROOM_SETTINGS];
      }
      throw error;
    }

    const rows = parseListPayload(data);
    if (tokenAtStart === tenantToken) {
      cache = { tenantToken, rows };
    }
    return rows;
  })().finally(() => {
    inflight = null;
  });

  return inflight;
}

export async function upsertChurchRoomSetting(input: {
  roomKey: ChurchRoomKey;
  displayLabel: string;
  badgeLabel?: string | null;
  isEnabled?: boolean;
  sortOrder?: number | null;
}): Promise<{ success: boolean; message: string; row?: ChurchRoomSetting }> {
  const { data, error } = await supabase.rpc('upsert_church_room_setting', {
    p_room_key: input.roomKey,
    p_display_label: input.displayLabel,
    p_badge_label: input.badgeLabel ?? null,
    p_is_enabled: input.isEnabled ?? true,
    p_sort_order: input.sortOrder ?? null,
  });

  if (error) {
    if (isSupabaseRpcMissingError(error, 'upsert_church_room_setting')) {
      return { success: false, message: CHURCH_ROOM_SETTINGS_SQL_HINT };
    }
    return { success: false, message: error.message || 'Falha ao salvar sala.' };
  }

  const payload =
    typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {};
  clearChurchRoomSettingsCache();
  clearAppParameterCache();

  return {
    success: payload.success === true,
    message:
      typeof payload.message === 'string' && payload.message.trim()
        ? payload.message
        : payload.success === true
          ? 'Sala atualizada.'
          : 'Não foi possível salvar.',
    row: mapRoomSetting(payload.row as Record<string, unknown>) ?? undefined,
  };
}

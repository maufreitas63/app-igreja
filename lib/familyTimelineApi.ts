import { supabase } from '@/lib/supabase';
import { isSupabaseRpcMissingError } from '@/lib/supabaseRpc';
import { invalidateAsyncCache } from '@/lib/asyncResultCache';

export const FAMILY_TIMELINE_SQL_HINT =
  'A linha do tempo da família ainda não está disponível neste ambiente.';

export type FamilyTimelineSearchHit = {
  familyId: string;
  name: string;
  memberCount: number;
  roles: string;
};

export type FamilyTimelineMember = {
  id: string;
  name: string;
  role: string;
  lgpd: boolean;
  hasSelfie: boolean;
};

export type FamilyTimelineEvent = {
  kind: string;
  at: string;
  title: string;
  detail: string;
  status: string;
};

export type FamilyTimelinePayload = {
  familyId: string;
  members: FamilyTimelineMember[];
  events: FamilyTimelineEvent[];
  nextHint: string;
  enabled: boolean;
  canToggle: boolean;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asText(value: unknown): string {
  return value == null ? '' : String(value).trim();
}

function throwIfMissing(error: { message?: string; code?: string }, fn: string): never {
  if (isSupabaseRpcMissingError(error, fn)) {
    throw new Error(FAMILY_TIMELINE_SQL_HINT);
  }
  throw error;
}

export async function fetchFamilyTimelineFeatureState(): Promise<{
  enabled: boolean;
  canToggle: boolean;
}> {
  const { data, error } = await supabase.rpc('family_timeline_feature_state');
  if (error) throwIfMissing(error, 'family_timeline_feature_state');
  const row = asRecord(data);
  return {
    enabled: row?.enabled !== false,
    canToggle: row?.can_toggle === true,
  };
}

export async function setFamilyTimelineFeature(enabled: boolean): Promise<{
  success: boolean;
  message: string;
  enabled: boolean;
}> {
  const { data, error } = await supabase.rpc('set_family_timeline_feature', {
    p_enabled: enabled,
  });
  if (error) throwIfMissing(error, 'set_family_timeline_feature');
  const row = asRecord(data);
  invalidateAsyncCache('maintenance:dashboard:access');
  return {
    success: row?.success === true,
    message: asText(row?.message) || (enabled ? 'Reativada.' : 'Oculta nesta igreja.'),
    enabled: row?.enabled === true,
  };
}

export async function searchFamilyTimeline(query: string): Promise<FamilyTimelineSearchHit[]> {
  const { data, error } = await supabase.rpc('search_family_timeline', {
    p_query: query.trim(),
  });
  if (error) throwIfMissing(error, 'search_family_timeline');
  const row = asRecord(data);
  if (row?.success === false) {
    throw new Error(asText(row.message) || 'Não foi possível buscar famílias.');
  }
  const items = Array.isArray(row?.families) ? row.families : [];
  return items
    .map((entry) => {
      const item = asRecord(entry);
      if (!item) return null;
      const familyId = asText(item.family_id);
      if (!familyId) return null;
      return {
        familyId,
        name: asText(item.name) || familyId,
        memberCount: Number(item.member_count) || 0,
        roles: asText(item.roles),
      };
    })
    .filter((entry): entry is FamilyTimelineSearchHit => entry != null);
}

export async function getFamilyTimeline(familyId: string): Promise<FamilyTimelinePayload> {
  const { data, error } = await supabase.rpc('get_family_timeline', {
    p_family_id: familyId.trim(),
  });
  if (error) throwIfMissing(error, 'get_family_timeline');
  const row = asRecord(data);
  if (!row || row.success === false) {
    throw new Error(asText(row?.message) || 'Não foi possível abrir a linha do tempo.');
  }

  const members = (Array.isArray(row.members) ? row.members : [])
    .map((entry) => {
      const item = asRecord(entry);
      if (!item) return null;
      const id = asText(item.id);
      if (!id) return null;
      return {
        id,
        name: asText(item.name) || 'Sem nome',
        role: asText(item.role) || 'visitante',
        lgpd: item.lgpd === true,
        hasSelfie: item.has_selfie === true,
      };
    })
    .filter((entry): entry is FamilyTimelineMember => entry != null);

  const events = (Array.isArray(row.events) ? row.events : [])
    .map((entry) => {
      const item = asRecord(entry);
      if (!item) return null;
      const title = asText(item.title);
      if (!title) return null;
      return {
        kind: asText(item.kind),
        at: asText(item.at),
        title,
        detail: asText(item.detail),
        status: asText(item.status),
      };
    })
    .filter((entry): entry is FamilyTimelineEvent => entry != null);

  return {
    familyId: asText(row.family_id) || familyId,
    members,
    events,
    nextHint: asText(row.next_hint),
    enabled: row.enabled !== false,
    canToggle: row.can_toggle === true,
  };
}

export function formatFamilyTimelineWhen(iso: string): string {
  const raw = iso.trim();
  if (!raw) return '';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return raw;
    return `${match[3]}/${match[2]}/${match[1]}`;
  }
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

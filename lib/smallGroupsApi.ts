/**
 * API de Pequenos Grupos (células).
 * SQL: scripts/small-groups-schema.sql
 */

import { supabase } from '@/lib/supabase';
import { isSupabaseRpcMissingError } from '@/lib/supabaseRpc';

export const SMALL_GROUPS_SQL_HINT =
  'Execute no Supabase: scripts/small-groups-schema.sql';

export const SMALL_GROUP_WEEKDAYS: Array<{ value: number; label: string }> = [
  { value: 0, label: 'Domingo' },
  { value: 1, label: 'Segunda-feira' },
  { value: 2, label: 'Terça-feira' },
  { value: 3, label: 'Quarta-feira' },
  { value: 4, label: 'Quinta-feira' },
  { value: 5, label: 'Sexta-feira' },
  { value: 6, label: 'Sábado' },
];

export function formatSmallGroupWeekday(value: number | null | undefined) {
  return SMALL_GROUP_WEEKDAYS.find((item) => item.value === value)?.label ?? '—';
}

export type SmallGroupProfileSummary = {
  id: string;
  full_name: string | null;
  phone: string | null;
  cep?: string | null;
  address_street?: string | null;
  address_number?: string | null;
  address_neighborhood?: string | null;
  address_city?: string | null;
  address_state?: string | null;
};

export type MySmallGroup = {
  id: string;
  name: string;
  meeting_weekday: number;
  meeting_time: string;
  notes: string | null;
  is_leader: boolean;
  is_host: boolean;
  member_count: number;
  host: SmallGroupProfileSummary | null;
  leader: SmallGroupProfileSummary | null;
};

export type SmallGroupMemberName = {
  profile_id: string;
  full_name: string | null;
};

export type SmallGroupAdminRow = {
  id: string;
  name: string;
  meeting_weekday: number;
  meeting_time: string;
  notes: string | null;
  is_active: boolean;
  host: SmallGroupProfileSummary | null;
  leader: SmallGroupProfileSummary | null;
  member_count: number;
};

export type SmallGroupGuide = {
  id: string;
  title: string;
  content: string | null;
  video_url: string | null;
  reflection_question: string | null;
  module_title: string | null;
};

export type SmallGroupGuideCandidate = {
  id: string;
  title: string;
  module_title: string;
  is_cell_weekly_guide: boolean;
};

export type SmallGroupBadge = {
  badge_code: string;
  badge_title: string;
  badge_color: string | null;
  step_order: number | null;
};

export type SmallGroupRollCallMember = {
  profile_id: string;
  full_name: string | null;
  phone: string | null;
  present: boolean;
  badges: SmallGroupBadge[];
};

export type SmallGroupMapPin = {
  group_id: string;
  group_name: string;
  host_profile_id: string;
  meeting_weekday: number;
  meeting_time: string;
};

export type NearbySmallGroupHost = {
  groupId: string;
  groupName: string;
  hostProfileId: string;
  hostName: string;
  neighborhood: string;
  meetingWeekday: number;
  meetingTime: string;
  memberCount: number;
  isMember: boolean;
  distanceMeters: number | null;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

const parseProfile = (value: unknown): SmallGroupProfileSummary | null => {
  const row = asRecord(value);
  const id = String(row.id ?? '').trim();

  if (!id) {
    return null;
  }

  return {
    id,
    full_name: row.full_name != null ? String(row.full_name) : null,
    phone: row.phone != null ? String(row.phone) : null,
    cep: row.cep != null ? String(row.cep) : null,
    address_street: row.address_street != null ? String(row.address_street) : null,
    address_number: row.address_number != null ? String(row.address_number) : null,
    address_neighborhood: row.address_neighborhood != null ? String(row.address_neighborhood) : null,
    address_city: row.address_city != null ? String(row.address_city) : null,
    address_state: row.address_state != null ? String(row.address_state) : null,
  };
};

const throwIfMissing = (error: { message?: string }, name: string) => {
  if (isSupabaseRpcMissingError(error, name)) {
    throw new Error(SMALL_GROUPS_SQL_HINT);
  }
};

const rpcJson = async (name: string, args?: Record<string, unknown>) => {
  const { data, error } = await supabase.rpc(name, args ?? {});

  if (error) {
    throwIfMissing(error, name);
    throw new Error(error.message || 'Falha ao consultar pequenos grupos.');
  }

  return asRecord(data);
};

export async function fetchMySmallGroup(): Promise<MySmallGroup | null> {
  const payload = await rpcJson('list_my_small_group');

  if (payload.success === false) {
    throw new Error(String(payload.message ?? 'Não foi possível carregar o pequeno grupo.'));
  }

  const group = asRecord(payload.group);

  if (!String(group.id ?? '').trim()) {
    return null;
  }

  return {
    id: String(group.id),
    name: String(group.name ?? 'Pequeno grupo'),
    meeting_weekday: Number(group.meeting_weekday ?? 0),
    meeting_time: String(group.meeting_time ?? ''),
    notes: group.notes != null ? String(group.notes) : null,
    is_leader: group.is_leader === true,
    is_host: group.is_host === true,
    member_count: (() => {
      const raw = Number(group.member_count ?? 0);
      return Number.isFinite(raw) && raw > 0 ? Math.round(raw) : 0;
    })(),
    host: parseProfile(group.host),
    leader: parseProfile(group.leader),
  };
}

export async function fetchMySmallGroupMembers(groupId: string): Promise<SmallGroupMemberName[]> {
  const payload = await rpcJson('list_my_small_group_members', { p_group_id: groupId });

  if (payload.success === false) {
    throw new Error(String(payload.message ?? 'Não foi possível listar os participantes.'));
  }

  const rows = Array.isArray(payload.members) ? payload.members : [];

  return rows
    .map((item) => {
      const row = asRecord(item);
      const profileId = String(row.profile_id ?? '').trim();

      if (!profileId) {
        return null;
      }

      return {
        profile_id: profileId,
        full_name: row.full_name != null ? String(row.full_name) : null,
      } satisfies SmallGroupMemberName;
    })
    .filter((row): row is SmallGroupMemberName => row !== null);
}

export async function fetchCurrentSmallGroupGuide(): Promise<SmallGroupGuide | null> {
  const payload = await rpcJson('get_current_small_group_guide');
  const guide = asRecord(payload.guide);
  const id = String(guide.id ?? '').trim();

  if (!id) {
    return null;
  }

  return {
    id,
    title: String(guide.title ?? 'Roteiro da semana'),
    content: guide.content != null ? String(guide.content) : null,
    video_url: guide.video_url != null ? String(guide.video_url) : null,
    reflection_question: guide.reflection_question != null ? String(guide.reflection_question) : null,
    module_title: guide.module_title != null ? String(guide.module_title) : null,
  };
}

export async function fetchSmallGroupsAdmin(): Promise<{
  canAdmin: boolean;
  groups: SmallGroupAdminRow[];
}> {
  const payload = await rpcJson('list_small_groups_admin');

  if (payload.success === false) {
    throw new Error(String(payload.message ?? 'Sem permissão.'));
  }

  const groups = Array.isArray(payload.groups) ? payload.groups : [];

  return {
    canAdmin: payload.can_admin === true,
    groups: groups
      .map((item) => {
        const row = asRecord(item);
        const id = String(row.id ?? '').trim();

        if (!id) {
          return null;
        }

        return {
          id,
          name: String(row.name ?? 'Grupo'),
          meeting_weekday: Number(row.meeting_weekday ?? 0),
          meeting_time: String(row.meeting_time ?? ''),
          notes: row.notes != null ? String(row.notes) : null,
          is_active: row.is_active !== false,
          host: parseProfile(row.host),
          leader: parseProfile(row.leader),
          member_count: Number(row.member_count ?? 0),
        } satisfies SmallGroupAdminRow;
      })
      .filter((row): row is SmallGroupAdminRow => row !== null),
  };
}

export async function saveSmallGroupAdmin(input: {
  id?: string | null;
  name: string;
  meetingWeekday: number;
  meetingTime: string;
  hostProfileId?: string | null;
  leaderProfileId?: string | null;
  notes?: string | null;
}) {
  const payload = await rpcJson('upsert_small_group_admin', {
    p_id: input.id ?? null,
    p_name: input.name,
    p_meeting_weekday: input.meetingWeekday,
    p_meeting_time: input.meetingTime,
    p_host_profile_id: input.hostProfileId ?? null,
    p_leader_profile_id: input.leaderProfileId ?? null,
    p_notes: input.notes ?? null,
    p_is_active: true,
  });

  return {
    success: payload.success === true,
    message: String(payload.message ?? (payload.success === true ? 'Grupo salvo.' : 'Falha ao salvar.')),
    id: payload.id ? String(payload.id) : null,
  };
}

export async function deleteSmallGroupAdmin(groupId: string) {
  const payload = await rpcJson('delete_small_group_admin', { p_id: groupId });

  return {
    success: payload.success === true,
    message: String(
      payload.message ?? (payload.success === true ? 'Grupo excluído.' : 'Falha ao excluir.')
    ),
  };
}

export async function searchSmallGroupProfiles(query: string): Promise<SmallGroupProfileSummary[]> {
  const payload = await rpcJson('search_small_group_profiles', { p_query: query });
  const rows = Array.isArray(payload.profiles) ? payload.profiles : [];

  return rows
    .map((item) => parseProfile(item))
    .filter((row): row is SmallGroupProfileSummary => row !== null);
}

export async function addSmallGroupMember(groupId: string, profileId: string) {
  const payload = await rpcJson('add_small_group_member', {
    p_group_id: groupId,
    p_profile_id: profileId,
  });

  return {
    success: payload.success === true,
    message: String(payload.message ?? (payload.success === true ? 'Membro incluído.' : 'Falha ao incluir.')),
  };
}

export async function removeSmallGroupMember(groupId: string, profileId: string) {
  const payload = await rpcJson('remove_small_group_member', {
    p_group_id: groupId,
    p_profile_id: profileId,
  });

  return {
    success: payload.success === true,
    message: String(payload.message ?? (payload.success === true ? 'Membro removido.' : 'Falha ao remover.')),
  };
}

export async function fetchSmallGroupRollCall(groupId: string, meetingDate: string) {
  const payload = await rpcJson('list_small_group_roll_call', {
    p_group_id: groupId,
    p_meeting_date: meetingDate,
  });

  if (payload.success === false) {
    throw new Error(String(payload.message ?? 'Não foi possível carregar a chamada.'));
  }

  const rows = Array.isArray(payload.members) ? payload.members : [];

  return rows
    .map((item) => {
      const row = asRecord(item);
      const profileId = String(row.profile_id ?? '').trim();

      if (!profileId) {
        return null;
      }

      const badges = Array.isArray(row.badges)
        ? row.badges
            .map((badge) => {
              const entry = asRecord(badge);
              const code = String(entry.badge_code ?? '').trim();

              if (!code) {
                return null;
              }

              return {
                badge_code: code,
                badge_title: String(entry.badge_title ?? code),
                badge_color: entry.badge_color != null ? String(entry.badge_color) : null,
                step_order: entry.step_order != null ? Number(entry.step_order) : null,
              } satisfies SmallGroupBadge;
            })
            .filter((badge): badge is SmallGroupBadge => badge !== null)
        : [];

      return {
        profile_id: profileId,
        full_name: row.full_name != null ? String(row.full_name) : null,
        phone: row.phone != null ? String(row.phone) : null,
        present: row.present === true,
        badges,
      } satisfies SmallGroupRollCallMember;
    })
    .filter((row): row is SmallGroupRollCallMember => row !== null);
}

export async function setSmallGroupAttendance(input: {
  groupId: string;
  meetingDate: string;
  profileId: string;
  present: boolean;
}) {
  const payload = await rpcJson('set_small_group_attendance', {
    p_group_id: input.groupId,
    p_meeting_date: input.meetingDate,
    p_profile_id: input.profileId,
    p_present: input.present,
  });

  return {
    success: payload.success === true,
    message: String(payload.message ?? (payload.success === true ? 'Presença atualizada.' : 'Falha.')),
  };
}

export async function enqueueSmallGroupVisitor(groupId: string, fullName: string, phone: string) {
  const payload = await rpcJson('enqueue_small_group_visitor', {
    p_group_id: groupId,
    p_full_name: fullName,
    p_phone: phone,
  });

  return {
    success: payload.success === true,
    message: String(payload.message ?? 'Falha ao enviar visitante.'),
  };
}

export async function submitSmallGroupSpiritualReport(
  groupId: string,
  prayerRequests: string,
  pastoralNotes: string
) {
  const payload = await rpcJson('submit_small_group_spiritual_report', {
    p_group_id: groupId,
    p_prayer_requests: prayerRequests,
    p_pastoral_notes: pastoralNotes,
  });

  return {
    success: payload.success === true,
    message: String(payload.message ?? 'Falha ao enviar relatório.'),
  };
}

export async function fetchSmallGroupGuideCandidates(): Promise<SmallGroupGuideCandidate[]> {
  const payload = await rpcJson('list_small_group_guide_candidates');
  const rows = Array.isArray(payload.lessons) ? payload.lessons : [];

  return rows
    .map((item) => {
      const row = asRecord(item);
      const id = String(row.id ?? '').trim();

      if (!id) {
        return null;
      }

      return {
        id,
        title: String(row.title ?? 'Lição'),
        module_title: String(row.module_title ?? ''),
        is_cell_weekly_guide: row.is_cell_weekly_guide === true,
      } satisfies SmallGroupGuideCandidate;
    })
    .filter((row): row is SmallGroupGuideCandidate => row !== null);
}

export async function publishSmallGroupGuide(lessonId: string | null) {
  const payload = await rpcJson('publish_small_group_guide', { p_lesson_id: lessonId });

  return {
    success: payload.success === true,
    message: String(payload.message ?? 'Falha ao publicar roteiro.'),
  };
}

export async function fetchSmallGroupMapPins(): Promise<SmallGroupMapPin[]> {
  try {
    const payload = await rpcJson('list_small_group_map_pins');
    const rows = Array.isArray(payload.pins) ? payload.pins : [];

    return rows
      .map((item) => {
        const row = asRecord(item);
        const groupId = String(row.group_id ?? '').trim();
        const hostId = String(row.host_profile_id ?? '').trim();

        if (!groupId || !hostId) {
          return null;
        }

        return {
          group_id: groupId,
          group_name: String(row.group_name ?? 'Pequeno grupo'),
          host_profile_id: hostId,
          meeting_weekday: Number(row.meeting_weekday ?? 0),
          meeting_time: String(row.meeting_time ?? ''),
        } satisfies SmallGroupMapPin;
      })
      .filter((row): row is SmallGroupMapPin => row !== null);
  } catch {
    return [];
  }
}

export async function fetchNearbySmallGroupHosts(): Promise<{
  hasMemberLocation: boolean;
  hosts: NearbySmallGroupHost[];
}> {
  const payload = await rpcJson('list_nearby_small_group_hosts');

  if (payload.success === false) {
    throw new Error(String(payload.message ?? 'Não foi possível listar os anfitriões.'));
  }

  const rows = Array.isArray(payload.hosts) ? payload.hosts : [];

  return {
    hasMemberLocation: payload.has_member_location === true,
    hosts: rows
      .map((item) => {
        const row = asRecord(item);
        const groupId = String(row.group_id ?? '').trim();
        const hostProfileId = String(row.host_profile_id ?? '').trim();

        if (!groupId || !hostProfileId) {
          return null;
        }

        const distanceRaw = row.distance_meters;
        const distanceMeters =
          typeof distanceRaw === 'number' && Number.isFinite(distanceRaw)
            ? Math.round(distanceRaw)
            : distanceRaw != null && String(distanceRaw).trim()
              ? Number.parseInt(String(distanceRaw), 10)
              : Number.NaN;

        const memberCountRaw = Number(row.member_count ?? 0);

        return {
          groupId,
          groupName: String(row.group_name ?? 'Pequeno grupo'),
          hostProfileId,
          hostName: String(row.host_name ?? '').trim() || 'Anfitrião',
          neighborhood: String(row.neighborhood ?? '').trim() || 'Bairro não informado',
          meetingWeekday: Number(row.meeting_weekday ?? 3),
          meetingTime: String(row.meeting_time ?? '').trim(),
          memberCount: Number.isFinite(memberCountRaw) && memberCountRaw > 0 ? Math.round(memberCountRaw) : 0,
          isMember: row.is_member === true,
          distanceMeters: Number.isFinite(distanceMeters) ? distanceMeters : null,
        } satisfies NearbySmallGroupHost;
      })
      .filter((row): row is NearbySmallGroupHost => row !== null),
  };
}

export function formatSmallGroupHostDistanceMeters(distanceMeters: number | null) {
  if (distanceMeters === null || !Number.isFinite(distanceMeters)) {
    return 'Distância indisponível';
  }

  return `${Math.round(distanceMeters).toLocaleString('pt-BR')} m`;
}

export function formatSmallGroupMemberCount(count: number) {
  const safe = Number.isFinite(count) && count > 0 ? Math.round(count) : 0;

  if (safe === 1) {
    return '1 inscrito';
  }

  return `${safe} inscritos`;
}

export function formatSmallGroupParticipantCount(count: number) {
  const safe = Number.isFinite(count) && count > 0 ? Math.round(count) : 0;

  if (safe === 1) {
    return '1 participante';
  }

  return `${safe} participantes`;
}

export async function joinSmallGroupAsMember(groupId: string) {
  const payload = await rpcJson('join_small_group_as_member', { p_group_id: groupId });

  return {
    success: payload.success === true,
    message: String(
      payload.message ?? (payload.success === true ? 'Inscrição confirmada.' : 'Falha ao participar.')
    ),
  };
}

export async function leaveSmallGroupAsMember(groupId: string) {
  const payload = await rpcJson('leave_small_group_as_member', { p_group_id: groupId });

  return {
    success: payload.success === true,
    message: String(
      payload.message ?? (payload.success === true ? 'Você saiu do grupo.' : 'Falha ao sair do grupo.')
    ),
  };
}

export function isPdfLikeUrl(value: string | null | undefined) {
  const url = (value ?? '').trim().toLowerCase();
  return url.endsWith('.pdf') || url.includes('.pdf?');
}

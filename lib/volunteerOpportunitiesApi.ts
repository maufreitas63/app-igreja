/**
 * Mural de Oportunidades e Voluntariado.
 * SQL: scripts/volunteer-opportunities-schema.sql
 * Match usa ministerial_resultados (Lição 5.1); o mural do membro não recebe o perfil.
 */

import { supabase } from '@/lib/supabase';
import { isSupabaseRpcMissingError } from '@/lib/supabaseRpc';
import type { MinisterialProfileCode } from '@/lib/ministerialProfileQuestionnaire';
import { MINISTERIAL_PROFILE_LABELS } from '@/lib/ministerialProfileQuestionnaire';

export const VOLUNTEER_OPPORTUNITIES_SQL_HINT =
  'Execute no Supabase: scripts/volunteer-opportunities-schema.sql';

export const VOLUNTEER_GIFT_CODES: MinisterialProfileCode[] = [
  'PREGACAO',
  'LOUVOR',
  'PASTORAL',
  'EVANGELISMO',
  'DISCIPULADO',
  'LIDERANCA',
];

export const OPPORTUNITY_STATUSES = ['rascunho', 'aberta', 'encerrada', 'preenchida'] as const;
export type OpportunityStatus = (typeof OPPORTUNITY_STATUSES)[number];

export const OPPORTUNITY_STATUS_LABEL: Record<OpportunityStatus, string> = {
  rascunho: 'Rascunho',
  aberta: 'Aberta',
  encerrada: 'Encerrada',
  preenchida: 'Preenchida',
};

export type VolunteerOpportunityMember = {
  id: string;
  titulo: string;
  descricao: string;
  tipoEscalaId: string | null;
  ministerioNome: string | null;
  leaderName: string | null;
  leaderPhone: string | null;
  requiredGifts: MinisterialProfileCode[];
  status: OpportunityStatus;
  matchPct: number;
  isPrimaryMatch: boolean;
  myInterest: string | null;
};

export type VolunteerOpportunityAdmin = {
  id: string;
  titulo: string;
  descricao: string;
  tipoEscalaId: string | null;
  ministerioNome: string | null;
  leaderProfileId: string | null;
  leaderName: string | null;
  requiredGifts: MinisterialProfileCode[];
  status: OpportunityStatus;
  interestsCount: number;
  createdAt: string;
};

export type OpportunityMatchingMember = {
  profileId: string;
  fullName: string;
  phone: string | null;
  perfilVencedor: MinisterialProfileCode | null;
  perfilLabel: string;
  matchPct: number;
  lessonCompleted: boolean;
  interestStatus: string | null;
  interestId?: string | null;
};

export type OpportunityNotice = {
  id: string;
  opportunityId: string | null;
  title: string;
  body: string;
  createdAt: string;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

const throwIfMissing = (error: { message?: string }, name: string) => {
  if (isSupabaseRpcMissingError(error, name)) {
    throw new Error(VOLUNTEER_OPPORTUNITIES_SQL_HINT);
  }
};

const parseStatus = (value: unknown): OpportunityStatus => {
  const raw = String(value ?? '').trim().toLowerCase();
  if (raw === 'aberta' || raw === 'encerrada' || raw === 'preenchida' || raw === 'rascunho') {
    return raw;
  }
  return 'rascunho';
};

const parseGifts = (value: unknown): MinisterialProfileCode[] => {
  const list = Array.isArray(value) ? value : [];
  return list
    .map((item) => String(item ?? '').trim().toUpperCase())
    .filter((code): code is MinisterialProfileCode => code in MINISTERIAL_PROFILE_LABELS);
};

const optionalId = (value: unknown) => {
  const text = String(value ?? '').trim();
  return text || null;
};

const rpcJson = async (name: string, args?: Record<string, unknown>) => {
  const { data, error } = await supabase.rpc(name, args ?? {});

  if (error) {
    throwIfMissing(error, name);
    throw new Error(error.message || 'Falha no mural de oportunidades.');
  }

  return asRecord(data);
};

const rpcRows = async (name: string, args?: Record<string, unknown>) => {
  const { data, error } = await supabase.rpc(name, args ?? {});

  if (error) {
    throwIfMissing(error, name);
    throw new Error(error.message || 'Falha no mural de oportunidades.');
  }

  return Array.isArray(data) ? data : [];
};

export const formatGiftLabels = (gifts: MinisterialProfileCode[]) =>
  gifts.map((code) => MINISTERIAL_PROFILE_LABELS[code]).join(', ');

export async function fetchVolunteerOpportunitiesForMe(): Promise<VolunteerOpportunityMember[]> {
  const rows = await rpcRows('list_volunteer_opportunities_for_me');

  return rows
    .map((item) => {
      const row = asRecord(item);
      const id = String(row.id ?? '').trim();
      const titulo = String(row.titulo ?? '').trim();

      if (!id || !titulo) {
        return null;
      }

      return {
        id,
        titulo,
        descricao: String(row.descricao ?? ''),
        tipoEscalaId: optionalId(row.tipo_escala_id),
        ministerioNome: row.ministerio_nome != null ? String(row.ministerio_nome) : null,
        leaderName: row.leader_name != null ? String(row.leader_name) : null,
        leaderPhone: row.leader_phone != null ? String(row.leader_phone) : null,
        requiredGifts: parseGifts(row.required_gifts),
        status: parseStatus(row.status),
        matchPct: Number(row.match_pct ?? 0) || 0,
        isPrimaryMatch: row.is_primary_match === true,
        myInterest: row.my_interest != null ? String(row.my_interest) : null,
      } satisfies VolunteerOpportunityMember;
    })
    .filter((row): row is VolunteerOpportunityMember => row !== null);
}

export async function expressVolunteerOpportunityInterest(id: string) {
  const payload = await rpcJson('express_volunteer_opportunity_interest', { p_id: id });

  return {
    success: payload.success === true,
    message: String(payload.message ?? 'Interesse registrado.'),
  };
}

export async function fetchVolunteerOpportunitiesAdmin(): Promise<VolunteerOpportunityAdmin[]> {
  const rows = await rpcRows('list_volunteer_opportunities_admin');

  return rows
    .map((item) => {
      const row = asRecord(item);
      const id = String(row.id ?? '').trim();
      const titulo = String(row.titulo ?? '').trim();

      if (!id || !titulo) {
        return null;
      }

      return {
        id,
        titulo,
        descricao: String(row.descricao ?? ''),
        tipoEscalaId: optionalId(row.tipo_escala_id),
        ministerioNome: row.ministerio_nome != null ? String(row.ministerio_nome) : null,
        leaderProfileId: optionalId(row.leader_profile_id),
        leaderName: row.leader_name != null ? String(row.leader_name) : null,
        requiredGifts: parseGifts(row.required_gifts),
        status: parseStatus(row.status),
        interestsCount: Number(row.interests_count ?? 0) || 0,
        createdAt: String(row.created_at ?? ''),
      } satisfies VolunteerOpportunityAdmin;
    })
    .filter((row): row is VolunteerOpportunityAdmin => row !== null);
}

export async function saveVolunteerOpportunity(input: {
  id?: string | null;
  titulo: string;
  descricao: string;
  tipoEscalaId: string | null;
  leaderProfileId: string | null;
  requiredGifts: MinisterialProfileCode[];
  status: OpportunityStatus;
}) {
  const payload = await rpcJson('upsert_volunteer_opportunity', {
    p_id: input.id ?? null,
    p_titulo: input.titulo,
    p_descricao: input.descricao,
    p_tipo_escala_id: input.tipoEscalaId,
    p_leader_profile_id: input.leaderProfileId,
    p_required_gifts: input.requiredGifts,
    p_status: input.status,
  });

  return {
    success: payload.success === true,
    message: String(payload.message ?? (payload.success === true ? 'Vaga salva.' : 'Falha ao salvar.')),
    id: payload.id ? String(payload.id) : null,
  };
}

export async function fetchOpportunityMatchingMembers(
  opportunityId: string
): Promise<OpportunityMatchingMember[]> {
  const rows = await rpcRows('list_opportunity_matching_members', { p_id: opportunityId });

  return rows
    .map((item) => {
      const row = asRecord(item);
      const profileId = String(row.profile_id ?? '').trim();
      const fullName = String(row.full_name ?? '').trim();

      if (!profileId || !fullName) {
        return null;
      }

      const winnerRaw = String(row.perfil_vencedor ?? '').trim().toUpperCase();

      return {
        profileId,
        fullName,
        phone: row.phone != null && String(row.phone).trim() ? String(row.phone).trim() : null,
        perfilVencedor:
          winnerRaw in MINISTERIAL_PROFILE_LABELS
            ? (winnerRaw as MinisterialProfileCode)
            : null,
        perfilLabel: String(row.perfil_label ?? ''),
        matchPct: Number(row.match_pct ?? 0) || 0,
        lessonCompleted: row.lesson_completed === true,
        interestStatus: row.interest_status != null ? String(row.interest_status) : null,
        interestId: optionalId(row.interest_id),
      } satisfies OpportunityMatchingMember;
    })
    .filter((row): row is OpportunityMatchingMember => row !== null);
}

export async function resolveVolunteerOpportunityInterest(interestId: string, accept: boolean) {
  const payload = await rpcJson('resolve_volunteer_opportunity_interest', {
    p_interest_id: interestId,
    p_accept: accept,
  });

  return {
    success: payload.success === true,
    message: String(payload.message ?? 'Atualizado.'),
    suggestScaleVolunteer: payload.suggest_scale_volunteer === true,
    profileId: payload.profile_id ? String(payload.profile_id) : null,
    tipoEscalaId: payload.tipo_escala_id ? String(payload.tipo_escala_id) : null,
  };
}

export async function fetchUnreadOpportunityNotices(): Promise<OpportunityNotice[]> {
  try {
    const rows = await rpcRows('list_unread_opportunity_notices');

    return rows
      .map((item) => {
        const row = asRecord(item);
        const id = String(row.id ?? '').trim();

        if (!id) {
          return null;
        }

        return {
          id,
          opportunityId: optionalId(row.opportunity_id),
          title: String(row.title ?? 'Oportunidade'),
          body: String(row.body ?? ''),
          createdAt: String(row.created_at ?? ''),
        } satisfies OpportunityNotice;
      })
      .filter((row): row is OpportunityNotice => row !== null);
  } catch {
    return [];
  }
}

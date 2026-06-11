import { resolveActorProfileId } from '@/lib/maintenanceAccessControlApi';
import { supabase } from '@/lib/supabase';
import { isSupabaseRpcMissingError } from '@/lib/supabaseRpc';

export const FAMILY_RECEPTION_SQL_HINT =
  'Execute no Supabase: scripts/recepcao-cadastro-familiar.sql (após register-member-atomic.sql).';

export type FamilyReceptionMember = {
  id: string;
  fullName: string;
  isInformant: boolean;
  relationship: string;
  phone: string | null;
  birthDate: string | null;
  detectedFamilyId: string | null;
  matchedProfileId: string | null;
  matchedMemberId: string | null;
};

export type FamilyReceptionSubmission = {
  submissionId: string;
  createdAt: string;
  memberCount: number;
  detectedFamilyId: string | null;
  hasFamilyConflict: boolean;
  members: FamilyReceptionMember[];
};

const parseMember = (row: Record<string, unknown>): FamilyReceptionMember | null => {
  const id = String(row.id ?? '').trim();
  const fullName = String(row.full_name ?? '').trim();

  if (!id || !fullName) {
    return null;
  }

  return {
    id,
    fullName,
    isInformant: row.is_informant === true,
    relationship: String(row.relationship ?? '').trim(),
    phone: row.phone ? String(row.phone) : null,
    birthDate: row.birth_date ? String(row.birth_date) : null,
    detectedFamilyId: row.detected_family_id ? String(row.detected_family_id) : null,
    matchedProfileId: row.matched_profile_id ? String(row.matched_profile_id) : null,
    matchedMemberId: row.matched_member_id ? String(row.matched_member_id) : null,
  };
};

const parseSubmission = (row: Record<string, unknown>): FamilyReceptionSubmission | null => {
  const submissionId = String(row.submission_id ?? '').trim();

  if (!submissionId) {
    return null;
  }

  const membersRaw = Array.isArray(row.members) ? row.members : [];

  const members = membersRaw
    .map((entry) => parseMember(entry as Record<string, unknown>))
    .filter((entry): entry is FamilyReceptionMember => entry !== null);

  return {
    submissionId,
    createdAt: String(row.created_at ?? ''),
    memberCount: Number(row.member_count ?? members.length),
    detectedFamilyId: row.detected_family_id ? String(row.detected_family_id) : null,
    hasFamilyConflict: row.has_family_conflict === true,
    members,
  };
};

export async function listPendingFamilyReceptionSubmissions(limit = 50) {
  const { data, error } = await supabase.rpc('list_recepcao_cadastro_familiar_pending', {
    p_limit: limit,
  });

  if (error) {
    if (isSupabaseRpcMissingError(error, 'list_recepcao_cadastro_familiar_pending')) {
      throw new Error(FAMILY_RECEPTION_SQL_HINT);
    }

    throw error;
  }

  const record = (data ?? {}) as Record<string, unknown>;

  if (record.success !== true) {
    throw new Error(String(record.message ?? 'Não foi possível listar a recepção.'));
  }

  const submissionsRaw = Array.isArray(record.submissions) ? record.submissions : [];

  return submissionsRaw
    .map((entry) => parseSubmission(entry as Record<string, unknown>))
    .filter((entry): entry is FamilyReceptionSubmission => entry !== null);
}

export async function processFamilyReceptionBatch(submissionIds?: string[]) {
  const actorProfileId = await resolveActorProfileId();

  const { data, error } = await supabase.rpc('process_recepcao_cadastro_familiar_batch', {
    p_submission_ids: submissionIds?.length ? submissionIds : null,
    p_actor_profile_id: actorProfileId,
  });

  if (error) {
    if (isSupabaseRpcMissingError(error, 'process_recepcao_cadastro_familiar_batch')) {
      throw new Error(FAMILY_RECEPTION_SQL_HINT);
    }

    throw error;
  }

  const record = (data ?? {}) as Record<string, unknown>;

  if (record.success !== true) {
    throw new Error(String(record.message ?? 'Não foi possível processar a recepção.'));
  }

  return {
    processedSubmissions: Number(record.processed_submissions ?? 0),
    processedMembers: Number(record.processed_members ?? 0),
    skippedConflicts: Number(record.skipped_conflicts ?? 0),
    messages: Array.isArray(record.messages)
      ? record.messages.map((item) => String(item))
      : [],
  };
}

export async function rejectFamilyReceptionBatch(submissionIds: string[], reason?: string) {
  const { data, error } = await supabase.rpc('reject_recepcao_cadastro_familiar_batch', {
    p_submission_ids: submissionIds,
    p_reason: reason?.trim() || null,
  });

  if (error) {
    if (isSupabaseRpcMissingError(error, 'reject_recepcao_cadastro_familiar_batch')) {
      throw new Error(FAMILY_RECEPTION_SQL_HINT);
    }

    throw error;
  }

  const record = (data ?? {}) as Record<string, unknown>;

  if (record.success !== true) {
    throw new Error(String(record.message ?? 'Não foi possível rejeitar o lote.'));
  }

  return {
    rejectedMembers: Number(record.rejected_members ?? 0),
  };
}

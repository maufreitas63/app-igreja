import { getCachedOrFetch, invalidateAsyncCache } from '@/lib/asyncResultCache';
import { formatFullName } from '@/lib/fullName';
import { resolveActorProfileId } from '@/lib/maintenanceAccessControlApi';
import { supabase } from '@/lib/supabase';
import { isSupabaseRpcMissingError } from '@/lib/supabaseRpc';

export const PLACEHOLDER_CELL_BIRTH_DATE = '1900-01-01';

export function isPlaceholderCellBirthDate(value: string | null | undefined): boolean {
  return (value ?? '').trim().slice(0, 10) === PLACEHOLDER_CELL_BIRTH_DATE;
}

export function informantHasValidCep(cep: string | null | undefined): boolean {
  return (cep ?? '').replace(/\D/g, '').length === 8;
}

export const FAMILY_RECEPTION_SQL_HINT =
  'Execute no Supabase: scripts/recepcao-public-tenant-form.sql (após recepcao-cadastro-familiar.sql). Para corrigir lotes já gravados com famílias divergentes: scripts/recepcao-repair-family-grouping.sql';

export type FamilyReceptionMember = {
  id: string;
  fullName: string;
  isInformant: boolean;
  relationship: string;
  phone: string | null;
  birthDate: string | null;
  cep: string | null;
  detectedFamilyId: string | null;
  matchedProfileId: string | null;
  matchedMemberId: string | null;
};

export type FamilyReceptionExistingMember = {
  profileId: string;
  fullName: string;
  birthDate: string | null;
  phone: string | null;
  familyId: string | null;
  relationship: string | null;
};

export type FamilyReceptionMatch = {
  profileId: string;
  fullName: string;
  birthDate: string | null;
  phone: string | null;
  familyId: string | null;
  sameFamily: boolean;
  matchByName: boolean;
  matchByBirth: boolean;
  matchByPhone: boolean;
};

export type FamilyReceptionIncomingInspect = {
  id: string;
  fullName: string;
  isInformant: boolean;
  relationship: string;
  phone: string | null;
  birthDate: string | null;
  matches: FamilyReceptionMatch[];
};

export type FamilyReceptionLoteInspect = {
  submissionId: string;
  detectedFamilyId: string | null;
  existingMembers: FamilyReceptionExistingMember[];
  incoming: FamilyReceptionIncomingInspect[];
};

export type FamilyReceptionSubmission = {
  submissionId: string;
  createdAt: string;
  memberCount: number;
  detectedFamilyId: string | null;
  hasFamilyConflict: boolean;
  members: FamilyReceptionMember[];
};

const parseExistingMember = (row: Record<string, unknown>): FamilyReceptionExistingMember | null => {
  const profileId = String(row.profile_id ?? '').trim();
  const fullName = formatFullName(String(row.full_name ?? ''));
  if (!profileId || !fullName) {
    return null;
  }

  return {
    profileId,
    fullName,
    birthDate: row.birth_date ? String(row.birth_date) : null,
    phone: row.phone ? String(row.phone) : null,
    familyId: row.family_id ? String(row.family_id) : null,
    relationship: row.relationship ? String(row.relationship) : null,
  };
};

const parseMatch = (row: Record<string, unknown>): FamilyReceptionMatch | null => {
  const profileId = String(row.profile_id ?? '').trim();
  const fullName = formatFullName(String(row.full_name ?? ''));
  if (!profileId || !fullName) {
    return null;
  }

  return {
    profileId,
    fullName,
    birthDate: row.birth_date ? String(row.birth_date) : null,
    phone: row.phone ? String(row.phone) : null,
    familyId: row.family_id ? String(row.family_id) : null,
    sameFamily: row.same_family === true,
    matchByName: row.match_by_name === true,
    matchByBirth: row.match_by_birth === true,
    matchByPhone: row.match_by_phone === true,
  };
};

const parseIncomingInspect = (row: Record<string, unknown>): FamilyReceptionIncomingInspect | null => {
  const id = String(row.id ?? '').trim();
  const fullName = formatFullName(String(row.full_name ?? ''));
  if (!id || !fullName) {
    return null;
  }

  const matchesRaw = Array.isArray(row.matches) ? row.matches : [];

  return {
    id,
    fullName,
    isInformant: row.is_informant === true,
    relationship: String(row.relationship ?? '').trim(),
    phone: row.phone ? String(row.phone) : null,
    birthDate: row.birth_date ? String(row.birth_date) : null,
    matches: matchesRaw
      .map((entry) => parseMatch(entry as Record<string, unknown>))
      .filter((entry): entry is FamilyReceptionMatch => entry !== null),
  };
};

const parseMember = (row: Record<string, unknown>): FamilyReceptionMember | null => {
  const id = String(row.id ?? '').trim();
  const fullName = formatFullName(String(row.full_name ?? ''));

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
    cep: row.cep ? String(row.cep) : null,
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

export async function listPendingFamilyReceptionSubmissions(
  limit = 50,
  options?: { forceRefresh?: boolean }
) {
  return getCachedOrFetch(
    `family_reception:pending:${limit}`,
    async () => {
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
    },
    { ttlMs: 30_000, forceRefresh: options?.forceRefresh }
  );
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

  invalidateAsyncCache('family_reception:pending');

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

  invalidateAsyncCache('family_reception:pending');

  return {
    rejectedMembers: Number(record.rejected_members ?? 0),
  };
}

export async function updateRecepcionPendingBirthDate(memberId: string, birthDateIso: string) {
  const { data, error } = await supabase.rpc('update_recepcao_pending_birth_date', {
    p_id: memberId,
    p_birth_date: birthDateIso,
  });

  if (error) {
    if (isSupabaseRpcMissingError(error, 'update_recepcao_pending_birth_date')) {
      throw new Error(FAMILY_RECEPTION_SQL_HINT);
    }

    throw error;
  }

  const record = (data ?? {}) as Record<string, unknown>;

  if (record.success !== true) {
    throw new Error(String(record.message ?? 'Não foi possível atualizar a data de nascimento.'));
  }

  invalidateAsyncCache('family_reception:pending');
  return { message: String(record.message ?? 'Data de nascimento atualizada.') };
}

export async function updateRecepcionPendingCep(memberId: string, cep: string) {
  const { data, error } = await supabase.rpc('update_recepcao_pending_cep', {
    p_id: memberId,
    p_cep: cep,
  });

  if (error) {
    if (isSupabaseRpcMissingError(error, 'update_recepcao_pending_cep')) {
      throw new Error(FAMILY_RECEPTION_SQL_HINT);
    }

    throw error;
  }

  const record = (data ?? {}) as Record<string, unknown>;

  if (record.success !== true) {
    throw new Error(String(record.message ?? 'Não foi possível atualizar o CEP.'));
  }

  invalidateAsyncCache('family_reception:pending');
  return { message: String(record.message ?? 'CEP atualizado no lote.') };
}

export async function inspectFamilyReceptionLote(submissionId: string): Promise<FamilyReceptionLoteInspect> {
  const { data, error } = await supabase.rpc('inspect_recepcao_lote_family', {
    p_lote_id: submissionId,
  });

  if (error) {
    if (isSupabaseRpcMissingError(error, 'inspect_recepcao_lote_family')) {
      throw new Error(FAMILY_RECEPTION_SQL_HINT);
    }

    throw error;
  }

  const record = (data ?? {}) as Record<string, unknown>;

  if (record.success !== true) {
    throw new Error(String(record.message ?? 'Não foi possível inspecionar a família do lote.'));
  }

  const existingRaw = Array.isArray(record.existing_members) ? record.existing_members : [];
  const incomingRaw = Array.isArray(record.incoming) ? record.incoming : [];

  return {
    submissionId: String(record.submission_id ?? submissionId),
    detectedFamilyId: record.detected_family_id ? String(record.detected_family_id) : null,
    existingMembers: existingRaw
      .map((entry) => parseExistingMember(entry as Record<string, unknown>))
      .filter((entry): entry is FamilyReceptionExistingMember => entry !== null),
    incoming: incomingRaw
      .map((entry) => parseIncomingInspect(entry as Record<string, unknown>))
      .filter((entry): entry is FamilyReceptionIncomingInspect => entry !== null),
  };
}

export async function rejectFamilyReceptionMember(memberId: string, reason?: string) {
  const { data, error } = await supabase.rpc('reject_recepcao_cadastro_familiar_member', {
    p_id: memberId,
    p_reason: reason?.trim() || null,
  });

  if (error) {
    if (isSupabaseRpcMissingError(error, 'reject_recepcao_cadastro_familiar_member')) {
      throw new Error(FAMILY_RECEPTION_SQL_HINT);
    }

    throw error;
  }

  const record = (data ?? {}) as Record<string, unknown>;

  if (record.success !== true) {
    throw new Error(String(record.message ?? 'Não foi possível descartar o integrante.'));
  }

  invalidateAsyncCache('family_reception:pending');

  return {
    remainingMembers: Number(record.remaining_members ?? 0),
    loteRejected: record.lote_rejected === true,
    message: String(record.message ?? 'Integrante descartado.'),
  };
}

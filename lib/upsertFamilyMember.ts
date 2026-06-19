import {
  findMemberDuplicateInFamily,
  type FamilyMemberMatchRow,
} from '@/lib/familyMemberMatch';
import { normalizeFamilyCode } from '@/lib/family';
import { MEMBER_ACCEPTED_VALUE } from '@/lib/membersAccepted';
import { supabase } from '@/lib/supabase';

export type UpsertFamilyMemberInput = {
  family_id: string;
  full_name: string;
  phone: string | null;
  birth_date: string | null;
  relationship?: string | null;
  accepted?: boolean;
};

export type UpsertFamilyMemberResult = {
  id: string;
  created: boolean;
  member: FamilyMemberMatchRow;
};

const isMissingUpsertRpcError = (error: unknown) => {
  if (!error || typeof error !== 'object' || !('message' in error)) {
    return false;
  }

  const message = String((error as { message: string }).message).toLowerCase();
  return message.includes('upsert_family_member');
};

const buildMemberPayload = (input: UpsertFamilyMemberInput) => {
  const familyId = normalizeFamilyCode(input.family_id);
  const fullName = input.full_name.trim();

  return {
    familyId,
    fullName,
    phone: input.phone?.trim() || null,
    birthDate: input.birth_date,
    relationship: input.relationship?.trim() || 'Outros',
    accepted: input.accepted ?? MEMBER_ACCEPTED_VALUE,
  };
};

async function upsertFamilyMemberFallback(
  input: UpsertFamilyMemberInput
): Promise<UpsertFamilyMemberResult> {
  const payload = buildMemberPayload(input);

  if (!payload.familyId || !payload.fullName) {
    throw new Error('Família ou nome do integrante inválido.');
  }

  const existing = await findMemberDuplicateInFamily(payload.familyId, {
    full_name: payload.fullName,
    phone: payload.phone,
  });

  if (existing?.id) {
    const { data, error } = await supabase
      .from('members')
      .update({
        full_name: payload.fullName,
        phone: payload.phone,
        birth_date: payload.birthDate,
        relationship: payload.relationship,
        family_id: payload.familyId,
        accepted: payload.accepted,
      })
      .eq('id', existing.id)
      .select('id, full_name, phone, birth_date, family_id, relationship, accepted')
      .maybeSingle();

    if (error) {
      throw error;
    }

    return {
      id: String(existing.id),
      created: false,
      member: (data ?? existing) as FamilyMemberMatchRow,
    };
  }

  const { data, error } = await supabase
    .from('members')
    .insert([
      {
        full_name: payload.fullName,
        phone: payload.phone,
        birth_date: payload.birthDate,
        relationship: payload.relationship,
        family_id: payload.familyId,
        accepted: payload.accepted,
      },
    ])
    .select('id, full_name, phone, birth_date, family_id, relationship, accepted')
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data?.id) {
    throw new Error('Integrante criado, mas o identificador não foi retornado.');
  }

  return {
    id: String(data.id),
    created: true,
    member: data as FamilyMemberMatchRow,
  };
}

/** Cria ou atualiza integrante da família sem duplicar telefone/nome na mesma família. */
export async function upsertFamilyMember(
  input: UpsertFamilyMemberInput
): Promise<UpsertFamilyMemberResult> {
  const payload = buildMemberPayload(input);

  const { data, error } = await supabase.rpc('upsert_family_member', {
    p_family_id: payload.familyId,
    p_full_name: payload.fullName,
    p_phone: payload.phone,
    p_birth_date: payload.birthDate,
    p_relationship: payload.relationship,
    p_accepted: payload.accepted,
  });

  if (!error) {
    const result = (data ?? {}) as {
      success?: boolean;
      message?: string;
      member_id?: string;
      created?: boolean;
      member?: FamilyMemberMatchRow;
    };

    if (result.success === true && result.member_id) {
      return {
        id: String(result.member_id),
        created: result.created === true,
        member:
          result.member ??
          ({
            id: result.member_id,
            full_name: payload.fullName,
            phone: payload.phone,
            birth_date: payload.birthDate,
            family_id: payload.familyId,
            relationship: payload.relationship,
            accepted: payload.accepted,
          } satisfies FamilyMemberMatchRow),
      };
    }

    if (result.message) {
      throw new Error(result.message);
    }
  }

  if (error && !isMissingUpsertRpcError(error)) {
    throw error;
  }

  return upsertFamilyMemberFallback(input);
}

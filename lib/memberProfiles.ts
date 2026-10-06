import type { ProfileAddressPatch } from '@/lib/profileAddress';
import { buildPhoneDbQueryVariants } from '@/lib/phoneDbVariants';
import { formatFullName } from '@/lib/fullName';
import { supabase } from '@/lib/supabase';

export type MemberProfileInput = {
  birth_date: string | null;
  full_name: string;
  phone: string | null;
  medical_food_alerts?: string | null;
  additional_care_notes?: string | null;
  special_needs?: string | null;
};

const isMissingFamilyIdColumnError = (error: unknown) => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const message = 'message' in error && typeof error.message === 'string' ? error.message : '';
  return message.toLowerCase().includes('family_id');
};

type ProfileUpsertPayload = {
  full_name: string;
  phone: string | null;
  birth_date: string | null;
  is_active: boolean;
  family_id: string;
  codigo_membro: string;
  medical_food_alerts?: string | null;
  additional_care_notes?: string | null;
  special_needs?: string | null;
} & ProfileAddressPatch;

const buildProfilePayload = (
  member: MemberProfileInput,
  familyId: string,
  inheritedAddress?: ProfileAddressPatch | null
): ProfileUpsertPayload => ({
  full_name: formatFullName(member.full_name),
  phone: member.phone?.trim() || null,
  birth_date: member.birth_date,
  is_active: false,
  family_id: familyId,
  codigo_membro: familyId,
  ...(member.medical_food_alerts !== undefined
    ? { medical_food_alerts: member.medical_food_alerts?.trim() || null }
    : {}),
  ...(member.additional_care_notes !== undefined
    ? { additional_care_notes: member.additional_care_notes?.trim() || null }
    : {}),
  ...(member.special_needs !== undefined
    ? { special_needs: member.special_needs?.trim() || null }
    : {}),
  ...(inheritedAddress ?? {}),
});

async function updateProfileWithFallback(profileId: string, payload: ProfileUpsertPayload) {
  // Não desativa um perfil que já existe: is_active false vale só no insert de integrante novo.
  const { is_active: _omitActiveFlag, ...profileUpdate } = payload;
  const { error } = await supabase
    .from('profiles')
    .update(profileUpdate)
    .eq('id', profileId);

  if (error && isMissingFamilyIdColumnError(error)) {
    const legacyPayload: ProfileAddressPatch & {
      full_name: string;
      phone: string | null;
      birth_date: string | null;
      is_active: boolean;
      codigo_membro: string;
    } = {
      full_name: payload.full_name,
      phone: payload.phone,
      birth_date: payload.birth_date,
      is_active: payload.is_active,
      codigo_membro: payload.codigo_membro,
      cep: payload.cep ?? null,
      address_street: payload.address_street ?? null,
      address_number: payload.address_number ?? null,
      address_complement: payload.address_complement ?? null,
      address_neighborhood: payload.address_neighborhood ?? null,
      address_city: payload.address_city ?? null,
      address_state: payload.address_state ?? null,
    };

    const { error: legacyError } = await supabase
      .from('profiles')
      .update(legacyPayload)
      .eq('id', profileId);

    if (legacyError) {
      throw legacyError;
    }

    return;
  }

  if (error) {
    throw error;
  }
}

async function insertProfileWithFallback(payload: ProfileUpsertPayload) {
  const { data, error } = await supabase
    .from('profiles')
    .insert(payload)
    .select('id')
    .maybeSingle();

  if (error && isMissingFamilyIdColumnError(error)) {
    const legacyPayload = {
      full_name: payload.full_name,
      phone: payload.phone,
      birth_date: payload.birth_date,
      is_active: payload.is_active,
      codigo_membro: payload.codigo_membro,
      cep: payload.cep ?? null,
      address_street: payload.address_street ?? null,
      address_number: payload.address_number ?? null,
      address_complement: payload.address_complement ?? null,
      address_neighborhood: payload.address_neighborhood ?? null,
      address_city: payload.address_city ?? null,
      address_state: payload.address_state ?? null,
    };

    const { data: legacyData, error: legacyError } = await supabase
      .from('profiles')
      .insert(legacyPayload)
      .select('id')
      .maybeSingle();

    if (legacyError) {
      throw legacyError;
    }

    return legacyData?.id ?? null;
  }

  if (error) {
    throw error;
  }

  return data?.id ?? null;
}

export type ManagedMemberCareFields = {
  medicalFoodAlerts: string;
  additionalCareNotes: string;
  specialNeeds: string;
};

const careText = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

export async function loadManagedMemberCareFields(input: {
  memberId?: string | null;
  profileId?: string | null;
}): Promise<ManagedMemberCareFields> {
  const { data, error } = await supabase.rpc('get_managed_member_care_fields', {
    p_profile_id: input.profileId?.trim() || null,
    p_member_id: input.memberId?.trim() || null,
  });

  if (error) {
    const message =
      typeof error.message === 'string' && error.message.trim()
        ? error.message
        : 'Não foi possível carregar os cuidados.';
    throw new Error(message);
  }

  const payload = (data ?? {}) as {
    success?: boolean;
    message?: string;
    medical_food_alerts?: unknown;
    additional_care_notes?: unknown;
    special_needs?: unknown;
  };

  if (payload.success === false) {
    throw new Error(payload.message ?? 'Não foi possível carregar os cuidados.');
  }

  return {
    medicalFoodAlerts: careText(payload.medical_food_alerts),
    additionalCareNotes: careText(payload.additional_care_notes),
    specialNeeds: careText(payload.special_needs),
  };
}

export async function saveManagedMemberCareFields(input: {
  memberId?: string | null;
  profileId?: string | null;
  medicalFoodAlerts: string;
  additionalCareNotes: string;
  specialNeeds: string;
}) {
  const { data, error } = await supabase.rpc('set_managed_member_care_fields', {
    p_profile_id: input.profileId?.trim() || null,
    p_member_id: input.memberId?.trim() || null,
    p_medical_food_alerts: input.medicalFoodAlerts.trim() || null,
    p_additional_care_notes: input.additionalCareNotes.trim() || null,
    p_special_needs: input.specialNeeds.trim() || null,
  });

  if (error) {
    const message =
      typeof error.message === 'string' && error.message.trim()
        ? error.message
        : 'Não foi possível gravar os cuidados.';
    throw new Error(message);
  }

  const payload = (data ?? {}) as { success?: boolean; message?: string };
  if (payload.success === false) {
    throw new Error(payload.message ?? 'Não foi possível gravar os cuidados.');
  }
}

export async function findProfileIdForMember(member: MemberProfileInput) {
  const normalizedName = formatFullName(member.full_name);
  const phone = member.phone?.trim() || null;
  const phoneVariants = phone ? buildPhoneDbQueryVariants(phone) : [];

  if (phoneVariants.length) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .in('phone', phoneVariants)
      .limit(1)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (data?.id) {
      return data.id;
    }
  }

  if (normalizedName) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .ilike('full_name', normalizedName)
      .limit(1)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (data?.id) {
      return data.id;
    }
  }

  return null;
}

export async function upsertProfileForManagedMember(
  member: MemberProfileInput,
  familyId: string,
  previousMember?: MemberProfileInput | null,
  inheritedAddress?: ProfileAddressPatch | null,
  explicitProfileId?: string | null,
  memberId?: string | null
) {
  const normalizedName = formatFullName(member.full_name);

  if (!normalizedName) {
    return null;
  }

  const existingProfileId =
    explicitProfileId?.trim()
    || (await findProfileIdForMember(member))
    || (previousMember ? await findProfileIdForMember(previousMember) : null);
  const payload = buildProfilePayload(member, familyId, inheritedAddress);

  if (existingProfileId) {
    await updateProfileWithFallback(existingProfileId, payload);
    await syncManagedMemberCareFields(existingProfileId, member, memberId);
    return existingProfileId;
  }

  const insertedId = await insertProfileWithFallback(payload);
  if (insertedId) {
    await syncManagedMemberCareFields(insertedId, member, memberId);
  }
  return insertedId;
}

async function syncManagedMemberCareFields(
  profileId: string,
  member: MemberProfileInput,
  memberId?: string | null
) {
  if (
    member.medical_food_alerts === undefined
    && member.additional_care_notes === undefined
    && member.special_needs === undefined
  ) {
    return;
  }

  const { data, error } = await supabase.rpc('set_managed_member_care_fields', {
    p_profile_id: profileId,
    p_medical_food_alerts: member.medical_food_alerts ?? null,
    p_additional_care_notes: member.additional_care_notes ?? null,
    p_special_needs: member.special_needs ?? null,
    p_member_id: memberId?.trim() || null,
  });

  if (error) {
    throw error;
  }

  const result = data as { success?: boolean; message?: string } | null;
  if (result && result.success === false) {
    throw new Error(result.message ?? 'Não foi possível gravar os campos de cuidado.');
  }
}

export async function ensureProfilesForMembers(
  members: MemberProfileInput[],
  familyId: string
) {
  await Promise.all(
    members
      .filter((member) => member.full_name?.trim())
      .map(async (member) => {
        const existingProfileId = await findProfileIdForMember(member);
        const payload = buildProfilePayload(member, familyId);

        if (existingProfileId) {
          await updateProfileWithFallback(existingProfileId, payload);
          return;
        }

        await insertProfileWithFallback(payload);
      })
  );
}

import type { ProfileAddressPatch } from '@/lib/profileAddress';
import { buildPhoneDbQueryVariants } from '@/lib/phoneDbVariants';
import { supabase } from '@/lib/supabase';

export type MemberProfileInput = {
  birth_date: string | null;
  full_name: string;
  phone: string | null;
  medical_food_alerts?: string | null;
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
} & ProfileAddressPatch;

const buildProfilePayload = (
  member: MemberProfileInput,
  familyId: string,
  inheritedAddress?: ProfileAddressPatch | null
): ProfileUpsertPayload => ({
  full_name: member.full_name.trim(),
  phone: member.phone?.trim() || null,
  birth_date: member.birth_date,
  is_active: false,
  family_id: familyId,
  codigo_membro: familyId,
  ...(member.medical_food_alerts !== undefined
    ? { medical_food_alerts: member.medical_food_alerts?.trim() || null }
    : {}),
  ...(inheritedAddress ?? {}),
});

async function updateProfileWithFallback(profileId: string, payload: ProfileUpsertPayload) {
  const { error } = await supabase
    .from('profiles')
    .update(payload)
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

export async function findProfileIdForMember(member: MemberProfileInput) {
  const normalizedName = member.full_name.trim();
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
  explicitProfileId?: string | null
) {
  const normalizedName = member.full_name.trim();

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
    return existingProfileId;
  }

  return insertProfileWithFallback(payload);
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

import { MEMBER_ACCEPTED_VALUE } from '@/lib/membersAccepted';
import { buildPhoneDbQueryVariants } from '@/lib/phoneDbVariants';
import { phoneDigitsMatch, resolveProfileIdByPhone } from '@/lib/resolveProfileByPhone';
import { supabase } from '@/lib/supabase';
import { clearStoredProfileId, getStoredProfileId, persistProfileId } from '@/lib/userSession';

const PROFILE_SELECT = 'id, full_name, codigo_membro, lgpd_accepted, phone, family_id, birth_date';

export type SessionProfile = {
  id?: string;
  full_name?: string | null;
  codigo_membro?: string | null;
  lgpd_accepted?: boolean | null;
  phone?: string | null;
  family_id?: string | null;
  birth_date?: string | null;
};

const normalizeProfileRow = (row: {
  id?: string;
  full_name?: string | null;
  codigo_membro?: string | null;
  lgpd_accepted?: boolean | null;
  phone?: string | null;
  family_id?: string | null;
  birth_date?: string | null;
}): SessionProfile => {
  const familyId = row.family_id ?? row.codigo_membro ?? null;

  return {
    id: row.id,
    full_name: row.full_name,
    codigo_membro: row.codigo_membro ?? familyId,
    family_id: familyId,
    lgpd_accepted: row.lgpd_accepted,
    phone: row.phone,
    birth_date: row.birth_date,
  };
};

const enrichSessionProfileName = async (
  profile: SessionProfile,
  phoneVariants: string[]
): Promise<SessionProfile> => {
  if (profile.full_name?.trim()) {
    return profile;
  }

  const variants =
    phoneVariants.length > 0
      ? phoneVariants
      : buildPhoneDbQueryVariants(profile.phone ?? '');

  if (!variants.length) {
    return profile;
  }

  const { data: memberRows, error: memberError } = await supabase
    .from('members')
    .select('full_name, phone')
    .in('phone', variants)
    .eq('accepted', MEMBER_ACCEPTED_VALUE)
    .limit(1);

  if (!memberError && memberRows?.[0]?.full_name?.trim()) {
    return {
      ...profile,
      full_name: memberRows[0].full_name.trim(),
      phone: profile.phone ?? memberRows[0].phone,
    };
  }

  const profileByPhone = await loadProfileRowByPhone(profile.phone ?? '');
  if (profileByPhone?.full_name?.trim()) {
    return {
      ...profile,
      id: profile.id ?? profileByPhone.id,
      full_name: profileByPhone.full_name.trim(),
      phone: profileByPhone.phone ?? profile.phone,
      codigo_membro: profile.codigo_membro ?? profileByPhone.codigo_membro,
      family_id: profile.family_id ?? profileByPhone.family_id,
      lgpd_accepted: profile.lgpd_accepted ?? profileByPhone.lgpd_accepted,
    };
  }

  return profile;
};

const loadProfileRowByPhone = async (targetPhone: string) => {
  const profileId = await resolveProfileIdByPhone(targetPhone);

  if (!profileId) {
    return null;
  }

  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_SELECT)
    .eq('id', profileId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return normalizeProfileRow(data);
};

export async function loadSessionProfile(targetPhone: string): Promise<SessionProfile | null> {
  const phoneVariants = buildPhoneDbQueryVariants(targetPhone);
  const storedProfileId = await getStoredProfileId();
  let storedProfileIdWasInvalid = false;

  if (storedProfileId) {
    const { data, error } = await supabase
      .from('profiles')
      .select(PROFILE_SELECT)
      .eq('id', storedProfileId)
      .maybeSingle();

    if (!error && data) {
      if (!phoneDigitsMatch(data.phone, targetPhone)) {
        storedProfileIdWasInvalid = true;
        await clearStoredProfileId();
      } else {
        const preferredProfileId = await resolveProfileIdByPhone(targetPhone);

        if (preferredProfileId && preferredProfileId !== data.id) {
          const { data: preferredData, error: preferredError } = await supabase
            .from('profiles')
            .select(PROFILE_SELECT)
            .eq('id', preferredProfileId)
            .maybeSingle();

          if (!preferredError && preferredData) {
            const profile = await enrichSessionProfileName(
              normalizeProfileRow(preferredData),
              phoneVariants
            );

            if (profile.id) {
              await persistProfileId(profile.id);
            }

            return profile;
          }
        }

        const profile = await enrichSessionProfileName(normalizeProfileRow(data), phoneVariants);
        if (profile.id) {
          await persistProfileId(profile.id);
        }
        return profile;
      }
    } else {
      storedProfileIdWasInvalid = true;
      await clearStoredProfileId();
    }
  }

  const profileByPhone = await loadProfileRowByPhone(targetPhone);
  if (profileByPhone) {
    const profile = await enrichSessionProfileName(profileByPhone, phoneVariants);
    if (profile.id) {
      await persistProfileId(profile.id);
    }
    return profile;
  }

  // Perfil removido do banco: não reutilizar dados de `members` como sessão logada.
  if (storedProfileIdWasInvalid) {
    return null;
  }

  if (phoneVariants.length) {
    const { data: memberRows, error: memberError } = await supabase
      .from('members')
      .select('full_name, family_id, phone')
      .in('phone', phoneVariants)
      .eq('accepted', MEMBER_ACCEPTED_VALUE)
      .limit(1);

    if (!memberError && memberRows?.length) {
      const member = memberRows[0];
      const profileFromMemberPhone = await loadProfileRowByPhone(member.phone ?? targetPhone);

      if (profileFromMemberPhone) {
        if (profileFromMemberPhone.id) {
          await persistProfileId(profileFromMemberPhone.id);
        }
        return profileFromMemberPhone;
      }

      return {
        full_name: member.full_name,
        codigo_membro: member.family_id,
        family_id: member.family_id,
        phone: member.phone,
      };
    }
  }

  return null;
}

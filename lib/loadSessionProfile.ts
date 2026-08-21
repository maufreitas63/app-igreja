import { fetchEffectiveSessionProfileRow } from '@/lib/effectiveProfileRpc';
import { getCachedOrFetch, invalidateAsyncCache } from '@/lib/asyncResultCache';
import { getGhostEffectiveProfileId, isGhostModeActive } from '@/lib/ghostMode';
import { MEMBER_ACCEPTED_VALUE } from '@/lib/membersAccepted';
import { buildPhoneDbQueryVariants } from '@/lib/phoneDbVariants';
import { phoneDigitsMatch, resolveProfileIdByPhone } from '@/lib/resolveProfileByPhone';
import { formatFullName } from '@/lib/fullName';
import { supabase } from '@/lib/supabase';
import {
  clearStoredProfileId,
  getStoredProfileId,
  getStoredUserPhone,
  persistProfileId,
} from '@/lib/userSession';

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
    full_name: formatFullName(row.full_name),
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
      full_name: formatFullName(memberRows[0].full_name),
      phone: profile.phone ?? memberRows[0].phone,
    };
  }

  const profileByPhone = await loadProfileRowByPhone(profile.phone ?? '');
  if (profileByPhone?.full_name?.trim()) {
    return {
      ...profile,
      id: profile.id ?? profileByPhone.id,
      full_name: formatFullName(profileByPhone.full_name),
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

export async function loadSessionProfileById(
  profileId: string,
  options?: { persist?: boolean }
): Promise<SessionProfile | null> {
  const trimmed = profileId?.trim();

  if (!trimmed) {
    return null;
  }

  if (isGhostModeActive() && getGhostEffectiveProfileId() === trimmed) {
    const row = await fetchEffectiveSessionProfileRow();
    const rowId = String(row?.id ?? '').trim();

    // Só confia no RPC se ele devolveu o alvo do Ghost (evita sessão real quando o SQL ignora o header).
    if (row && rowId === trimmed) {
      return normalizeProfileRow({
        id: rowId,
        full_name: row.full_name as string | null | undefined,
        codigo_membro: row.codigo_membro as string | null | undefined,
        lgpd_accepted: row.lgpd_accepted as boolean | null | undefined,
        phone: row.phone as string | null | undefined,
        family_id: row.family_id as string | null | undefined,
        birth_date: row.birth_date as string | null | undefined,
      });
    }
  }

  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_SELECT)
    .eq('id', trimmed)
    .maybeSingle();

  if ((!error && data) || !isGhostModeActive()) {
    if (error || !data) {
      return null;
    }

    const phoneVariants = buildPhoneDbQueryVariants(data.phone ?? '');
    const profile = await enrichSessionProfileName(normalizeProfileRow(data), phoneVariants);

    if (profile.id && options?.persist !== false && !isGhostModeActive()) {
      await persistProfileId(profile.id);
    }

    return profile;
  }

  // Ghost ativo e SELECT direto falhou (RLS): tenta de novo via RPC após o patch, ou null.
  const fallbackRow = await fetchEffectiveSessionProfileRow();
  const fallbackId = String(fallbackRow?.id ?? '').trim();

  if (fallbackRow && fallbackId === trimmed) {
    return normalizeProfileRow({
      id: fallbackId,
      full_name: fallbackRow.full_name as string | null | undefined,
      codigo_membro: fallbackRow.codigo_membro as string | null | undefined,
      lgpd_accepted: fallbackRow.lgpd_accepted as boolean | null | undefined,
      phone: fallbackRow.phone as string | null | undefined,
      family_id: fallbackRow.family_id as string | null | undefined,
      birth_date: fallbackRow.birth_date as string | null | undefined,
    });
  }

  return null;
}

/** Perfil da sessão efetiva (alvo do Modo Ghost, se ativo). */
export async function loadEffectiveSessionProfile(
  fallbackPhone?: string | null
): Promise<SessionProfile | null> {
  const ghostProfileId = getGhostEffectiveProfileId();

  if (ghostProfileId) {
    return getCachedOrFetch(
      `session:profile:ghost:${ghostProfileId}`,
      () => loadSessionProfileById(ghostProfileId, { persist: false }),
      { scopeId: ghostProfileId, ttlMs: 60_000 }
    );
  }

  const phone = fallbackPhone?.trim() || (await getStoredUserPhone())?.trim();

  if (!phone) {
    return null;
  }

  return getCachedOrFetch(
    `session:profile:phone:${phone}`,
    () => loadSessionProfile(phone),
    { scopeId: phone, ttlMs: 60_000 }
  );
}

/**
 * Telefone da identidade efetiva (alvo do Modo Ghost, se ativo).
 * Use em telas/listas que devem espelhar o usuário simulado — nunca getStoredUserPhone nesses fluxos.
 */
export async function getEffectiveUserPhone(
  fallbackPhone?: string | null
): Promise<string | null> {
  if (isGhostModeActive()) {
    const profile = await loadEffectiveSessionProfile();
    return profile?.phone?.trim() || null;
  }

  const phone = fallbackPhone?.trim() || (await getStoredUserPhone())?.trim();
  return phone || null;
}

export function invalidateSessionProfileLoadCache() {
  invalidateAsyncCache('session:profile:');
}

export async function loadSessionProfile(targetPhone: string): Promise<SessionProfile | null> {
  if (!targetPhone?.trim()) {
    return null;
  }

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
        full_name: formatFullName(member.full_name),
        codigo_membro: member.family_id,
        family_id: member.family_id,
        phone: member.phone,
      };
    }
  }

  return null;
}

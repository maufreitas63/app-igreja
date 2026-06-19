import { buildPhoneDbQueryVariants } from '@/lib/phoneDbVariants';
import { supabase } from '@/lib/supabase';
import { normalizePhoneDigits } from '@/lib/totemDevice';

export const phoneDigitsMatch = (
  left: string | null | undefined,
  right: string | null | undefined
) => {
  const a = normalizePhoneDigits(left);
  const b = normalizePhoneDigits(right);

  if (!a || !b) {
    return false;
  }

  const aLocal = a.startsWith('55') && a.length >= 12 ? a.slice(2) : a;
  const bLocal = b.startsWith('55') && b.length >= 12 ? b.slice(2) : b;

  return a === b || aLocal === bLocal || a === `55${bLocal}` || b === `55${aLocal}`;
};

const listProfileIdsByPhoneVariants = async (variants: string[]): Promise<string[]> => {
  if (!variants.length) {
    return [];
  }

  const { data, error } = await supabase.from('profiles').select('id').in('phone', variants);

  if (error || !data?.length) {
    return [];
  }

  return [...new Set(data.map((row) => row.id).filter((id): id is string => Boolean(id)))];
};

const preferAuthProfileId = async (profileIds: string[]): Promise<string | null> => {
  if (!profileIds.length) {
    return null;
  }

  if (profileIds.length === 1) {
    return profileIds[0];
  }

  const memberFacingIds: string[] = [];

  for (const profileId of profileIds) {
    const { data, error } = await supabase.rpc('is_super_admin_profile', {
      p_profile_id: profileId,
    });

    if (error || data !== true) {
      memberFacingIds.push(profileId);
    }
  }

  if (memberFacingIds.length > 0) {
    return memberFacingIds[0];
  }

  return profileIds[0];
};

const resolveProfileIdByPhoneRpc = async (phone: string): Promise<string | null> => {
  const digits = phone.replace(/\D/g, '');

  if (!digits) {
    return null;
  }

  const { data, error } = await supabase.rpc('find_profile_id_by_phone', {
    p_phone: digits,
  });

  if (error || data == null) {
    return null;
  }

  const profileId = String(data).trim();
  return profileId || null;
};

/** Escolhe o perfil de membro quando há duplicatas de telefone (evita super_admin no login). */
export async function resolveProfileIdByPhone(phone: string): Promise<string | null> {
  const trimmed = phone.trim();

  if (!trimmed) {
    return null;
  }

  const rpcProfileId = await resolveProfileIdByPhoneRpc(trimmed);

  if (rpcProfileId) {
    return rpcProfileId;
  }

  const variants = buildPhoneDbQueryVariants(trimmed);
  const profileIds = await listProfileIdsByPhoneVariants(variants);

  if (!profileIds.length) {
    return null;
  }

  return preferAuthProfileId(profileIds);
}

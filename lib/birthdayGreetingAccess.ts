import { coerceRpcBoolean } from '@/lib/supabaseRpc';
import { resolveEffectiveProfileId } from '@/lib/sessionProfile';
import { supabase } from '@/lib/supabase';

export type BirthdayGreetingAccess = {
  canRead: boolean;
  canCopy: boolean;
};

const DENIED_ACCESS: BirthdayGreetingAccess = { canRead: false, canCopy: false };

async function profileHasRole(profileId: string, roleCode: string) {
  const { data, error } = await supabase.rpc('profile_has_role_code', {
    p_profile_id: profileId,
    p_role_code: roleCode,
  });

  if (error) {
    console.warn(`profile_has_role_code(${roleCode}):`, error.message);
    return false;
  }

  return coerceRpcBoolean(data);
}

/** Visitantes não veem; membros e congregados leem; só Secretaria (e Super Admin) copia. */
export async function resolveBirthdayGreetingAccess(): Promise<BirthdayGreetingAccess> {
  const profileId = await resolveEffectiveProfileId();

  if (!profileId) {
    return DENIED_ACCESS;
  }

  const [member, congregado, secretaria, superAdmin] = await Promise.all([
    profileHasRole(profileId, 'member'),
    profileHasRole(profileId, 'congregado'),
    profileHasRole(profileId, 'secretaria'),
    supabase.rpc('is_super_admin_profile', { p_profile_id: profileId }).then((result) => {
      if (result.error) {
        console.warn('is_super_admin_profile:', result.error.message);
        return false;
      }

      return coerceRpcBoolean(result.data);
    }),
  ]);

  const canCopy = secretaria || superAdmin;
  const canRead = canCopy || member || congregado;

  return { canRead, canCopy };
}

export function buildBirthdayGreetingMessage(fullName: string) {
  const name = fullName.trim() || 'este irmão';
  return `Juntem-se a nós para parabenizar ${name} por mais um ano de vida. Aproveite e reserve alguns minutinhos para orar e agradecer por essa vida.`;
}

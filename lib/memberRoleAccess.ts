import { resolveEffectiveProfileId } from '@/lib/sessionProfile';
import { supabase } from '@/lib/supabase';
import { coerceRpcBoolean } from '@/lib/supabaseRpc';

/** Papel `member` da identidade efetiva (alvo do Ghost, se ativo). */
export async function effectiveProfileHasMemberRole(): Promise<boolean> {
  const profileId = (await resolveEffectiveProfileId())?.trim() || '';

  if (!profileId) {
    return false;
  }

  const { data, error } = await supabase.rpc('profile_has_role_code', {
    p_profile_id: profileId,
    p_role_code: 'member',
  });

  if (error) {
    console.warn('profile_has_role_code(member):', error.message);
    return false;
  }

  return coerceRpcBoolean(data);
}

import { isProfileVisibleInApp } from '@/lib/activeMemberProfile';
import { supabase } from '@/lib/supabase';

export async function fetchProfileHasActiveMembership(profileId: string | null | undefined) {
  const normalizedId = profileId?.trim();

  if (!normalizedId) {
    return false;
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('membership_out')
    .eq('id', normalizedId)
    .maybeSingle();

  if (error) {
    console.warn('fetchProfileHasActiveMembership:', error.message);
    return true;
  }

  return isProfileVisibleInApp(data?.membership_out ?? null);
}

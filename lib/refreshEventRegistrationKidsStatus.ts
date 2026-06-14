import {
  loadKidsTeensAgeLimits,
  resolveKidsTeensStatusFromBirthDate,
} from '@/lib/kidsTeensStatus';
import { supabase } from '@/lib/supabase';

const isMissingRefreshRpc = (message: string) => {
  const normalized = message.toLowerCase();

  return (
    normalized.includes('refresh_profile_kids_teens_registrations')
    && (normalized.includes('could not find') || normalized.includes('does not exist') || normalized.includes('pgrst202'))
  );
};

/** Recalcula `kids_status` nas inscrições do perfil após alteração de nascimento. */
export async function refreshEventRegistrationKidsStatus(
  profileId: string | null | undefined,
  birthDate: string | null | undefined
) {
  const trimmedProfileId = profileId?.trim();

  if (!trimmedProfileId) {
    return;
  }

  const limits = await loadKidsTeensAgeLimits();
  const kidsStatus = resolveKidsTeensStatusFromBirthDate(birthDate, limits) ?? null;

  const { error: rpcError } = await supabase.rpc('refresh_profile_kids_teens_registrations', {
    p_profile_id: trimmedProfileId,
    p_birth_date: birthDate,
  });

  if (!rpcError) {
    return;
  }

  if (!isMissingRefreshRpc(rpcError.message ?? '')) {
    console.warn('refreshEventRegistrationKidsStatus:', rpcError.message);
    return;
  }

  const { error: updateError } = await supabase
    .from('event_registrations')
    .update({ kids_status: kidsStatus })
    .eq('profile_id', trimmedProfileId);

  if (updateError) {
    console.warn('refreshEventRegistrationKidsStatus (fallback):', updateError.message);
  }
}

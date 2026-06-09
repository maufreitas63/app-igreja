import { profileHasAccess } from '@/lib/accessControl';
import { resolveActorProfileId } from '@/lib/maintenanceAccessControlApi';
import { supabase } from '@/lib/supabase';

export const PASTORAL_CARE_PANEL_RESOURCE = 'maintenance.card.pastoral_care';

export const PASTORAL_DESTINATION_INTERCESSION = 'Ministério de Intercessão';
export const PASTORAL_DESTINATION_SIGILO = 'Sigilo Pastoral';

const parseRpcBoolean = (data: unknown) => {
  if (typeof data === 'boolean') {
    return data;
  }

  if (data === 'true') {
    return true;
  }

  if (data === 'false') {
    return false;
  }

  return null;
};

export async function checkProfileIsIntercessionScaleVolunteer(profileId: string) {
  const { data, error } = await supabase.rpc('profile_is_intercession_scale_volunteer', {
    p_profile_id: profileId,
  });

  if (error) {
    const message = (error.message ?? '').toLowerCase();

    if (
      message.includes('profile_is_intercession_scale_volunteer')
      && (message.includes('could not find') || message.includes('does not exist'))
    ) {
      return false;
    }

    throw error;
  }

  return parseRpcBoolean(data) === true;
}

export async function checkSessionCanAccessPastoralCarePanel() {
  const { data, error } = await supabase.rpc('session_can_access_pastoral_care_panel');

  if (error) {
    const message = (error.message ?? '').toLowerCase();

    if (
      message.includes('session_can_access_pastoral_care_panel')
      && (message.includes('could not find') || message.includes('does not exist'))
    ) {
      return loadPastoralCarePanelAccessFallback();
    }

    throw error;
  }

  return parseRpcBoolean(data) === true;
}

async function loadPastoralCarePanelAccessFallback(profileId?: string | null) {
  const resolvedProfileId = profileId ?? (await resolveActorProfileId());

  if (!resolvedProfileId) {
    return false;
  }

  const [hasPanelGrant, isIntercessionVolunteer] = await Promise.all([
    profileHasAccess(resolvedProfileId, 'screen', PASTORAL_CARE_PANEL_RESOURCE, 'view'),
    checkProfileIsIntercessionScaleVolunteer(resolvedProfileId),
  ]);

  return hasPanelGrant || isIntercessionVolunteer;
}

export async function loadPastoralCarePanelAccess(profileId?: string | null) {
  try {
    return await checkSessionCanAccessPastoralCarePanel();
  } catch {
    return loadPastoralCarePanelAccessFallback(profileId);
  }
}

import { profileHasAccess } from '@/lib/accessControl';
import { resolveActorProfileId } from '@/lib/maintenanceAccessControlApi';
import { supabase } from '@/lib/supabase';

export const PASTORAL_CARE_PANEL_RESOURCE = 'maintenance.card.pastoral_care';

export const PASTORAL_DESTINATION_INTERCESSION = 'Ministério de Intercessão';
export const PASTORAL_DESTINATION_SIGILO = 'Sigilo Pastoral';

export type PastoralCareAccessContext = {
  profileId: string | null;
  hasFullPastoralAccess: boolean;
  isIntercessionVolunteer: boolean;
};

export type PastoralRequestUpdateAccessInput = {
  destination_label?: string | null;
  handler_profile_id?: string | null;
};

const normalizePastoralDestinationLabel = (value: string | null | undefined) =>
  (value ?? '')
    .trim()
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

export const pastoralDestinationIsSigilo = (label: string | null | undefined) => {
  const normalized = normalizePastoralDestinationLabel(label);

  return (
    normalized === 'sigilo pastoral'
    || (normalized.startsWith('sigilo') && normalized.includes('pastoral'))
  );
};

export const pastoralDestinationIsIntercession = (label: string | null | undefined) => {
  const normalized = normalizePastoralDestinationLabel(label);

  if (pastoralDestinationIsSigilo(label)) {
    return false;
  }

  return (
    normalized === 'ministerio de intercessao'
    || (normalized.includes('intercess') && normalized.includes('ministerio'))
    || normalized.includes('ministerio de intercess')
  );
};

export const canViewPastoralRequestForSession = (
  destinationLabel: string | null | undefined,
  context: PastoralCareAccessContext
) => {
  if (context.hasFullPastoralAccess) {
    return true;
  }

  if (pastoralDestinationIsSigilo(destinationLabel)) {
    return false;
  }

  return (
    pastoralDestinationIsIntercession(destinationLabel) && context.isIntercessionVolunteer
  );
};

export const filterPastoralRequestsForSession = <T extends { destination_label?: string | null }>(
  rows: T[],
  context: PastoralCareAccessContext
) => rows.filter((row) => canViewPastoralRequestForSession(row.destination_label, context));

export const canUpdatePastoralRequestForSession = (
  request: PastoralRequestUpdateAccessInput,
  context: PastoralCareAccessContext
) => {
  if (!canViewPastoralRequestForSession(request.destination_label, context)) {
    return false;
  }

  if (context.hasFullPastoralAccess) {
    return true;
  }

  if (!pastoralDestinationIsIntercession(request.destination_label)) {
    return false;
  }

  if (!context.isIntercessionVolunteer) {
    return false;
  }

  const handlerId = request.handler_profile_id?.trim() || null;

  if (!handlerId) {
    return true;
  }

  return handlerId === context.profileId?.trim();
};

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

export async function checkSessionHasFullPastoralRequestsAccess() {
  const { data, error } = await supabase.rpc('session_has_full_pastoral_requests_access');

  if (error) {
    const message = (error.message ?? '').toLowerCase();

    if (
      message.includes('session_has_full_pastoral_requests_access')
      && (message.includes('could not find') || message.includes('does not exist'))
    ) {
      return loadPastoralCareFullAccessFallback();
    }

    throw error;
  }

  return parseRpcBoolean(data) === true;
}

async function loadPastoralCareFullAccessFallback(profileId?: string | null) {
  const resolvedProfileId = profileId ?? (await resolveActorProfileId());

  if (!resolvedProfileId) {
    return false;
  }

  const { data, error } = await supabase.rpc('is_super_admin_profile', {
    p_profile_id: resolvedProfileId,
  });

  if (!error && parseRpcBoolean(data) === true) {
    return true;
  }

  const { data: roleRows, error: roleError } = await supabase
    .from('profile_access_roles')
    .select('role_id, access_roles!inner(code)')
    .eq('profile_id', resolvedProfileId);

  if (roleError) {
    return false;
  }

  return ((roleRows as Array<{ access_roles?: { code?: string | null } | null }> | null) ?? []).some(
    (row) => row.access_roles?.code?.trim().toLowerCase() === 'pastoral'
  );
}

export async function loadPastoralCareAccessContext(
  profileId?: string | null
): Promise<PastoralCareAccessContext> {
  const resolvedProfileId = profileId ?? (await resolveActorProfileId());

  if (!resolvedProfileId) {
    return {
      profileId: null,
      hasFullPastoralAccess: false,
      isIntercessionVolunteer: false,
    };
  }

  const [hasFullPastoralAccess, isIntercessionVolunteer] = await Promise.all([
    checkSessionHasFullPastoralRequestsAccess(),
    checkProfileIsIntercessionScaleVolunteer(resolvedProfileId),
  ]);

  return {
    profileId: resolvedProfileId,
    hasFullPastoralAccess,
    isIntercessionVolunteer,
  };
}

import { getAppParameterValue } from '@/lib/appParameters';
import { supabase } from '@/lib/supabase';
import type { RegistrationStatus } from '@/hooks/useRegisteredEventMembers';

export type ProfileEventRegistrationResult = {
  success: boolean;
  message?: string;
};

const parseRpcResult = (data: unknown): ProfileEventRegistrationResult => {
  if (!data || typeof data !== 'object') {
    return { success: false, message: 'Resposta inválida do servidor.' };
  }

  const record = data as Record<string, unknown>;

  return {
    success: record.success === true,
    message: typeof record.message === 'string' ? record.message : undefined,
  };
};

const isMissingProfileRegistrationRpc = (error: { message?: string } | null) => {
  const message = (error?.message ?? '').toLowerCase();

  return (
    message.includes('register_profile_atomic')
    || message.includes('unregister_profile_atomic')
  ) && (
    message.includes('could not find')
    || message.includes('does not exist')
    || message.includes('pgrst202')
  );
};

export async function registerProfileForEvent(
  eventId: string,
  profileId: string
): Promise<ProfileEventRegistrationResult> {
  const { data, error } = await supabase.rpc('register_profile_atomic', {
    p_event_id: eventId,
    p_profile_id: profileId,
  });

  if (error) {
    if (isMissingProfileRegistrationRpc(error)) {
      throw new Error(
        'Função register_profile_atomic não encontrada. Execute scripts/register-profile-atomic.sql no Supabase.'
      );
    }

    throw error;
  }

  const result = parseRpcResult(data);

  if (!result.success) {
    throw new Error(result.message ?? 'Não foi possível registrar sua inscrição no evento.');
  }

  return result;
}

export async function unregisterProfileFromEvent(
  eventId: string,
  profileId: string
): Promise<ProfileEventRegistrationResult> {
  const { data, error } = await supabase.rpc('unregister_profile_atomic', {
    p_event_id: eventId,
    p_profile_id: profileId,
  });

  if (error) {
    if (isMissingProfileRegistrationRpc(error)) {
      throw new Error(
        'Função unregister_profile_atomic não encontrada. Execute scripts/register-profile-atomic.sql no Supabase.'
      );
    }

    throw error;
  }

  const result = parseRpcResult(data);

  if (!result.success) {
    throw new Error(result.message ?? 'Não foi possível remover sua inscrição do evento.');
  }

  return result;
};

const getAgeFromBirthDate = (birthDate: string | null | undefined) => {
  if (!birthDate) {
    return null;
  }

  const match = birthDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) {
    return null;
  }

  const [, yearText, monthText, dayText] = match;
  const year = Number.parseInt(yearText, 10);
  const month = Number.parseInt(monthText, 10);
  const day = Number.parseInt(dayText, 10);

  if ([year, month, day].some(Number.isNaN)) {
    return null;
  }

  const today = new Date();
  let age = today.getFullYear() - year;
  const hasHadBirthdayThisYear =
    today.getMonth() + 1 > month || (today.getMonth() + 1 === month && today.getDate() >= day);

  if (!hasHadBirthdayThisYear) {
    age -= 1;
  }

  return age;
};

const resolveStatusFromBirthDate = (
  birthDate: string | null | undefined,
  idadeKids: number | null,
  idadeTeens: number | null
): RegistrationStatus | undefined => {
  const age = getAgeFromBirthDate(birthDate);

  if (age === null) {
    return undefined;
  }

  if (idadeKids !== null && age <= idadeKids) {
    return 'KIDS';
  }

  if (idadeKids !== null && idadeTeens !== null && age > idadeKids && age <= idadeTeens) {
    return 'TEENS';
  }

  return undefined;
};

export async function fetchProfileEventRegistrationStatus(
  eventId: string | undefined,
  profileId: string | undefined,
  birthDate?: string | null
): Promise<{
  isRegistered: boolean;
  registrationStatus?: RegistrationStatus;
}> {
  if (!eventId || !profileId) {
    return { isRegistered: false };
  }

  const [registrationResult, idadeKidsValue, idadeTeensValue] = await Promise.all([
    supabase
      .from('event_registrations')
      .select('id, kids_status')
      .eq('event_id', eventId)
      .eq('profile_id', profileId)
      .maybeSingle(),
    getAppParameterValue('idade_kids'),
    getAppParameterValue('idade_teens'),
  ]);

  const audienceStatus = resolveStatusFromBirthDate(
    birthDate,
    idadeKidsValue && /^\d+$/.test(idadeKidsValue.trim()) ? Number.parseInt(idadeKidsValue.trim(), 10) : null,
    idadeTeensValue && /^\d+$/.test(idadeTeensValue.trim()) ? Number.parseInt(idadeTeensValue.trim(), 10) : null
  );

  if (registrationResult.error) {
    console.warn('fetchProfileEventRegistrationStatus:', registrationResult.error.message);
    return { isRegistered: false, registrationStatus: audienceStatus };
  }

  if (!registrationResult.data?.id) {
    return { isRegistered: false, registrationStatus: audienceStatus };
  }

  const normalizedStatus = registrationResult.data.kids_status?.trim().toUpperCase();

  return {
    isRegistered: true,
    registrationStatus:
      normalizedStatus === 'KIDS' || normalizedStatus === 'TEENS'
        ? normalizedStatus
        : audienceStatus,
  };
}

import { resolveProfileIdByPhone } from '@/lib/resolveProfileByPhone';
import { supabase } from '@/lib/supabase';

/** Campos que o cadastro inicial não preenche — completados em Dados Cadastrais. */
const ONBOARDING_COMPLETION_FIELDS = [
  'cpf',
  'email',
  'cep',
  'address_street',
  'address_number',
  'address_neighborhood',
  'address_city',
  'address_state',
] as const;

const isEmptyProfileValue = (value: unknown) => {
  if (value == null) {
    return true;
  }

  if (typeof value === 'string') {
    return !value.trim();
  }

  return false;
};

export const isProfileIncompleteForOnboarding = (
  profile: Record<string, unknown> | null | undefined
) => {
  if (!profile) {
    return true;
  }

  return ONBOARDING_COMPLETION_FIELDS.some((field) => isEmptyProfileValue(profile[field]));
};

/** Card 1 — Agenda da Família (`content: event_alt`). */
export const DASHBOARD_FAMILY_AGENDA_CARD_ID = '1';

export const buildManageProfileOnboardingRoute = (phone: string) => ({
  pathname: '/manage-profile' as const,
  params: {
    phone: encodeURIComponent(phone),
    onboarding: '1',
  },
});

export const buildDashboardFamilyAgendaRoute = (phone: string) => ({
  pathname: '/(tabs)' as const,
  params: {
    phone: encodeURIComponent(phone),
    dashboardCard: DASHBOARD_FAMILY_AGENDA_CARD_ID,
  },
});

export const PROFILE_LOGIN_SELECT =
  'id, phone, full_name, birth_date, lgpd_accepted, cpf, email, cep, address_street, address_number, address_neighborhood, address_city, address_state';

/** Nome padrão ao criar perfil pelo PIN — apenas referência até o cadastro inicial. */
export const PLACEHOLDER_VISITOR_FULL_NAME = 'Visitante';

export const isPlaceholderVisitorName = (name: string | null | undefined) =>
  (name ?? '').trim().toLowerCase() === PLACEHOLDER_VISITOR_FULL_NAME.toLowerCase();

/** Perfil criado só com telefone + PIN — falta cadastro inicial em /register. */
export const isProfilePendingSelfRegistration = (
  profile: Record<string, unknown> | null | undefined
) => {
  if (!profile?.id) {
    return false;
  }

  const fullName = typeof profile.full_name === 'string' ? profile.full_name.trim() : '';

  if (!fullName || isPlaceholderVisitorName(fullName)) {
    return true;
  }

  const birthDate = profile.birth_date;

  return birthDate == null || String(birthDate).trim() === '';
};

export const buildRegisterRoute = (phone: string) => ({
  pathname: '/register' as const,
  params: {
    phone: encodeURIComponent(phone),
  },
});

export async function loadProfileByPhone(phone: string) {
  const profileId = await resolveProfileIdByPhone(phone);

  if (!profileId) {
    return null;
  }

  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_LOGIN_SELECT)
    .eq('id', profileId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? (data as Record<string, unknown>) : null;
}

/** Login ou retomada de sessão: perfil já cadastrado → card 1 Agenda da Família. */
export const resolveRegisteredUserLoginRoute = (phone: string) =>
  buildDashboardFamilyAgendaRoute(phone);

export const resolveRegisteredUserSessionRoute = (
  profile: Record<string, unknown> | null | undefined,
  phone: string
) => {
  if (!profile) {
    return null;
  }

  const phoneForSession = String(profile.phone ?? phone);

  if (isProfilePendingSelfRegistration(profile)) {
    return buildRegisterRoute(phoneForSession);
  }

  if (profile.lgpd_accepted !== true) {
    return {
      pathname: '/lgpd' as const,
      params: { phone: encodeURIComponent(phoneForSession) },
    };
  }

  return resolveRegisteredUserLoginRoute(phoneForSession);
};

/**
 * Após cadastro inicial (register): incompleto → Dados Cadastrais;
 * completo → Agenda da Família.
 */
export const resolvePostLoginRoute = (
  profile: Record<string, unknown> | null | undefined,
  phone: string
) => {
  if (isProfileIncompleteForOnboarding(profile)) {
    return buildManageProfileOnboardingRoute(phone);
  }

  return buildDashboardFamilyAgendaRoute(phone);
};

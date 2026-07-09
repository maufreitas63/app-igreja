import { supabase } from '@/lib/supabase';

export const MEDIA_AUTHORIZATION_PRIVACY_VERSION = '1.0';

export const MEDIA_AUTHORIZATION_TERMS_TEXT =
  'Autorização para uso de imagem e voz: Declaro estar ciente de que os cultos, celebrações, eventos e demais atividades promovidas pela igreja poderão ser fotografados, filmados e transmitidos pelos seus canais oficiais. Na qualidade de participante e de responsável legal pelos menores de idade vinculados ao meu cadastro familiar, autorizo a captação e a utilização da minha imagem e voz, bem como da imagem e voz desses menores, para fins institucionais, educativos, históricos e de divulgação das atividades da igreja, em mídias impressas, digitais, redes sociais, transmissões ao vivo e demais canais oficiais, sem qualquer ônus, observadas a legislação aplicável, especialmente a Lei nº 13.709/2018 (LGPD), e o respeito à honra, à dignidade e à privacidade dos envolvidos.';

export const MEDIA_AUTHORIZATION_LEGAL_INFO =
  'Este sistema utiliza Assinatura Eletrônica Avançada (Lei 14.063/2020), registrando IP, data, hora e e-mail autenticado (Magic Link) para garantir a conformidade com a LGPD e a veracidade da sua manifestação de vontade.';

export type MediaAuthorizationProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  cpf: string | null;
  phone: string | null;
};

export type SubmitMediaAuthorizationResult = {
  ok: boolean;
  message: string;
  emailMasked?: string | null;
  devConfirmUrl?: string | null;
};

export type ConfirmMediaAuthorizationResult = {
  ok: boolean;
  message: string;
  authorizationId?: string;
};

function parseRpcPayload(data: unknown): Record<string, unknown> {
  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data) as unknown;
      return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }

  return typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {};
}

export async function loadMediaAuthorizationProfile(profileId: string): Promise<MediaAuthorizationProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, cpf, phone')
    .eq('id', profileId)
    .maybeSingle();

  if (error || !data?.id) {
    console.error('[media-authorization] load profile failed', error);
    return null;
  }

  return {
    id: String(data.id),
    full_name: data.full_name ?? null,
    email: data.email ?? null,
    cpf: data.cpf ?? null,
    phone: data.phone ?? null,
  };
}

export async function submitMediaAuthorizationPending(input: {
  fullName: string;
  email: string;
  cpf: string;
  phone: string;
}): Promise<SubmitMediaAuthorizationResult> {
  const { data, error } = await supabase.rpc('submit_media_authorization_pending', {
    p_full_name: input.fullName.trim(),
    p_email: input.email.trim().toLowerCase(),
    p_cpf: input.cpf,
    p_phone: input.phone.trim(),
  });

  if (error) {
    console.error('[media-authorization] submit pending failed', error);
    return { ok: false, message: error.message || 'Não foi possível enviar a autorização.' };
  }

  const payload = parseRpcPayload(data);

  return {
    ok: payload.ok === true,
    message: String(payload.message ?? 'Resposta inválida do servidor.'),
    emailMasked: typeof payload.emailMasked === 'string' ? payload.emailMasked : null,
    devConfirmUrl: typeof payload.devConfirmUrl === 'string' ? payload.devConfirmUrl : null,
  };
}

export async function confirmMediaAuthorization(input: {
  token: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<ConfirmMediaAuthorizationResult> {
  const { data, error } = await supabase.rpc('confirm_media_authorization', {
    p_token: input.token.trim(),
    p_ip_address: input.ipAddress ?? null,
    p_user_agent: input.userAgent ?? null,
  });

  if (error) {
    console.error('[media-authorization] confirm failed', error);
    return { ok: false, message: error.message || 'Não foi possível confirmar a autorização.' };
  }

  const payload = parseRpcPayload(data);

  return {
    ok: payload.ok === true,
    message: String(payload.message ?? 'Resposta inválida do servidor.'),
    authorizationId: typeof payload.authorizationId === 'string' ? payload.authorizationId : undefined,
  };
}

export async function loadLatestMediaAuthorization(profileId: string) {
  const { data, error } = await supabase
    .from('authorizations')
    .select('id, accepted_at, storage_path, confirmed_via_email')
    .eq('profile_id', profileId)
    .order('accepted_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[media-authorization] load latest authorization failed', error);
    return null;
  }

  return data;
}

import { normalizeAuthorizationConfirmToken } from '@/lib/authorizationConfirmToken';
import { supabase } from '@/lib/supabase';
import { refreshProfileSessionToken } from '@/lib/userSession';

export const MEDIA_AUTHORIZATION_PRIVACY_VERSION = '1.0';

export const MEDIA_AUTHORIZATION_TERMS_TITLE = 'Autorização para uso de imagem e voz';

export const MEDIA_AUTHORIZATION_TERMS_BODY =
  'Declaro estar ciente de que os cultos, celebrações, eventos e demais atividades promovidas pela igreja poderão ser fotografados, filmados e transmitidos pelos seus canais oficiais. Na qualidade de participante e de responsável legal pelos menores de idade vinculados ao meu cadastro familiar, autorizo a captação e a utilização da minha imagem e voz, bem como da imagem e voz desses menores, para fins institucionais, educativos, históricos e de divulgação das atividades da igreja, em mídias impressas, digitais, redes sociais, transmissões ao vivo e demais canais oficiais, sem qualquer ônus, observadas a legislação aplicável, especialmente a Lei nº 13.709/2018 (LGPD), e o respeito à honra, à dignidade e à privacidade dos envolvidos.';

export const MEDIA_AUTHORIZATION_TERMS_TEXT = `${MEDIA_AUTHORIZATION_TERMS_TITLE}: ${MEDIA_AUTHORIZATION_TERMS_BODY}`;

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
  emailSent?: boolean;
  emailMasked?: string | null;
  emailProvider?: string | null;
  resendId?: string | null;
  sessionValid?: boolean;
  pendingId?: string | null;
};

async function pingServerSession(): Promise<{ ok: boolean; profileId: string | null }> {
  const { data, error } = await supabase.rpc('ping_profile_session');

  if (error) {
    console.warn('[media-authorization] ping_profile_session failed', error);
    return { ok: false, profileId: null };
  }

  const payload = parseRpcPayload(data);
  const profileId = typeof payload.profileId === 'string' ? payload.profileId : null;

  return {
    ok: payload.ok === true && Boolean(profileId),
    profileId,
  };
}

/** Garante token válido no PostgREST antes do submit (evita formulário aberto com sessão expirada). */
export async function ensureServerSessionForMediaAuth(profileId: string): Promise<{ ok: boolean; message?: string }> {
  const normalizedProfileId = profileId.trim();
  if (!normalizedProfileId) {
    return { ok: false, message: 'Perfil inválido. Faça login novamente.' };
  }

  let ping = await pingServerSession();
  if (ping.ok && ping.profileId === normalizedProfileId) {
    return { ok: true };
  }

  const token = await refreshProfileSessionToken(normalizedProfileId);
  if (!token) {
    return {
      ok: false,
      message: 'Sessão expirada. Saia e entre novamente com o PIN enviado ao seu e-mail.',
    };
  }

  ping = await pingServerSession();
  if (!ping.ok) {
    return {
      ok: false,
      message: 'Não foi possível validar sua sessão no servidor. Faça login novamente.',
    };
  }

  return { ok: true };
}

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
  profileId: string;
}): Promise<SubmitMediaAuthorizationResult> {
  const session = await ensureServerSessionForMediaAuth(input.profileId);
  if (!session.ok) {
    return { ok: false, message: session.message ?? 'Sessão inválida.', sessionValid: false };
  }

  const { data: debugData } = await supabase.rpc('debug_media_authorization_submit_context');
  console.info('[media-authorization] submit context', parseRpcPayload(debugData));

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

  console.info('[media-authorization] submit pending response', payload);

  return {
    ok: payload.ok === true,
    message: String(payload.message ?? 'Resposta inválida do servidor.'),
    emailSent: payload.emailSent === true,
    emailMasked: typeof payload.emailMasked === 'string' ? payload.emailMasked : null,
    emailProvider: typeof payload.emailProvider === 'string' ? payload.emailProvider : null,
    resendId: typeof payload.resendId === 'string' ? payload.resendId : null,
    sessionValid: payload.sessionValid !== false,
    pendingId: typeof payload.pendingId === 'string' ? payload.pendingId : null,
  };
}

export async function confirmMediaAuthorization(input: {
  token: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<ConfirmMediaAuthorizationResult> {
  const normalizedToken = normalizeAuthorizationConfirmToken(input.token);

  if (!normalizedToken) {
    return { ok: false, message: 'Token inválido.' };
  }

  const { data, error } = await supabase.rpc('confirm_media_authorization', {
    p_token: normalizedToken,
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

export type MediaAuthorizationPdfResult = {
  ok: boolean;
  message: string;
  storagePath?: string | null;
};

export async function retryMediaAuthorizationPdf(authorizationId: string): Promise<MediaAuthorizationPdfResult> {
  const { data, error } = await supabase.rpc('retry_media_authorization_pdf', {
    p_authorization_id: authorizationId,
  });

  if (error) {
    console.error('[media-authorization] retry pdf failed', error);
    return { ok: false, message: error.message || 'Não foi possível gerar o PDF.' };
  }

  const payload = parseRpcPayload(data);

  return {
    ok: payload.ok === true,
    message: String(payload.message ?? 'Resposta inválida do servidor.'),
    storagePath: typeof payload.storagePath === 'string' ? payload.storagePath : null,
  };
}

export async function getMediaAuthorizationPdfSignedUrl(storagePath: string): Promise<string | null> {
  const normalizedPath = storagePath.trim();
  if (!normalizedPath) {
    return null;
  }

  const { data, error } = await supabase.storage
    .from('authorizations')
    .createSignedUrl(normalizedPath, 3600);

  if (error || !data?.signedUrl) {
    console.error('[media-authorization] signed pdf url failed', error);
    return null;
  }

  return data.signedUrl;
}

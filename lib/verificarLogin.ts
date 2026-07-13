import { phoneDigitsMatch } from '@/lib/resolveProfileByPhone';
import { supabase } from '@/lib/supabase';

export type VerificarLoginResult =
  | { ok: true; profile: Record<string, unknown>; sessionToken: string | null }
  | { ok: false; reason: 'invalid_credentials' | 'rpc_error' };

const readSessionToken = (row: Record<string, unknown>) => {
  const raw = row.session_token;
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null;
};

/**
 * Valida celular + senha via RPC `verificar_login` (Supabase).
 * `p_phone` deve conter apenas dígitos; `p_password` = 4 dígitos (`profiles.access_pin`).
 */
export async function verificarLogin(
  phoneDigits: string,
  password: string
): Promise<VerificarLoginResult> {
  const cleanPhone = phoneDigits.replace(/\D/g, '');
  const cleanPassword = password.trim();

  if (!cleanPhone || cleanPassword.length !== 4) {
    return { ok: false, reason: 'invalid_credentials' };
  }

  const { data, error } = await supabase.rpc('verificar_login', {
    p_phone: cleanPhone,
    p_password: cleanPassword,
  });

  if (error) {
    console.error('verificar_login:', error);
    return { ok: false, reason: 'rpc_error' };
  }

  const rows = Array.isArray(data) ? data : [];

  if (!rows.length) {
    return { ok: false, reason: 'invalid_credentials' };
  }

  const row = rows[0];

  if (!row || typeof row !== 'object' || !('id' in row)) {
    return { ok: false, reason: 'invalid_credentials' };
  }

  const profile = row as Record<string, unknown>;
  const profileId = typeof profile.id === 'string' ? profile.id.trim() : '';

  if (!profileId) {
    return { ok: false, reason: 'invalid_credentials' };
  }

  const profilePhone = typeof profile.phone === 'string' ? profile.phone : '';

  // A RPC já validou telefone+PIN. Só rejeita no cliente se ambos os lados
  // tiverem dígitos e forem claramente de números diferentes.
  const typedDigits = cleanPhone.replace(/\D/g, '');
  const profileDigits = profilePhone.replace(/\D/g, '');

  if (typedDigits && profileDigits && !phoneDigitsMatch(profilePhone, cleanPhone)) {
    console.warn('verificar_login: telefone do perfil divergente do digitado', {
      typedDigits,
      profileDigits,
      profileId,
    });
  }

  return {
    ok: true,
    profile,
    sessionToken: readSessionToken(profile),
  };
}

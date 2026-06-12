import { supabase } from '@/lib/supabase';

export type CompleteInitialProfileRegistrationInput = {
  profileId: string;
  fullName: string;
  birthDateIso: string;
  phone: string;
  cep: string | null;
  selfieUrl: string | null;
  lgpdAccepted: boolean | null;
  familyId: string;
  codigoMembro: string;
};

export type CompleteInitialProfileRegistrationResult = {
  profile: Record<string, unknown>;
  sessionToken: string | null;
};

const parseRpcResult = (data: unknown): CompleteInitialProfileRegistrationResult | null => {
  let payload: unknown = data;

  if (typeof data === 'string') {
    try {
      payload = JSON.parse(data) as unknown;
    } catch {
      return null;
    }
  }

  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const record = payload as Record<string, unknown>;

  if (record.success === false) {
    const message = typeof record.message === 'string' ? record.message : 'Falha ao concluir cadastro inicial.';
    throw new Error(message);
  }

  const profile = record.profile;
  if (!profile || typeof profile !== 'object') {
    return null;
  }

  const sessionToken =
    typeof record.session_token === 'string' && record.session_token.trim()
      ? record.session_token.trim()
      : null;

  return {
    profile: profile as Record<string, unknown>,
    sessionToken,
  };
};

export async function completeInitialProfileRegistration(
  input: CompleteInitialProfileRegistrationInput
): Promise<CompleteInitialProfileRegistrationResult> {
  const { data, error } = await supabase.rpc('complete_initial_profile_registration', {
    p_profile_id: input.profileId,
    p_full_name: input.fullName.trim(),
    p_birth_date: input.birthDateIso,
    p_phone: input.phone,
    p_cep: input.cep,
    p_selfie_url: input.selfieUrl,
    p_lgpd_accepted: input.lgpdAccepted,
    p_family_id: input.familyId,
    p_codigo_membro: input.codigoMembro,
  });

  if (error) {
    const message = (error.message ?? '').toLowerCase();

    if (
      message.includes('complete_initial_profile_registration')
      && (message.includes('could not find') || message.includes('does not exist') || message.includes('pgrst202'))
    ) {
      throw new Error(
        'Função complete_initial_profile_registration não encontrada. Execute scripts/complete-initial-profile-registration-rpc.sql no Supabase.'
      );
    }

    throw error;
  }

  const result = parseRpcResult(data);

  if (!result?.profile?.id) {
    throw new Error('Cadastro inicial concluído, mas o perfil retornado é inválido.');
  }

  return result;
}

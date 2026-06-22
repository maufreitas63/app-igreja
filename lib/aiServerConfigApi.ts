import { resolveActorProfileId } from '@/lib/maintenanceAccessControlApi';
import { supabase } from '@/lib/supabase';
import { coerceRpcBoolean, isSupabaseRpcMissingError } from '@/lib/supabaseRpc';

export const AI_SERVER_CONFIG_SQL_HINT =
  'Execute no Supabase: scripts/access-control-ai-curator-cloudflare-patch.sql';

export const GEMINI_KEY_SETUP_HINT =
  'A igreja cria a chave em https://aistudio.google.com/apikey (conta Google da instituição) e o super admin salva aqui no aplicativo.';

export async function fetchGeminiApiKeyConfigured(): Promise<boolean> {
  const actorProfileId = await resolveActorProfileId();

  if (!actorProfileId) {
    throw new Error('Sessão inválida. Saia e entre novamente.');
  }

  const { data, error } = await supabase.rpc('ia_gemini_esta_configurada_admin', {
    p_actor_profile_id: actorProfileId,
  });

  if (error) {
    if (isSupabaseRpcMissingError(error, 'ia_gemini_esta_configurada_admin')) {
      throw new Error(AI_SERVER_CONFIG_SQL_HINT);
    }

    throw error;
  }

  return coerceRpcBoolean(data);
}

export async function saveGeminiApiKeyAdmin(apiKey: string) {
  const normalizedKey = apiKey.trim();

  if (!normalizedKey) {
    throw new Error('Informe a chave da API Gemini.');
  }

  const actorProfileId = await resolveActorProfileId();

  if (!actorProfileId) {
    throw new Error('Sessão inválida. Saia e entre novamente.');
  }

  const { error } = await supabase.rpc('salvar_chave_gemini_ia_admin', {
    p_actor_profile_id: actorProfileId,
    p_api_key: normalizedKey,
  });

  if (error) {
    if (isSupabaseRpcMissingError(error, 'salvar_chave_gemini_ia_admin')) {
      throw new Error(AI_SERVER_CONFIG_SQL_HINT);
    }

    throw new Error(error.message || 'Não foi possível salvar a chave Gemini.');
  }
}

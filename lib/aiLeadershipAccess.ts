import { sessionHasAccess } from '@/lib/accessControl';
import { isGhostModeActive } from '@/lib/ghostMode';
import { resolveEffectiveProfileId } from '@/lib/sessionProfile';
import { supabase } from '@/lib/supabase';
import { coerceRpcBoolean, isSupabaseRpcMissingError } from '@/lib/supabaseRpc';

const AI_ASSISTANT_RESOURCE = 'maintenance.card.ai_assistant';

/**
 * Liderança efetiva da sessão (Ghost = perfil-alvo).
 * Lê `profile_access_roles` via RPC `profile_is_leadership`.
 * Proteção aplicada: Gestor não tem visibilidade do Super Administrador
 */
export async function sessionProfileIsLeadership(): Promise<boolean> {
  const profileId = await resolveEffectiveProfileId({
    forceRefresh: isGhostModeActive(),
  });

  if (!profileId) {
    return false;
  }

  const { data, error } = await supabase.rpc('profile_is_leadership', {
    p_profile_id: profileId,
  });

  if (error) {
    if (isSupabaseRpcMissingError(error, 'profile_is_leadership')) {
      return false;
    }

    console.error('profile_is_leadership:', error.message);
    return false;
  }

  return coerceRpcBoolean(data);
}

/** FAB e chat: liderança na sessão E grant da tela do assistente. */
export async function sessionCanUseAiAssistant(): Promise<boolean> {
  const isLeadership = await sessionProfileIsLeadership();

  if (!isLeadership) {
    return false;
  }

  return sessionHasAccess('screen', AI_ASSISTANT_RESOURCE, 'view');
}

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

export type SessionAuthResult =
  | {
      ok: true;
      profileId: string;
      roleAtTime: string;
      supabase: SupabaseClient;
    }
  | {
      ok: false;
      error: string;
      status: number;
    };

const unauthorizedMessage = 'nao autorizado para esta funçao';

export const createServiceSupabaseClient = () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim();
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Configuração Supabase ausente na Edge Function.');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
};

export const authenticateAiLeadershipRequest = async (
  req: Request,
  supabase: SupabaseClient
): Promise<SessionAuthResult> => {
  // Proteção aplicada: Gestor não tem visibilidade do Super Administrador
  const sessionToken =
    req.headers.get('x-session-token')?.trim() || req.headers.get('X-Session-Token')?.trim() || '';

  if (!sessionToken) {
    return { ok: false, error: unauthorizedMessage, status: 401 };
  }

  const { data, error } = await supabase.rpc('resolve_profile_session_token', {
    p_token: sessionToken,
  });

  if (error) {
    console.error('resolve_profile_session_token:', error.message);
    return { ok: false, error: unauthorizedMessage, status: 401 };
  }

  const realProfileId = typeof data === 'string' ? data : null;

  if (!realProfileId) {
    return { ok: false, error: unauthorizedMessage, status: 401 };
  }

  let profileId = realProfileId;
  const ghostProfileId =
    req.headers.get('x-ghost-profile-id')?.trim() || req.headers.get('X-Ghost-Profile-Id')?.trim() || '';

  if (ghostProfileId && ghostProfileId !== realProfileId) {
    const { data: canGhost } = await supabase.rpc('can_operate_ghost_mode', {
      p_profile_id: realProfileId,
    });

    if (canGhost === true) {
      profileId = ghostProfileId;
    }
  }

  const { data: isLeadership, error: roleError } = await supabase.rpc('profile_is_leadership', {
    p_profile_id: profileId,
  });

  if (roleError) {
    console.error('profile_is_leadership:', roleError.message);
    return { ok: false, error: 'Acesso restrito à liderança.', status: 403 };
  }

  if (isLeadership !== true) {
    return { ok: false, error: 'Acesso restrito à liderança.', status: 403 };
  }

  const { data: roleAtTime, error: roleNamesError } = await supabase.rpc('profile_role_names_csv', {
    p_profile_id: profileId,
  });

  if (roleNamesError) {
    console.error('profile_role_names_csv:', roleNamesError.message);
  }

  return {
    ok: true,
    profileId,
    roleAtTime: typeof roleAtTime === 'string' && roleAtTime.trim() ? roleAtTime : 'Liderança',
    supabase,
  };
};

export const authenticateAiCuratorRequest = authenticateAiLeadershipRequest;

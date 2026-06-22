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

export const authenticateAiCuratorRequest = async (
  req: Request,
  supabase: SupabaseClient
): Promise<SessionAuthResult> => {
  const sessionToken =
    req.headers.get('x-session-token')?.trim() || req.headers.get('X-Session-Token')?.trim() || '';
  const legacyProfileId =
    req.headers.get('x-profile-id')?.trim() || req.headers.get('X-Profile-Id')?.trim() || '';

  let profileId: string | null = null;

  if (sessionToken) {
    const { data, error } = await supabase.rpc('resolve_profile_session_token', {
      p_token: sessionToken,
    });

    if (error) {
      console.error('resolve_profile_session_token:', error.message);
      return { ok: false, error: unauthorizedMessage, status: 401 };
    }

    profileId = typeof data === 'string' ? data : null;
  } else if (legacyProfileId) {
    profileId = legacyProfileId;
  }

  if (!profileId) {
    return { ok: false, error: unauthorizedMessage, status: 401 };
  }

  const { data: isCurator, error: roleError } = await supabase.rpc('profile_is_ai_curator', {
    p_profile_id: profileId,
  });

  if (roleError) {
    console.error('profile_is_ai_curator:', roleError.message);
    return { ok: false, error: unauthorizedMessage, status: 403 };
  }

  if (isCurator !== true) {
    const { data: hasRole } = await supabase
      .from('user_roles')
      .select('role_code')
      .eq('user_id', profileId)
      .eq('role_code', 'curador_ia')
      .maybeSingle();

    if (!hasRole) {
      return { ok: false, error: unauthorizedMessage, status: 403 };
    }
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
    roleAtTime: typeof roleAtTime === 'string' && roleAtTime.trim() ? roleAtTime : 'Curador IA',
    supabase,
  };
};

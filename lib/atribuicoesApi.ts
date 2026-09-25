import { resolveActorProfileId } from '@/lib/maintenanceAccessControlApi';
import { supabase } from '@/lib/supabase';
import { coerceRpcBoolean, isSupabaseRpcMissingError } from '@/lib/supabaseRpc';

export const ATRIBUICOES_SQL_HINT =
  'Execute no Supabase: scripts/access-control-atribuicoes.sql';

export const ATRIBUICOES_PAGE_SIZE = 40;

export type AtribuicaoRole = {
  code: string;
  name: string;
};

export type AtribuicaoProfile = {
  id: string;
  fullName: string;
  assigned: boolean;
};

function rpcErrorMessage(error: unknown): string {
  if (!error) return '';
  if (typeof error === 'string') return error.trim();
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message.trim();
  }
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  return '';
}

export async function sessionCanAccessAtribuicoes(): Promise<boolean> {
  const { data, error } = await supabase.rpc('session_can_access_atribuicoes');

  if (error) {
    if (isSupabaseRpcMissingError(error, 'session_can_access_atribuicoes')) {
      return false;
    }

    console.warn('session_can_access_atribuicoes:', error.message);
    return false;
  }

  return coerceRpcBoolean(data);
}

export async function listAtribuicaoRoles(): Promise<AtribuicaoRole[]> {
  const actorProfileId = await resolveActorProfileId();

  if (!actorProfileId) {
    throw new Error('Sessão inválida. Saia e entre novamente.');
  }

  const { data, error } = await supabase.rpc('listar_papeis_atribuicoes', {
    p_actor_profile_id: actorProfileId,
  });

  if (error) {
    if (isSupabaseRpcMissingError(error, 'listar_papeis_atribuicoes')) {
      throw new Error(ATRIBUICOES_SQL_HINT);
    }

    throw new Error(rpcErrorMessage(error) || 'Não foi possível carregar os papéis.');
  }

  if (!Array.isArray(data)) {
    return [];
  }

  return data
    .map((row) => {
      const record = row as Record<string, unknown>;
      const code = String(record.code ?? '').trim();
      const name = String(record.name ?? code).trim();
      return code ? { code, name } : null;
    })
    .filter((row): row is AtribuicaoRole => row !== null);
}

export async function listAtribuicaoProfiles(input: {
  roleCode: string;
  query?: string;
  offset?: number;
  limit?: number;
}): Promise<{ rows: AtribuicaoProfile[]; hasMore: boolean }> {
  const actorProfileId = await resolveActorProfileId();

  if (!actorProfileId) {
    throw new Error('Sessão inválida. Saia e entre novamente.');
  }

  const limit = input.limit ?? ATRIBUICOES_PAGE_SIZE;
  const { data, error } = await supabase.rpc('listar_perfis_atribuicoes', {
    p_actor_profile_id: actorProfileId,
    p_role_code: input.roleCode,
    p_query: input.query?.trim() || null,
    p_offset: input.offset ?? 0,
    p_limit: limit,
  });

  if (error) {
    if (isSupabaseRpcMissingError(error, 'listar_perfis_atribuicoes')) {
      throw new Error(ATRIBUICOES_SQL_HINT);
    }

    throw new Error(rpcErrorMessage(error) || 'Não foi possível carregar a lista.');
  }

  const parsed = (Array.isArray(data) ? data : [])
    .map((row) => {
      const record = row as Record<string, unknown>;
      const id = String(record.id ?? '').trim();
      const fullName = String(record.full_name ?? record.fullName ?? '').trim();

      if (!id || !fullName) {
        return null;
      }

      return {
        id,
        fullName,
        assigned: record.assigned === true,
      } satisfies AtribuicaoProfile;
    })
    .filter((row): row is AtribuicaoProfile => row !== null);

  const hasMore = parsed.length > limit;
  return {
    rows: hasMore ? parsed.slice(0, limit) : parsed,
    hasMore,
  };
}

export async function setAtribuicaoRoleAssignment(
  targetProfileId: string,
  roleCode: string,
  assigned: boolean
): Promise<{ success: boolean; message: string; assigned?: boolean }> {
  const actorProfileId = await resolveActorProfileId();

  if (!actorProfileId) {
    return { success: false, message: 'Sessão inválida. Saia e entre novamente.' };
  }

  const { data, error } = await supabase.rpc('definir_papel_atribuicao', {
    p_actor_profile_id: actorProfileId,
    p_target_profile_id: targetProfileId,
    p_role_code: roleCode,
    p_assigned: assigned,
  });

  if (error) {
    if (isSupabaseRpcMissingError(error, 'definir_papel_atribuicao')) {
      throw new Error(ATRIBUICOES_SQL_HINT);
    }

    return {
      success: false,
      message: error.message || 'Não foi possível salvar a atribuição.',
    };
  }

  const record = (data ?? {}) as Record<string, unknown>;
  return {
    success: record.success === true,
    message: String(
      record.message
        ?? (record.success === true ? 'Atribuição atualizada.' : 'Não foi possível salvar a atribuição.')
    ),
    assigned: record.assigned === true,
  };
}

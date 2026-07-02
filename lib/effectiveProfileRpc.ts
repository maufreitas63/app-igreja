import {
  PROFILE_MANAGE_COLUMN_FIELDS,
  type ProfileColumnAccess,
} from '@/lib/accessControl';
import { isGhostModeActive } from '@/lib/ghostMode';
import { GHOST_MODE_SQL_HINT } from '@/lib/ghostModeApi';
import { supabase } from '@/lib/supabase';
import { isSupabaseRpcMissing } from '@/lib/supabaseRpc';

const parseColumnAccess = (data: unknown): ProfileColumnAccess | null => {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const record = data as Record<string, unknown>;
  const view = record.view;
  const update = record.update;

  if (!view || typeof view !== 'object' || !update || typeof update !== 'object') {
    return null;
  }

  return {
    view: view as Record<string, boolean>,
    update: update as Record<string, boolean>,
  };
};

/** Perfil completo da sessão efetiva (Modo Ghost ou sessão real) — ignora RLS da tabela. */
export async function fetchEffectiveSessionProfileRow(): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase.rpc('obter_perfil_sessao_efetiva');

  if (error) {
    if (isSupabaseRpcMissing(error, 'obter_perfil_sessao_efetiva')) {
      return null;
    }

    console.error('obter_perfil_sessao_efetiva:', error);
    return null;
  }

  if (!data || typeof data !== 'object') {
    return null;
  }

  const row = data as Record<string, unknown>;
  const id = String(row.id ?? '').trim();

  if (!id) {
    return null;
  }

  return row;
}

/** Permissões de colunas alinhadas à sessão efetiva no servidor (evita descompasso no Modo Ghost). */
export async function fetchEffectiveProfileColumnAccess(): Promise<ProfileColumnAccess | null> {
  const { data, error } = await supabase.rpc('listar_acesso_colunas_perfil_sessao');

  if (error) {
    if (isSupabaseRpcMissing(error, 'listar_acesso_colunas_perfil_sessao')) {
      return null;
    }

    console.error('listar_acesso_colunas_perfil_sessao:', error);
    return null;
  }

  return parseColumnAccess(data);
}

export const EFFECTIVE_PROFILE_RPC_SQL_HINT = GHOST_MODE_SQL_HINT;

export function shouldUseEffectiveProfileRpc() {
  return isGhostModeActive();
}

export const emptyProfileColumnAccess = (): ProfileColumnAccess => ({
  view: Object.fromEntries(PROFILE_MANAGE_COLUMN_FIELDS.map((field) => [field, false])),
  update: Object.fromEntries(PROFILE_MANAGE_COLUMN_FIELDS.map((field) => [field, false])),
});

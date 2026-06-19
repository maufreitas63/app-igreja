import { DEFAULT_PALETA_PADRAO, DEFAULT_PALETAS_CATALOG } from '@/lib/defaultPalettes';
import type { Paleta } from '@/lib/paletasTypes';
import { supabase } from '@/lib/supabase';
import { isSupabaseRpcMissingError } from '@/lib/supabaseRpc';

const PALETA_SELECT =
  'id, nome, primary_color, secondary_color, bg_color, accent_color, is_active, created_at';

const isMissingTableError = (message: string) => {
  const normalized = message.toLowerCase();
  return normalized.includes('paletas') && normalized.includes('does not exist');
};

const rowToPaleta = (row: Record<string, unknown>): Paleta => ({
  id: String(row.id),
  nome: String(row.nome ?? ''),
  primary_color: String(row.primary_color ?? ''),
  secondary_color: String(row.secondary_color ?? ''),
  bg_color: String(row.bg_color ?? ''),
  accent_color: String(row.accent_color ?? ''),
  is_active: row.is_active === true,
  created_at: String(row.created_at ?? ''),
});

/** Lista todas as paletas cadastradas (ordem alfabética por nome). */
export async function fetchAllPalettes(): Promise<Paleta[]> {
  const { data, error } = await supabase
    .from('paletas')
    .select(PALETA_SELECT)
    .order('nome', { ascending: true });

  if (error) {
    if (isMissingTableError(error.message ?? '')) {
      return [...DEFAULT_PALETAS_CATALOG];
    }

    throw error;
  }

  return (data ?? []).map((row) => rowToPaleta(row as Record<string, unknown>));
}

/** Retorna a paleta com `is_active = true` ou fallback local (Padrão). */
export async function fetchActivePalette(): Promise<Paleta> {
  const { data, error } = await supabase
    .from('paletas')
    .select(PALETA_SELECT)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error.message ?? '')) {
      return DEFAULT_PALETA_PADRAO;
    }

    throw error;
  }

  if (!data) {
    return DEFAULT_PALETA_PADRAO;
  }

  return rowToPaleta(data as Record<string, unknown>);
}

export type SetActivePaletteOptions =
  | { paletaId: string; nome?: never }
  | { nome: string; paletaId?: never };

/** Desmarca todas as paletas e ativa a escolhida (via RPC no Supabase). */
export async function setActivePalette(options: SetActivePaletteOptions): Promise<Paleta> {
  if ('paletaId' in options && options.paletaId) {
    const { data, error } = await supabase.rpc('set_active_paleta', {
      p_paleta_id: options.paletaId,
    });

    if (error) {
      if (isSupabaseRpcMissingError(error, 'set_active_paleta')) {
        throw new Error(
          'Função set_active_paleta não encontrada. Execute scripts/paletas-table.sql no Supabase.'
        );
      }

      throw error;
    }

    return rowToPaleta(data as Record<string, unknown>);
  }

  const nome = options.nome?.trim();

  if (!nome) {
    throw new Error('Informe o id ou o nome da paleta.');
  }

  const { data, error } = await supabase.rpc('set_active_paleta_by_nome', {
    p_nome: nome,
  });

  if (error) {
    if (isSupabaseRpcMissingError(error, 'set_active_paleta_by_nome')) {
      throw new Error(
        'Função set_active_paleta_by_nome não encontrada. Execute scripts/paletas-table.sql no Supabase.'
      );
    }

    throw error;
  }

  return rowToPaleta(data as Record<string, unknown>);
}

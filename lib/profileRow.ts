import { supabase } from '@/lib/supabase';

/** Uma linha de `profiles` pelo id. A tela escolhe as colunas; não há segunda consulta. */
export function fetchProfileRowById(profileId: string, columns: string) {
  return supabase.from('profiles').select(columns).eq('id', profileId).maybeSingle();
}

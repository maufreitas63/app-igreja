import { supabase } from '@/lib/supabase';
import { isSupabaseRpcMissingError } from '@/lib/supabaseRpc';

export const HOME_ADMISSION_STICKER_SQL_HINT =
  'Sticker de admissão indisponível. Execute scripts/home-admission-sticker.sql no Supabase.';

export type HomeAdmissionStickerState = {
  visible: boolean;
  hasNewRegistrations: boolean;
  hasReceptionPending: boolean;
};

export async function fetchHomeAdmissionStickerState(): Promise<HomeAdmissionStickerState> {
  const { data, error } = await supabase.rpc('session_home_admission_sticker_state');

  if (error) {
    if (isSupabaseRpcMissingError(error, 'session_home_admission_sticker_state')) {
      throw new Error(HOME_ADMISSION_STICKER_SQL_HINT);
    }
    throw error;
  }

  const record = (data ?? {}) as Record<string, unknown>;

  if (record.success === false) {
    throw new Error(String(record.message ?? 'Não foi possível consultar o sticker de admissão.'));
  }

  return {
    visible: record.visible === true,
    hasNewRegistrations: record.has_new_registrations === true,
    hasReceptionPending: record.has_reception_pending === true,
  };
}

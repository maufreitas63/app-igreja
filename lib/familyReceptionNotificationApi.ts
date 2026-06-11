import {
  listPendingFamilyReceptionSubmissions,
  type FamilyReceptionSubmission,
} from '@/lib/familyReceptionApi';
import { supabase } from '@/lib/supabase';
import { isSupabaseRpcMissingError } from '@/lib/supabaseRpc';

export type { FamilyReceptionSubmission } from '@/lib/familyReceptionApi';

export { listPendingFamilyReceptionSubmissions };

export async function fetchSuperAdminWhatsAppPhone(): Promise<string | null> {
  const { data, error } = await supabase.rpc('get_super_admin_whatsapp_phone');

  if (error) {
    if (isSupabaseRpcMissingError(error, 'get_super_admin_whatsapp_phone')) {
      return null;
    }

    throw error;
  }

  const phone = typeof data === 'string' ? data.trim() : '';

  return phone || null;
}

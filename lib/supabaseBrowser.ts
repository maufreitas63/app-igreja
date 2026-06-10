import { createClient } from '@supabase/supabase-js';
import { getSupabaseAnonKey, getSupabaseUrl } from '@/lib/supabaseConfig';

/** Cliente Supabase para páginas web standalone (fora do app Expo). */
export const supabaseBrowser = createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
  auth: {
    persistSession: false,
  },
});

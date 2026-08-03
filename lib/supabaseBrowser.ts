import { createClient } from '@supabase/supabase-js';
import { getSupabaseAnonKey, getSupabaseUrl } from '@/lib/supabaseConfig';
import { getRealtimeConfig } from '@/lib/supabaseRealtimeTransport';

const realtimeConfig = getRealtimeConfig();

/** Cliente Supabase para páginas web standalone (fora do app Expo). */
export const supabaseBrowser = createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
  auth: {
    persistSession: false,
  },
  ...(realtimeConfig ? { realtime: realtimeConfig } : {}),
});

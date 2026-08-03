import { getSupabaseAnonKey, getSupabaseUrl } from '@/lib/supabaseConfig';
import { getRealtimeConfig } from '@/lib/supabaseRealtimeTransport';
import { supabaseSessionFetch } from '@/lib/supabaseSessionFetch';
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

const supabaseUrl = getSupabaseUrl();
const supabaseAnonKey = getSupabaseAnonKey();

const realtimeConfig = getRealtimeConfig();

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: supabaseSessionFetch,
  },
  auth: {
    persistSession: false, // Isso evita conflitos de rede/storage agora
  },
  ...(realtimeConfig ? { realtime: realtimeConfig } : {}),
});

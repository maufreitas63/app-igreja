import { getSupabaseAnonKey, getSupabaseUrl } from '@/lib/supabaseConfig';
import { supabaseSessionFetch } from '@/lib/supabaseSessionFetch';
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

const supabaseUrl = getSupabaseUrl();
const supabaseAnonKey = getSupabaseAnonKey();

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: supabaseSessionFetch,
  },
  auth: {
    persistSession: false, // Isso evita conflitos de rede/storage agora
  },
});
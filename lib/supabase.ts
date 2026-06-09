import { getSupabaseAnonKey, getSupabaseUrl } from '@/lib/supabaseConfig';
import { supabaseSessionFetch } from '@/lib/supabaseSessionFetch';
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

const supabaseUrl = getSupabaseUrl();
const supabaseAnonKey = getSupabaseAnonKey();

// Metro SSR (expo export) roda em Node, mas pode expor `window` — use só `process.versions.node`.
const isNodeSsrRuntime =
  typeof process !== 'undefined' && typeof process.versions?.node === 'string';

const getRealtimeConfig = () => {
  if (!isNodeSsrRuntime) {
    return undefined;
  }

  // Expo static export (Node 20) não tem WebSocket nativo; exigido pelo @supabase/realtime-js.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const wsTransport = require('ws') as typeof import('ws');

  return {
    transport: wsTransport as unknown as typeof WebSocket,
  };
};

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

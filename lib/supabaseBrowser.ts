import { createClient } from '@supabase/supabase-js';
import { getSupabaseAnonKey, getSupabaseUrl } from '@/lib/supabaseConfig';

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

/** Cliente Supabase para páginas web standalone (fora do app Expo). */
export const supabaseBrowser = createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
  auth: {
    persistSession: false,
  },
  ...(realtimeConfig ? { realtime: realtimeConfig } : {}),
});

/**
 * Transporte WebSocket só para export estático web (Node SSR).
 * Em native, o Metro usa `supabaseRealtimeTransport.native.ts`.
 */
export function getRealtimeConfig() {
  // Expo static export (Node 20) não tem WebSocket nativo; exigido pelo @supabase/realtime-js.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const wsTransport = require('ws') as typeof import('ws');

  return {
    transport: wsTransport as unknown as typeof WebSocket,
  };
}

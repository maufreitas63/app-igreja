/**
 * Transporte WebSocket para a plataforma web.
 * - Navegador/PWA: `WebSocket` global nativo (nunca o pacote Node `ws`).
 * - Export estático em Node sem WebSocket global: `ws`.
 * Native: `supabaseRealtimeTransport.native.ts`.
 */
export function getRealtimeConfig() {
  // Browser/PWA e runtimes com WebSocket embutido.
  if (typeof WebSocket !== 'undefined') {
    return undefined;
  }

  // Expo static export (Node 20) não tem WebSocket nativo.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const wsTransport = require('ws') as typeof import('ws');

  return {
    transport: wsTransport as unknown as typeof WebSocket,
  };
}

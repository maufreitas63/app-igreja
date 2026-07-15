import type { PttMessagePayload } from '@/lib/pttApi';

type SocketLike = {
  connected: boolean;
  emit: (event: string, payload?: unknown) => void;
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  off: (event: string, handler?: (...args: unknown[]) => void) => void;
  disconnect: () => void;
};

let socketPromise: Promise<SocketLike | null> | null = null;

const getSocketUrl = () =>
  (typeof process !== 'undefined'
    ? process.env.EXPO_PUBLIC_PTT_SOCKET_URL
    : undefined)?.trim() || '';

/** Conecta ao Node Socket.io (`services/ptt-server`) se EXPO_PUBLIC_PTT_SOCKET_URL estiver definido. */
export async function getPttSocket(profileId: string): Promise<SocketLike | null> {
  const url = getSocketUrl();
  if (!url || !profileId.trim()) {
    return null;
  }

  if (!socketPromise) {
    socketPromise = (async () => {
      try {
        const mod = await import('socket.io-client');
        const io = mod.io ?? (mod as { default?: typeof mod.io }).default;
        if (!io) {
          return null;
        }
        const socket = io(url, {
          transports: ['websocket', 'polling'],
          autoConnect: true,
          query: { profileId: profileId.trim() },
        }) as unknown as SocketLike;

        socket.emit('ptt:register', { profileId: profileId.trim() });
        return socket;
      } catch (error) {
        console.warn('PTT Socket.io indisponível:', error);
        return null;
      }
    })();
  }

  const socket = await socketPromise;
  if (socket && profileId.trim()) {
    socket.emit('ptt:register', { profileId: profileId.trim() });
  }
  return socket;
}

export async function emitPttViaSocket(
  profileId: string,
  payload: PttMessagePayload & { messageIds?: string[] }
): Promise<boolean> {
  const socket = await getPttSocket(profileId);
  if (!socket?.connected && socket) {
    // ainda pode emitir; o server enfileira offline
  }
  if (!socket) {
    return false;
  }
  socket.emit('ptt:send', payload);
  return true;
}

export function subscribePttSocket(
  profileId: string,
  onMessage: (payload: PttMessagePayload & { id?: string }) => void
): () => void {
  let cancelled = false;
  let socket: SocketLike | null = null;
  const handler = (...args: unknown[]) => {
    const payload = args[0] as PttMessagePayload & { id?: string };
    if (payload && typeof payload === 'object') {
      onMessage(payload);
    }
  };

  void getPttSocket(profileId).then((s) => {
    if (cancelled || !s) {
      return;
    }
    socket = s;
    s.on('ptt:message', handler);
  });

  return () => {
    cancelled = true;
    socket?.off('ptt:message', handler);
  };
}

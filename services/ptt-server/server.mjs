/**
 * Socket.io bridge for PTT.
 *
 * Env:
 *   PORT=8788
 *   SUPABASE_URL=
 *   SUPABASE_SERVICE_ROLE_KEY=
 *   CORS_ORIGIN=* (or comma-separated origins)
 *
 * Clients set EXPO_PUBLIC_PTT_SOCKET_URL to this server.
 * Offline delivery: messages already persisted in public.ptt_messages;
 * this server fans out live events to connected profile rooms.
 */
import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { createClient } from '@supabase/supabase-js';

const PORT = Number(process.env.PORT || 8788);
const SUPABASE_URL = process.env.SUPABASE_URL?.trim() || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || '';
const CORS_ORIGIN = process.env.CORS_ORIGIN?.trim() || '*';

const app = express();
app.use(
  cors({
    origin: CORS_ORIGIN === '*' ? true : CORS_ORIGIN.split(',').map((s) => s.trim()),
  })
);
app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'ptt-server' });
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: CORS_ORIGIN === '*' ? true : CORS_ORIGIN.split(',').map((s) => s.trim()),
  },
});

const onlineProfiles = new Map();

io.on('connection', (socket) => {
  const qProfile = String(socket.handshake.query.profileId || '').trim();

  const register = (profileId) => {
    const id = String(profileId || '').trim();
    if (!id) return;
    socket.data.profileId = id;
    socket.join(`profile:${id}`);
    const set = onlineProfiles.get(id) || new Set();
    set.add(socket.id);
    onlineProfiles.set(id, set);
    socket.emit('ptt:registered', { profileId: id });
  };

  if (qProfile) {
    register(qProfile);
  }

  socket.on('ptt:register', (payload) => {
    register(payload?.profileId);
  });

  socket.on('ptt:send', (payload) => {
    // Fan-out opcional se o cliente souber os destinatários; o caminho principal é Realtime/DB.
    if (payload?.recipient_profile_id) {
      io.to(`profile:${payload.recipient_profile_id}`).emit('ptt:message', payload);
    }
  });

  socket.on('disconnect', () => {
    const id = socket.data.profileId;
    if (!id) return;
    const set = onlineProfiles.get(id);
    if (!set) return;
    set.delete(socket.id);
    if (set.size === 0) {
      onlineProfiles.delete(id);
    }
  });
});

if (SUPABASE_URL && SERVICE_KEY) {
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    realtime: { params: { eventsPerSecond: 10 } },
  });

  supabase
    .channel('ptt-messages-bridge')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'ptt_messages' },
      (payload) => {
        const row = payload.new;
        if (!row?.recipient_profile_id) return;
        const room = `profile:${row.recipient_profile_id}`;
        const message = {
          id: row.id,
          remetente: row.remetente,
          setor: row.setor,
          audio_url: row.audio_url || '',
          texto_transcrito: row.texto_transcrito || '',
          timestamp: row.payload?.timestamp || '',
        };
        io.to(room).emit('ptt:message', message);

        const online = onlineProfiles.has(row.recipient_profile_id);
        if (!online) {
          // Offline: permanece em ptt_messages até list_pending_ptt_messages / ack.
          console.log(`[ptt] queued offline for ${row.recipient_profile_id}`);
        }
      }
    )
    .subscribe((status) => {
      console.log(`[ptt] supabase realtime: ${status}`);
    });
} else {
  console.warn('[ptt] SUPABASE_URL / SERVICE_ROLE_KEY ausentes — bridge Realtime desativado.');
}

httpServer.listen(PORT, () => {
  console.log(`[ptt] Socket.io listening on :${PORT}`);
});

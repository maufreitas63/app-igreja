# PTT Socket.io server

Bridge opcional de tempo real para o Walkie-Talkie.

## Rodar

```bash
cd services/ptt-server
cp .env.example .env   # preencha SUPABASE_URL e SERVICE_ROLE_KEY
npm install
npm start
```

No app (build web), defina:

```
EXPO_PUBLIC_PTT_SOCKET_URL=https://seu-host:8788
```

Sem essa variável, o app entrega via **Supabase Realtime** + fila `ptt_messages` (offline).

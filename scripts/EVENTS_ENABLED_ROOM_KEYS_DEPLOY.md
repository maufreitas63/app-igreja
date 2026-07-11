# Salas no evento (enabled_room_keys)

## Deploy (Supabase)

Execute **uma vez** no SQL Editor:

`scripts/events-enabled-room-keys.sql`

Resultado esperado: `events.enabled_room_keys ok`.

## Comportamento

- Na programação de eventos, todas as salas de `church_room_settings` (KIDS/TEENS + customizadas) podem ser marcadas.
- Os booleans `kids_room` / `teens_room` continuam sincronizados automaticamente (check-in legado).
- No menu inicial, ao abrir um evento, o nome do membro mostra à direita a sala atribuída em Configuração de salas.

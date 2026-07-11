# Configuração de salas (multi-tenant)

## Deploy (Supabase) — ordem

1. Se ainda não rodou o schema inicial:
   `scripts/church-room-settings.sql`
2. **Obrigatório** (dedupe + salas customizadas) — sem isto o app responde
   `Sala inválida. Use KIDS ou TEENS` ao criar Homens/Mulheres/etc.:
   `scripts/church-room-settings-custom-rooms.sql`

Resultado esperado do passo 2:

```json
{ "status": "custom rooms + dedupe ok", "room_rows": N, "duplicate_room_keys": 0 }
```

3. Hard refresh no app.

## O que mudou

- `room_key` único por instância (normalizado em MAIÚSCULAS; duplicatas removidas)
- Nome afetivo (`display_label`) único por instância
- Criar salas extras: Homens, Mulheres, Discipulado, Novos membros, etc.
- KIDS / TEENS continuam de sistema (eventos/check-in) e **não** podem ser excluídas

## Fluxo IBEP

1. Ative IBEP
2. Menu → engrenagem → **Configuração de salas**
3. Em **Criar nova sala**, digite `Homens` → Criar sala
4. Atribua um membro ao chip da nova sala
5. Na Agenda: `Nome - [Homens]`

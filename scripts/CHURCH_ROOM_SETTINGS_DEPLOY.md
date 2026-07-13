# Configuração de salas (multi-tenant)

## Deploy (Supabase) — ordem

1. Se ainda não rodou o schema inicial:
   `scripts/church-room-settings.sql`
2. **Obrigatório** (dedupe + salas customizadas) — sem isto o app responde
   `Sala inválida. Use KIDS ou TEENS` ao criar Homens/Mulheres/etc.:
   `scripts/church-room-settings-custom-rooms.sql`
3. **Salas padrão / especial** (override por período):
   `scripts/church-room-settings-special-rooms.sql`
4. Se o chip da especial não marcar selecionado após atribuir:
   `scripts/church-room-settings-especial-chip-selected-patch.sql`
   (já incluso no `special-rooms.sql` atualizado; só rode o patch se o passo 3 foi de versão antiga)

Resultado esperado do passo 2:

```json
{ "status": "custom rooms + dedupe ok", "room_rows": N, "duplicate_room_keys": 0 }
```

Resultado esperado do passo 3:

```text
church-room-settings-special-rooms: ok
```

4. Hard refresh no app.

## O que mudou

- `room_key` único por instância (normalizado em MAIÚSCULAS; duplicatas removidas)
- Nome afetivo (`display_label`) único por instância
- Criar salas extras: Homens, Mulheres, Discipulado, Novos membros, etc.
- KIDS / TEENS continuam de sistema (eventos/check-in) e **não** podem ser excluídas
- Tipos: **Padrão** (permanente) e **Especial** (início/fim). Enquanto a especial estiver vigente, ela sobrepõe a padrão do membro; ao acabar o período, a efetiva volta à padrão automaticamente.

## Fluxo IBEP

1. Ative IBEP
2. Menu → engrenagem → **Configuração de salas**
3. Em **Criar nova sala**, escolha Padrão ou Especial; digite o nome → Criar sala
4. Atribua a **padrão** e, se houver, a **especial** do membro
5. Na Agenda: `Nome - [sala efetiva]`

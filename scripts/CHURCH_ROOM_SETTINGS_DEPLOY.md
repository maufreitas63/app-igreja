# Configuração de salas (multi-tenant)

## Deploy (Supabase)

1. Abra o SQL Editor do projeto Supabase.
2. Execute o script completo:

```text
scripts/church-room-settings.sql
```

3. Confirme no final do script:
   - `church_room_settings + user_room_assignment prontos.`
   - `room_rows` ≥ 2 × número de igrejas

4. Hard refresh no app (Cloudflare Success).

## Fluxo de teste (IBEP)

1. Entre na instância **IBEP** (Instâncias → Usar IBEP).
2. Menu → engrenagem → **Configuração de salas**  
   (requer papel `lider`, `lider_geral`, `events_admin` ou `super_admin`).
3. Em **KIDS**, altere o nome para `Turma do Rei` → Salvar nome.  
   Em **TEENS**, altere para `Geração Eleita` → Salvar nome.
4. Em **Atribuir membros**, busque um membro e toque no chip da sala.
5. Abra a **Programação / Agenda da Família** com evento que tenha salas.  
   O participante deve aparecer como:

```text
Nome do Participante - [Turma do Rei]
```

6. Os selos do evento devem mostrar `IBEP Turma do Rei` / `IBEP Geração Eleita` (prefixo da instância + nome afetivo).

## Isolamento

- `church_room_settings` e `user_room_assignment` são filtrados por `tenant_id` da sessão.
- Trocar para IBN não exibe nomes/atribuições da IBEP.
- Códigos internos `KIDS` / `TEENS` (flags de evento e `kids_status`) **não mudam**.

## SQL de checagem rápida (IBEP)

```sql
select i.code, s.room_key, s.display_label, s.is_enabled
  from church_room_settings s
  join igrejas i on i.id = s.tenant_id
 where upper(i.code) = 'IBEP'
 order by s.sort_order;

select p.full_name, a.room_key, s.display_label
  from user_room_assignment a
  join profiles p on p.id = a.profile_id
  join igrejas i on i.id = a.tenant_id
  left join church_room_settings s
    on s.tenant_id = a.tenant_id and s.room_key = a.room_key
 where upper(i.code) = 'IBEP'
 order by p.full_name
 limit 20;
```

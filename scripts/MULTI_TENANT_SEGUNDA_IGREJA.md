# Multi-tenancy — onboarding da 2ª igreja

Pré-requisito: IBN validada (passos 01–07 em `MULTI_TENANT_DEPLOY.md`).

## O que o script faz

Arquivo: `scripts/multi-tenant-08-onboard-igreja.sql`

1. Cria linha em `igrejas` (code + name)
2. Copia `app_parameters` da IBN para o novo `tenant_id`
3. Ajusta `Parm_entidade` = code da nova igreja
4. (Opcional) Vincula um `profile` como primary e atualiza `profiles.tenant_id`

## Como executar

1. Abra o SQL no Editor
2. Edite o bloco **CONFIG**:
   - `v_code` — ex.: `'IBC'` (não use `IBN` nem o placeholder `NOVA`)
   - `v_name` — nome oficial
   - `v_admin_profile_id` — UUID de um profile existente, ou `null`
3. Execute o arquivo inteiro
4. Confira:

```sql
select id, code, name, is_active from public.igrejas order by created_at;

select count(*) as params
from public.app_parameters
where tenant_id = (select id from public.igrejas where code = 'IBC');
```

## Depois do SQL (manual / produto)

| Item | Nota |
|------|------|
| Tipos de escala | Cadastrar no painel (ou copiar da IBN com script futuro) |
| Categorias pastorais | Idem |
| ACL / papéis | Grants em `access_grants` já têm `tenant_id` — revisar por igreja |
| Primeiro evento | Criar no app logado com o admin da nova igreja |
| Famílias / membros | Começam vazios (isolamento) |

## Limitações atuais (importante)

- **Login por telefone** (`find_profile_id_by_phone`) ainda não escolhe igreja. Use **telefones únicos** entre igrejas no mesmo projeto Supabase, ou evolua o login depois.
- Um profile com `is_primary` aponta para **uma** igreja por vez (`current_session_tenant_id`).
- Catálogos globais (bíblia, CEP) continuam compartilhados — correto.

## Rollback de uma igreja nova (só se vazia)

Não drope `igrejas` se já houver dados. Em ambiente de teste, sem dados:

```sql
-- CUIDADO: só se não houver linhas de negócio nesse tenant
-- delete from public.profile_igreja_vinculos where tenant_id = '...';
-- delete from public.app_parameters where tenant_id = '...';
-- delete from public.igrejas where code = 'IBC';
```

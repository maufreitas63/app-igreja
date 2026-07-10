# Multi-tenancy (tenant_id + RLS) — deploy manual

## Contexto

O app era **single-tenant** (IBN). Esta migração introduz:

| Peça | Função |
|------|--------|
| `public.igrejas` | Tabela de tenants |
| `public.profile_igreja_vinculos` | Vínculo `profiles.id` ↔ igreja |
| `tenant_id` | Coluna FK em todas as tabelas de dados |
| `current_session_tenant_id()` | Resolve a igreja da sessão |
| `session_tenant_matches(uuid)` | Predicado obrigatório nas policies |
| Trigger `tg_set_tenant_id_from_session` | Preenche `tenant_id` no INSERT |
| Policies `AS RESTRICTIVE` | Isolam igrejas **além** do ACL atual |

**Identidade do app:** `profiles.id` via `x-session-token` / `x-profile-id` (não só `auth.uid()`). As funções de tenant usam a sessão do app e fazem fallback para `auth.uid()` quando houver `profiles.auth_user_id`.

## Ordem de execução (Supabase SQL Editor)

1. `scripts/multi-tenant-01-schema.sql` — igrejas, vínculos, helpers, seed IBN, backfill de vínculos
2. `scripts/multi-tenant-02-columns.sql` — `ADD tenant_id`, backfill, FK, índices, triggers
3. `scripts/multi-tenant-03-rls.sql` — `ENABLE RLS` + policies `AS RESTRICTIVE` (USING + WITH CHECK)
4. `scripts/multi-tenant-04-verify.sql` — diagnóstico (somente leitura)

`profile_sessions` e `password_recovery_*` recebem `tenant_id` + trigger, mas **sem** policy RESTRICTIVE no client (acesso só via RPC `security definer`, como já era o padrão do app).

Faça **backup** do projeto (Dashboard → Database → Backups) antes do passo 2.

## O que o app ganha sem mudar cada query

- **SELECT / UPDATE / DELETE:** o PostgREST/Supabase client só enxerga linhas do `tenant_id` da sessão (RLS).
- **INSERT:** o trigger preenche `tenant_id` automaticamente; a policy `WITH CHECK` rejeita outro tenant.
- **ACL existente** (`session_has_resource_access`) continua valendo; o tenant é uma camada **restritiva** adicional.

## Tabelas com `tenant_id`

Identidade, eventos, pastoral, financeiro, escalas, autorização de mídia, recepção, manutenção/suporte, `app_parameters`, `paletas`, `access_grants`, sessões e auditoria.

### Sem `tenant_id` (catálogo global compartilhado)

`bible_themes`, `bible_verses_by_theme`, `cep_geolocations`, `cep_address_cache`, `ministerial_perguntas`, `ministerial_opcoes`, `access_resources`, `access_roles`, `igrejas`.

## Atenção crítica — RPCs `SECURITY DEFINER`

Funções `security definer` **bypassam RLS** do invocador. Após o deploy, revise RPCs que leem/gravam dados de negócio para:

- filtrar com `tenant_id = public.current_session_tenant_id()`, ou
- usar `SET row_security = on` quando apropriado.

Sem isso, um RPC mal escrito ainda pode cruzar igrejas.

## Novas igrejas (depois do go-live)

```sql
insert into public.igrejas (code, name) values ('XYZ', 'Nome da Igreja');

-- Vincular um perfil admin
insert into public.profile_igreja_vinculos (profile_id, tenant_id, is_primary)
values (
  '<profile-uuid>',
  (select id from public.igrejas where code = 'XYZ'),
  true
);
```

Dados novos daquela sessão já nascem com o `tenant_id` correto via trigger.

## Rollback (emergência)

Não há rollback automático seguro. Em emergência controlada:

1. Remover policies `*_tenant_*` (RESTRICTIVE)
2. `ALTER TABLE ... NO FORCE ROW LEVEL SECURITY` (manter RLS ACL)
3. Manter a coluna `tenant_id` (não dropar sem plano)

## Checklist pós-deploy

- [ ] `multi-tenant-04-verify.sql` sem `null_tenant` e sem `profiles_sem_vinculo`
- [ ] Login no app (PIN) continua funcionando
- [ ] Listagens (eventos, membros, pastoral, financeiro) retornam dados da IBN
- [ ] INSERT de evento/pedido pastoral grava `tenant_id` da IBN
- [ ] Revisar RPCs `security definer` críticos

## Passo 5 — Auditoria de RPCs SECURITY DEFINER

Execute **bloco a bloco** (separados) em:

`scripts/multi-tenant-05-audit-security-definer.sql`

| Bloco | O que mostra |
|-------|----------------|
| **A** | Inventário de todas as funções `SECURITY DEFINER` em `public` |
| **B** | Funções que citam tabelas com `tenant_id` mas **não** citam filtro de tenant no source (heurística de risco) |
| **C** | Checklist priorizado por área do app (pastoral → financeiro → escalas → …) |
| **E** | Contagem de vínculos / tenant padrão IBN |

### Como corrigir (padrão)

No início do RPC:

```sql
v_tenant uuid := public.current_session_tenant_id();
if v_tenant is null then
  raise exception 'Sessão sem igreja (tenant) vinculada.';
end if;
```

Em leituras/escritas: `where tenant_id = v_tenant`.  
Em cadastro de profile: criar também linha em `profile_igreja_vinculos`.

Prioridade sugerida no bloco **C**: pastoral, financeiro, despesas, escalas, autorização de mídia, membros/eventos, depois ACL/cadastro.

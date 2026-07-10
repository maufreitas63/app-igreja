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

Execute **um arquivo por vez** no SQL Editor:

| Arquivo | Bloco | O que mostra |
|---------|-------|----------------|
| `scripts/multi-tenant-05a-inventory-security-definer.sql` | **A** | Inventário de todas as funções `SECURITY DEFINER` em `public` |
| `scripts/multi-tenant-05b-risk-missing-tenant-filter.sql` | **B** | Funções que citam tabelas com `tenant_id` mas **não** citam filtro de tenant (heurística de risco) |
| `scripts/multi-tenant-05c-priority-checklist.sql` | **C** | Checklist priorizado por área do app |
| `scripts/multi-tenant-05d-patch-pattern.sql` | **D** | Padrão de correção (referência) |
| `scripts/multi-tenant-05e-smoke-tenant.sql` | **E** | Contagem de vínculos / tenant padrão IBN |

Índice: `scripts/multi-tenant-05-audit-security-definer.sql`

Comece pelo **05b** (lista de risco). Cole o resultado para priorizar patches.

## Passo 6 — Patches SECURITY DEFINER (ondas)

Pré-requisito: passos 01–04 ok + checks 1–3 zerados.

**Não há CLI Supabase neste ambiente** — execute **manualmente** no SQL Editor, **um arquivo por vez**, nesta ordem. Cada onda usa `BEGIN`/`COMMIT`: se der erro no meio, a onda inteira faz rollback.

| Ordem | Arquivo | Conteúdo |
|-------|---------|----------|
| 0 | `multi-tenant-wave0-helper.sql` | `require_session_tenant_id()` |
| 1a | `multi-tenant-wave1a-pastoral.sql` | Pedidos pastorais |
| 1b | `multi-tenant-wave1b-financials.sql` | Financeiro |
| 1c | `multi-tenant-wave1c-expense-reports.sql` | Relatórios de despesa |
| 1d | `multi-tenant-wave1d-escalas.sql` | Tipos / voluntários / escalas |
| 2a | `multi-tenant-wave2a-members-directory.sql` | Membros / diretório / família |
| 2b | `multi-tenant-wave2b-events-checkin.sql` | Eventos / check-in / orquestrador |
| 2c | `multi-tenant-wave2c-media-recepcao-params.sql` | Mídia / recepção / app_parameters |
| 2d | `multi-tenant-wave2d-reports.sql` | Relatórios de manutenção `_report_*` |
| 3a | `multi-tenant-wave3a-acl-ghost.sql` | ACL / papéis / ghost / insights |
| 3b | `multi-tenant-wave3b-cadastro-exclusao.sql` | Cadastro / exclusão / ministerial |
| 4a | `multi-tenant-wave4a-match-dedupe.sql` | Match / dedupe / família (helpers) |
| 4b | `multi-tenant-wave4b-geofence-quorum.sql` | Geofence / quorum / ciclo de escala |
| 4c | `multi-tenant-wave4c-sync-params-extras.sql` | Sync / params / e-mail / extras |

### Se der erro

1. **Pare** — não execute a próxima onda.
2. Copie a mensagem de erro completa.
3. A onda com falha já deve ter feito `ROLLBACK` (nada daquele arquivo ficou pela metade).
4. Ondas anteriores que deram `Success` permanecem aplicadas.

### Depois de todas as ondas

Reexecute `multi-tenant-05b-risk-missing-tenant-filter.sql`. As funções patchadas devem sumir da lista (ou passar a citar `tenant_id`). Auth bootstrap (`verificar_login`, `password_recovery_*`) pode continuar na lista — é esperado. Residual de predicados/DDL/triggers/infra é aceitável.

## Passo 7 — Smoke test (banco + app)

### 7.1 SQL

Execute **um arquivo por vez**:

| Arquivo | Bloco | Esperado |
|---------|-------|----------|
| `scripts/multi-tenant-07a-vinculos.sql` | **7A** | `igrejas_ativas >= 1`, `vinculos_ativos > 0`, `profiles_sem_vinculo = 0` |
| `scripts/multi-tenant-07b-null-tenant.sql` | **7B** | todos `null_tenant = 0` |
| `scripts/multi-tenant-07c-amostra-ibn.sql` | **7C** | contagens IBN > 0 onde houver dados |
| `scripts/multi-tenant-07d-session-helper.sql` | **7D** | `session_tenant` null no Editor é normal |

Índice: `scripts/multi-tenant-07-smoke.sql`

### 7.2 App (checklist manual)

Com hard refresh após deploy Cloudflare:

1. **Login** (PIN) — entra normalmente
2. **Home / eventos** — lista eventos
3. **Cuidado Pastoral** — lista solicitantes / pedidos
4. **Financeiro (manutenção)** — lista lançamentos do período
5. **Escalas** — tipos + voluntários + histórico
6. **Criar um registro** (ex.: pedido pastoral ou lançamento) — grava sem erro
7. **Logout / login** de novo — sessão ok

Se algum item falhar: anote a tela, a ação e a mensagem (toast/console/Network RPC).

## Passo 8 — Segunda igreja (quando precisar)

Playbook: `scripts/MULTI_TENANT_SEGUNDA_IGREJA.md`  
Script manual: `scripts/multi-tenant-08-onboard-igreja.sql`  
**App (recomendado):** menu **Instâncias (Igrejas)** (super_admin) → `/igrejas`

### Sessão multi-igreja (mesmo celular)

Execute no SQL Editor **antes** de usar o seletor no app:

1. `scripts/multi-tenant-09-active-tenant-header.sql` — header `x-tenant-id` + `list_session_igrejas` + `set_session_active_tenant`
2. `scripts/multi-tenant-10-onboard-igreja-rpc.sql` — `onboard_igreja_admin`
3. `scripts/multi-tenant-11-igreja-logo.sql` — coluna `igrejas.logo_url` + RPC com logo da instância
4. `scripts/multi-tenant-12-app-parameters-unique-per-tenant.sql` — índice único de `app_parameters` **por tenant** (obrigatório para Criar instância)
5. `scripts/multi-tenant-13-igreja-logo-storage.sql` — bucket `church-logos` + `set_igreja_logo_admin` + onboard com logo
6. `scripts/multi-tenant-14-igreja-social-links.sql` — `instagram_url` / `youtube_url` + menu Redes Sociais
7. `scripts/multi-tenant-15-onboard-bypass-tenant-guard.sql` — **obrigatório** para Criar instância (corrige diverge do tenant da sessão)
8. `scripts/multi-tenant-16-igreja-website-url.sql` — `website_url` (site oficial) + RPC de links atualizada
9. `scripts/multi-tenant-17-onboard-igreja-admin-unique.sql` — remove sobrecarga ambígua de `onboard_igreja_admin`

Fluxo no app:

- Login com o mesmo telefone do super_admin
- Se houver mais de uma igreja → `/selecionar-igreja`
- Menu **Configurações → Instâncias (Igrejas)** → criar código/nome/logo/links e alternar instância ativa
- Menu **Redes Sociais** (qualquer papel) → Instagram/YouTube da instância ativa

### Logo da instância (chrome)

- Login / marca d'água usam a marca **Conecta** (plataforma).
- O logo do topo (chrome) segue a igreja ativa: `igrejas.logo_url` (URL pública do bucket `church-logos`) ou fallback IBN (asset local) / nome da igreja.
- Na tela de instâncias: **Escolher logo** na criação ou **Definir/Trocar logo** na lista.


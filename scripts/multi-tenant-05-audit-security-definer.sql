-- =============================================================================
-- Multi-tenancy — Passo 5: auditoria de RPCs SECURITY DEFINER
-- =============================================================================
-- Pré-requisito: multi-tenant-01..04 aplicados e checks 1–3 ok.
--
-- Por que isso importa:
--   Funções SECURITY DEFINER rodam com privilégios do dono e, em geral,
--   IGNORAM as policies RLS do invocador. Sem filtro explícito por
--   current_session_tenant_id() / tenant_id, ainda podem cruzar igrejas.
--
-- Como usar (SQL Editor):
--   Execute cada bloco SEPARADAMENTE (o Editor costuma mostrar só o último SELECT).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- A) Inventário: todas as SECURITY DEFINER em public
-- ---------------------------------------------------------------------------
select
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as args,
  case p.provolatile
    when 'i' then 'IMMUTABLE'
    when 's' then 'STABLE'
    when 'v' then 'VOLATILE'
  end as volatility,
  obj_description(p.oid, 'pg_proc') as comment
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prosecdef = true
order by p.proname;

-- ---------------------------------------------------------------------------
-- B) Risco alto: corpo referencia tabela tenant-scoped SEM mencionar tenant
-- ---------------------------------------------------------------------------
-- Heurística (não prova bug): se o source cita tabela de dados e NÃO cita
-- tenant_id / current_session_tenant_id / session_tenant_matches, marcar.
with tenant_tables as (
  select unnest(array[
    'profiles', 'members', 'families', 'profile_vehicles',
    'profile_sessions', 'profile_app_access_events', 'profile_app_access_screen_visits',
    'profile_access_roles', 'profile_scale_leadership', 'ghost_mode_audit_log',
    'events', 'event_registrations', 'event_control', 'event_avisos',
    'event_favorite_locations', 'event_quorum_registry', 'checkins',
    'pastoral_requests', 'pastoral_reason_categories', 'pastoral_reason_subcategories',
    'financials', 'expense_reports', 'expense_items',
    'tipos_escala', 'voluntarios_escala', 'escalas_log',
    'pending_authorizations', 'authorizations',
    'recepcao_cadastro_familiar', 'recepcao_cadastro_familiar_lote',
    'maintenance_assembly_minutes', 'maintenance_support_themes',
    'maintenance_support_requests', 'maintenance_support_attachments',
    'maintenance_support_interactions', 'maintenance_support_communications',
    'ministerial_respostas', 'ministerial_resultados',
    'app_parameters', 'paletas', 'access_grants'
  ]) as table_name
),
defs as (
  select
    p.oid,
    p.proname,
    pg_get_function_identity_arguments(p.oid) as args,
    lower(pg_get_functiondef(p.oid)) as src
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prosecdef = true
),
hits as (
  select
    d.proname,
    d.args,
    t.table_name,
    (d.src like '%' || t.table_name || '%') as mentions_table
  from defs d
  cross join tenant_tables t
  where d.src like '%' || t.table_name || '%'
)
select
  d.proname as function_name,
  d.args,
  string_agg(distinct h.table_name, ', ' order by h.table_name) as tenant_tables_mentioned,
  case
    when d.src like '%current_session_tenant_id%'
      or d.src like '%session_tenant_matches%'
      or d.src like '%tenant_id%'
      or d.src like '%profile_primary_tenant_id%'
      or d.src like '%profile_belongs_to_tenant%'
    then false
    else true
  end as missing_tenant_filter,
  case
    when d.proname in (
      'current_session_tenant_id',
      'session_tenant_matches',
      'profile_primary_tenant_id',
      'profile_belongs_to_tenant',
      'resolve_default_tenant_id',
      'tg_set_tenant_id_from_session',
      '_mt_add_tenant_id',
      '_mt_apply_tenant_rls',
      'current_session_profile_id',
      'session_profile_family_id',
      'session_has_resource_access',
      'session_has_screen_access',
      'acl_enforcement_enabled',
      'profile_has_access',
      'resolve_profile_session_token',
      'issue_profile_session',
      'revoke_profile_session',
      'ping_profile_session'
    ) then 'infra_ok'
    when d.proname like 'verificar_login%'
      or d.proname like '%password_recovery%'
      or d.proname like '%find_profile%'
      or d.proname like 'preparar_perfil%'
    then 'auth_bootstrap'
    when d.src like '%insert into public.profiles%'
      or d.src like '%update public.profiles%'
      or d.src like '%from public.profiles%'
      or d.src like '%join public.profiles%'
    then 'profiles_data'
    else 'business_rpc'
  end as risk_bucket
from defs d
join hits h on h.proname = d.proname and h.args = d.args
group by d.proname, d.args, d.src
having
  case
    when d.src like '%current_session_tenant_id%'
      or d.src like '%session_tenant_matches%'
      or d.src like '%tenant_id%'
      or d.src like '%profile_primary_tenant_id%'
      or d.src like '%profile_belongs_to_tenant%'
    then false
    else true
  end = true
order by
  case
    when d.proname like '%financial%'
      or d.proname like '%pastoral%'
      or d.proname like '%expense%'
      or d.proname like '%escala%'
      or d.proname like '%authorization%'
      or d.proname like '%member%'
      or d.proname like '%event%'
    then 0
    else 1
  end,
  d.proname;

-- ---------------------------------------------------------------------------
-- C) Prioridade sugerida de correção (catálogo estático do app)
-- ---------------------------------------------------------------------------
-- Use como checklist operacional. Marque conforme for patchando.
select *
from (
  values
    (10, 'pastoral-maintenance-rpc.sql', 'listar/atualizar pedidos pastorais', 'Filtrar pastoral_requests por tenant_id da sessão'),
    (20, 'financials-maintenance-rpc.sql', 'CRUD financeiro manutenção', 'Filtrar financials por tenant_id'),
    (30, 'financials-import-rpc.sql', 'importação de lançamentos', 'Gravar/ler só do tenant da sessão'),
    (40, 'expense-reports-rpc.sql', 'relatórios de despesa', 'expense_reports/items por tenant'),
    (50, 'escalas-maintenance-rpc.sql', 'programação de escalas', 'tipos_escala / escalas_log por tenant'),
    (60, 'escalas-volunteers-rpc.sql', 'servos em disponibilidade', 'voluntarios_escala por tenant'),
    (70, 'escalas-apply-cycle-batch.sql', 'lote de escalas', 'não gerar para outro tenant'),
    (80, 'escalas-tipos-maintenance-rpc.sql', 'tipos de escala', 'tipos_escala por tenant'),
    (90, 'media-authorization-rpc.sql', 'autorização de mídia', 'pending/authorizations por tenant'),
    (100, 'members-accepted-functions.sql', 'membros aceitos / listagens', 'members + profiles por tenant'),
    (110, 'list-profiles-family-directory.sql', 'diretório familiar', 'profiles/members por tenant'),
    (120, 'events-maintenance-rls.sql / replicate-event', 'manutenção de eventos', 'events por tenant'),
    (130, 'event-control-orchestration.sql', 'orquestrador', 'event_control por tenant'),
    (140, 'event-avisos-schema.sql', 'avisos de evento', 'event_avisos por tenant'),
    (150, 'events-quorum-registry.sql', 'quórum', 'event_quorum_registry por tenant'),
    (160, 'checkins-totem-flow.sql / geo-checkin', 'check-ins', 'checkins por tenant'),
    (170, 'recepcao-cadastro-familiar.sql', 'recepção familiar', 'filas por tenant'),
    (180, 'maintenance-support-suggestions.sql', 'suporte/vigilância', 'maintenance_support_* por tenant'),
    (190, 'assembly-minutes.sql', 'atas', 'maintenance_assembly_minutes por tenant'),
    (200, 'salvar-app-parameter-admin.sql', 'parâmetros', 'app_parameters por tenant (Parm_entidade etc.)'),
    (210, 'access-control-admin-rpc.sql', 'ACL admin', 'access_grants / profile_access_roles por tenant'),
    (220, 'access-control-pastoral-role-change.sql', 'mudança de papéis', 'não alterar perfil de outro tenant'),
    (230, 'register-profile-atomic.sql / register-member', 'cadastro', 'criar vínculo profile_igreja_vinculos + tenant_id'),
    (240, 'complete-initial-profile-registration-rpc.sql', 'cadastro inicial', 'vínculo + tenant no profile'),
    (250, 'delete-profile-complete-rpc.sql', 'exclusão de perfil', 'só no tenant da sessão'),
    (260, 'profile-access-insights.sql', 'insights de acesso', 'eventos de acesso por tenant'),
    (270, 'ministerial-profile-questionnaire.sql', 'questionário', 'respostas/resultados por tenant'),
    (900, 'verificar-login.sql / profile-sessions', 'login/sessão', 'OK se só autentica; ao emitir sessão, profile já deve ter vínculo'),
    (910, 'password-recovery-*.sql', 'recuperação PIN', 'buscar profile só no tenant correto se multi-igreja no mesmo DB'),
    (920, 'get-app-parameter-value.sql', 'leitura de parâmetro', 'filtrar app_parameters.tenant_id')
) as t(priority, script_area, rpc_area, remediation)
order by priority;

-- ---------------------------------------------------------------------------
-- D) Padrão de correção (copiar ao patchar um RPC)
-- ---------------------------------------------------------------------------
-- 1) No início da função:
--      v_tenant uuid := public.current_session_tenant_id();
--      if v_tenant is null then
--        raise exception 'Sessão sem igreja (tenant) vinculada.';
--      end if;
--
-- 2) Em todo SELECT/UPDATE/DELETE de tabela de dados:
--      ... where tenant_id = v_tenant and ...
--
-- 3) Em INSERT explícito (além do trigger):
--      insert into ... (..., tenant_id) values (..., v_tenant);
--
-- 4) Ao criar profile novo:
--      insert into profile_igreja_vinculos (profile_id, tenant_id, is_primary)
--      values (novo_id, v_tenant, true);
--
-- 5) Reexecute o bloco B após cada patch — a função deve sumir da lista
--    missing_tenant_filter = true (ou passar a citar tenant_id no source).

-- ---------------------------------------------------------------------------
-- E) Smoke: tenant da sessão atual (com app logado / headers PostgREST)
-- ---------------------------------------------------------------------------
-- No SQL Editor puro isso costuma retornar null (sem headers).
-- Use um RPC de teste no app ou:
--   select public.current_session_tenant_id();
--   select public.profile_primary_tenant_id('<uuid-do-seu-profile>');
select
  public.resolve_default_tenant_id() as default_tenant_ibn,
  (select count(*) from public.profile_igreja_vinculos where is_active) as vinculos_ativos,
  (select count(*) from public.igrejas where is_active) as igrejas_ativas;

-- =============================================================================
-- Multi-tenancy 05-B — RPCs que tocam tabelas tenant SEM filtro de tenant
-- =============================================================================
-- Pré-requisito: multi-tenant-01..04 ok.
-- Heurística: source cita tabela de dados e NÃO cita tenant_id /
-- current_session_tenant_id / session_tenant_matches.
-- missing_tenant_filter = true → candidato a patch.
-- =============================================================================

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
    t.table_name
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

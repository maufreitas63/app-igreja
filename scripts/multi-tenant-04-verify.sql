-- =============================================================================
-- Multi-tenancy — verificação pós-deploy
-- =============================================================================
-- Execute no SQL Editor APÓS os passos 01–03.
-- Não altera dados; apenas reporta inconsistências.
-- =============================================================================

-- 1) Tabelas com tenant_id
select
  c.relname as table_name,
  exists (
    select 1
      from information_schema.columns col
     where col.table_schema = 'public'
       and col.table_name = c.relname
       and col.column_name = 'tenant_id'
  ) as has_tenant_id,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname in (
    'profiles', 'members', 'families', 'events', 'event_registrations',
    'pastoral_requests', 'financials', 'expense_reports', 'expense_items',
    'checkins', 'tipos_escala', 'voluntarios_escala', 'escalas_log',
    'authorizations', 'pending_authorizations', 'app_parameters',
    'profile_sessions', 'access_grants'
  )
order by 1;

-- 2) Linhas órfãs (tenant_id nulo) — deve retornar 0
select 'profiles' as tbl, count(*) as null_tenant
  from public.profiles where tenant_id is null
union all
select 'events', count(*) from public.events where tenant_id is null
union all
select 'members', count(*) from public.members where tenant_id is null
union all
select 'financials', count(*) from public.financials where tenant_id is null
union all
select 'pastoral_requests', count(*) from public.pastoral_requests where tenant_id is null;

-- 3) Profiles sem vínculo ativo
select count(*) as profiles_sem_vinculo
  from public.profiles p
 where not exists (
   select 1
     from public.profile_igreja_vinculos v
    where v.profile_id = p.id
      and v.is_active = true
 );

-- 4) Policies restrictive de tenant
select c.relname, p.polname, p.polcmd,
       case when p.polpermissive then 'PERMISSIVE' else 'RESTRICTIVE' end as kind
  from pg_policy p
  join pg_class c on c.oid = p.polrelid
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public'
   and p.polname like '%_tenant_%'
 order by c.relname, p.polname;

-- 5) Igreja seed
select id, code, name, is_active from public.igrejas order by code;

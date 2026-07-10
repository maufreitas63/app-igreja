-- =============================================================================
-- Multi-tenancy 05-A — Inventário de SECURITY DEFINER em public
-- =============================================================================
-- Pré-requisito: multi-tenant-01..04 ok.
-- =============================================================================

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

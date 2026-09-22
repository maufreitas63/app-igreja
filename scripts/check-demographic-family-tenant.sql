select
  (pg_get_functiondef(p.oid) like '%p.tenant_id = v_tenant%') as filters_tenant,
  (pg_get_functiondef(p.oid) like '%require_session_tenant_id%') as requires_tenant
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = '_report_demographic_family';

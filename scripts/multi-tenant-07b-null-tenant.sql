-- =============================================================================
-- Multi-tenancy 07-B — Sem tenant_id nulo (crítico)
-- Esperado: todos null_tenant = 0
-- =============================================================================

select 'profiles' as tbl, count(*) as null_tenant from public.profiles where tenant_id is null
union all select 'members', count(*) from public.members where tenant_id is null
union all select 'events', count(*) from public.events where tenant_id is null
union all select 'pastoral_requests', count(*) from public.pastoral_requests where tenant_id is null
union all select 'financials', count(*) from public.financials where tenant_id is null
union all select 'tipos_escala', count(*) from public.tipos_escala where tenant_id is null
union all select 'app_parameters', count(*) from public.app_parameters where tenant_id is null;

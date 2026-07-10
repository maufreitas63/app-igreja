-- =============================================================================
-- Multi-tenancy 07-C — Amostra: dados batem com IBN
-- Esperado: contagens IBN > 0 onde houver dados no banco
-- =============================================================================

select
  (select count(*) from public.profiles p
    where p.tenant_id = public.resolve_default_tenant_id()) as profiles_ibn,
  (select count(*) from public.events e
    where e.tenant_id = public.resolve_default_tenant_id()) as events_ibn,
  (select count(*) from public.pastoral_requests pr
    where pr.tenant_id = public.resolve_default_tenant_id()) as pastoral_ibn,
  (select count(*) from public.financials f
    where f.tenant_id = public.resolve_default_tenant_id()) as financials_ibn;

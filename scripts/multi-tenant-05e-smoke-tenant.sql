-- =============================================================================
-- Multi-tenancy 05-E — Smoke: tenant padrão e vínculos
-- =============================================================================
-- No SQL Editor puro, current_session_tenant_id() costuma ser null (sem headers).
-- Para testar sessão: select public.profile_primary_tenant_id('<uuid-do-profile>');
-- =============================================================================

select
  public.resolve_default_tenant_id() as default_tenant_ibn,
  (select count(*) from public.profile_igreja_vinculos where is_active) as vinculos_ativos,
  (select count(*) from public.igrejas where is_active) as igrejas_ativas;

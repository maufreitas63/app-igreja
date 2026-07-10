-- =============================================================================
-- Multi-tenancy 07-A — Tenant padrão e vínculos
-- Esperado: igrejas_ativas >= 1, vinculos_ativos > 0, profiles_sem_vinculo = 0
-- =============================================================================

select
  public.resolve_default_tenant_id() as default_tenant_ibn,
  (select count(*) from public.igrejas where is_active) as igrejas_ativas,
  (select count(*) from public.profile_igreja_vinculos where is_active) as vinculos_ativos,
  (
    select count(*)
    from public.profiles p
    where not exists (
      select 1
      from public.profile_igreja_vinculos v
      where v.profile_id = p.id
        and v.is_active = true
    )
  ) as profiles_sem_vinculo;

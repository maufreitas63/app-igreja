-- =============================================================================
-- Multi-tenancy — Passo 7: smoke SQL (pós ondas 0–4)
-- =============================================================================
-- Execute CADA bloco SEPARADAMENTE no SQL Editor.
-- Esperado: IBN ativa, vínculos > 0, sem tenant_id nulo nas tabelas críticas.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 7A) Tenant padrão e vínculos
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 7B) Sem tenant_id nulo (crítico)
-- ---------------------------------------------------------------------------
select 'profiles' as tbl, count(*) as null_tenant from public.profiles where tenant_id is null
union all select 'members', count(*) from public.members where tenant_id is null
union all select 'events', count(*) from public.events where tenant_id is null
union all select 'pastoral_requests', count(*) from public.pastoral_requests where tenant_id is null
union all select 'financials', count(*) from public.financials where tenant_id is null
union all select 'tipos_escala', count(*) from public.tipos_escala where tenant_id is null
union all select 'app_parameters', count(*) from public.app_parameters where tenant_id is null;

-- ---------------------------------------------------------------------------
-- 7C) Amostra: dados batem com IBN
-- ---------------------------------------------------------------------------
select
  (select count(*) from public.profiles p
    where p.tenant_id = public.resolve_default_tenant_id()) as profiles_ibn,
  (select count(*) from public.events e
    where e.tenant_id = public.resolve_default_tenant_id()) as events_ibn,
  (select count(*) from public.pastoral_requests pr
    where pr.tenant_id = public.resolve_default_tenant_id()) as pastoral_ibn,
  (select count(*) from public.financials f
    where f.tenant_id = public.resolve_default_tenant_id()) as financials_ibn;

-- ---------------------------------------------------------------------------
-- 7D) Helper de sessão (no SQL Editor costuma ser null — ok)
-- ---------------------------------------------------------------------------
select
  public.current_session_tenant_id() as session_tenant_no_headers,
  public.resolve_default_tenant_id() as default_tenant;

-- Para validar um profile específico (substitua o UUID):
-- select public.profile_primary_tenant_id('SEU-PROFILE-UUID'::uuid);

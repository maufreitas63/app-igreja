-- =============================================================================
-- Multi-tenancy 07-D — Helper de sessão (opcional)
-- No SQL Editor, session_tenant costuma ser null (sem headers) — ok.
-- =============================================================================

select
  public.current_session_tenant_id() as session_tenant_no_headers,
  public.resolve_default_tenant_id() as default_tenant;

-- Para validar um profile específico (substitua o UUID):
-- select public.profile_primary_tenant_id('SEU-PROFILE-UUID'::uuid);

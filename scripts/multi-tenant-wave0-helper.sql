-- =============================================================================
-- Multi-tenancy — helper comum para ondas de patch em SECURITY DEFINER
-- =============================================================================
-- Execute ANTES das ondas 1–3.
-- =============================================================================

create or replace function public.require_session_tenant_id()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
begin
  v_tenant := public.current_session_tenant_id();

  if v_tenant is null then
    raise exception 'Sessão sem igreja (tenant) vinculada.';
  end if;

  return v_tenant;
end;
$$;

grant execute on function public.require_session_tenant_id() to anon, authenticated;

comment on function public.require_session_tenant_id() is
  'Retorna current_session_tenant_id() ou raise. Usar no início de RPCs SECURITY DEFINER.';

notify pgrst, 'reload schema';

-- =============================================================================
-- Multi-tenancy 28 — código de instância no login (pré-sessão)
-- =============================================================================
-- 1) lookup_igreja_by_code: valida código público (IBN, IBEP, …) sem login.
-- 2) current_session_tenant_id: sem perfil, aceita x-tenant-id de igreja ativa
--    para o primeiro acesso cair na instância escolhida (não só no default IBN).
-- Com sessão, o fail-closed do script 27 permanece.
-- =============================================================================

begin;

create or replace function public.lookup_igreja_by_code(p_code text)
returns table (
  id uuid,
  code text,
  name text,
  logo_url text
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_code text := upper(trim(coalesce(p_code, '')));
begin
  if v_code = '' then
    return;
  end if;

  return query
  select
    i.id,
    i.code,
    i.name,
    nullif(trim(i.logo_url), '') as logo_url
  from public.igrejas i
  where i.is_active = true
    and upper(trim(i.code)) = v_code
  limit 1;
end;
$$;

comment on function public.lookup_igreja_by_code(text) is
  'Lookup público de igreja ativa pelo código de instância (tela de login).';

grant execute on function public.lookup_igreja_by_code(text) to anon, authenticated;

create or replace function public.current_session_tenant_id()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_header_tenant uuid;
  v_tenant_id uuid;
  v_auth_uid uuid;
begin
  v_profile_id := public.current_session_profile_id();
  v_header_tenant := public.request_header_tenant_id();

  -- Pré-login: x-tenant-id de igreja ativa (código validado na tela de login).
  if v_profile_id is null and v_header_tenant is not null then
    if exists (
      select 1
        from public.igrejas i
       where i.id = v_header_tenant
         and i.is_active = true
    ) then
      return v_header_tenant;
    end if;
    return null;
  end if;

  -- Header explícito: aceita só se autorizado; senão fail-closed (não cai na IBN).
  if v_profile_id is not null and v_header_tenant is not null then
    if public.profile_can_use_tenant(v_profile_id, v_header_tenant) then
      return v_header_tenant;
    end if;
    return null;
  end if;

  if v_profile_id is not null then
    v_tenant_id := public.profile_primary_tenant_id(v_profile_id);
    if v_tenant_id is not null then
      return v_tenant_id;
    end if;
  end if;

  begin
    v_auth_uid := auth.uid();
  exception
    when others then
      v_auth_uid := null;
  end;

  if v_auth_uid is not null then
    select public.profile_primary_tenant_id(p.id)
      into v_tenant_id
      from public.profiles p
     where p.auth_user_id = v_auth_uid
     limit 1;
    if v_tenant_id is not null then
      return v_tenant_id;
    end if;
  end if;

  return null;
end;
$$;

grant execute on function public.current_session_tenant_id() to anon, authenticated;

notify pgrst, 'reload schema';

commit;

-- =============================================================================
-- Multi-tenancy 09 — tenant ativo via header x-tenant-id
-- =============================================================================
-- Pré-requisito: multi-tenant-01 + wave0 (require_session_tenant_id).
-- App envia x-tenant-id (lib/supabaseSessionFetch.ts) após seleção de igreja.
-- Super_admin pode ativar qualquer igreja ativa; demais só vínculos.
-- =============================================================================

create or replace function public.request_header_tenant_id()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_headers text;
  v_raw text;
begin
  begin
    v_headers := current_setting('request.headers', true);
  exception
    when others then
      return null;
  end;

  if v_headers is null or v_headers = '' then
    return null;
  end if;

  v_raw := nullif(trim(coalesce((v_headers::json ->> 'x-tenant-id'), '')), '');
  if v_raw is null then
    return null;
  end if;

  begin
    return v_raw::uuid;
  exception
    when invalid_text_representation then
      return null;
  end;
end;
$$;

create or replace function public.profile_can_use_tenant(
  p_profile_id uuid,
  p_tenant_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_profile_id is not null
    and p_tenant_id is not null
    and exists (
      select 1 from public.igrejas i
      where i.id = p_tenant_id and i.is_active = true
    )
    and (
      public.profile_has_super_admin_role(p_profile_id)
      or public.profile_belongs_to_tenant(p_profile_id, p_tenant_id)
    );
$$;

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

  if v_profile_id is not null and v_header_tenant is not null then
    if public.profile_can_use_tenant(v_profile_id, v_header_tenant) then
      return v_header_tenant;
    end if;
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

-- Lista igrejas disponíveis para a sessão (vínculos; super_admin vê todas)
drop function if exists public.list_session_igrejas();

create or replace function public.list_session_igrejas()
returns table (
  id uuid,
  code text,
  name text,
  is_primary boolean,
  is_linked boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := public.current_session_profile_id();
  v_is_super boolean := false;
begin
  if v_profile_id is null then
    return;
  end if;

  v_is_super := public.profile_has_super_admin_role(v_profile_id);

  if v_is_super then
    return query
    select
      i.id,
      i.code,
      i.name,
      coalesce(v.is_primary, false) as is_primary,
      (v.id is not null) as is_linked
    from public.igrejas i
    left join public.profile_igreja_vinculos v
      on v.tenant_id = i.id
     and v.profile_id = v_profile_id
     and v.is_active = true
    where i.is_active = true
    order by coalesce(v.is_primary, false) desc, i.name asc;
    return;
  end if;

  return query
  select
    i.id,
    i.code,
    i.name,
    v.is_primary,
    true as is_linked
  from public.profile_igreja_vinculos v
  join public.igrejas i on i.id = v.tenant_id
  where v.profile_id = v_profile_id
    and v.is_active = true
    and i.is_active = true
  order by v.is_primary desc, i.name asc;
end;
$$;

-- Define primary + alinha profiles.tenant_id (após escolha na UI)
create or replace function public.set_session_active_tenant(p_tenant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := public.current_session_profile_id();
begin
  if v_profile_id is null then
    return jsonb_build_object('success', false, 'message', 'Sessão inválida.');
  end if;

  if p_tenant_id is null then
    return jsonb_build_object('success', false, 'message', 'Igreja não informada.');
  end if;

  if not public.profile_can_use_tenant(v_profile_id, p_tenant_id) then
    return jsonb_build_object('success', false, 'message', 'Sem acesso a esta igreja.');
  end if;

  -- Garante vínculo ativo (super_admin pode não ter vínculo prévio)
  insert into public.profile_igreja_vinculos (profile_id, tenant_id, is_primary, is_active)
  values (v_profile_id, p_tenant_id, true, true)
  on conflict (profile_id, tenant_id) do update
    set is_active = true,
        updated_at = now();

  update public.profile_igreja_vinculos
     set is_primary = false,
         updated_at = now()
   where profile_id = v_profile_id
     and tenant_id is distinct from p_tenant_id
     and is_primary = true
     and is_active = true;

  update public.profile_igreja_vinculos
     set is_primary = true,
         updated_at = now()
   where profile_id = v_profile_id
     and tenant_id = p_tenant_id
     and is_active = true;

  update public.profiles
     set tenant_id = p_tenant_id
   where id = v_profile_id;

  return jsonb_build_object(
    'success', true,
    'tenant_id', p_tenant_id,
    'message', 'Igreja ativa atualizada.'
  );
end;
$$;

grant execute on function public.request_header_tenant_id() to anon, authenticated;
grant execute on function public.profile_can_use_tenant(uuid, uuid) to anon, authenticated;
grant execute on function public.current_session_tenant_id() to anon, authenticated;
grant execute on function public.list_session_igrejas() to anon, authenticated;
grant execute on function public.set_session_active_tenant(uuid) to anon, authenticated;

notify pgrst, 'reload schema';

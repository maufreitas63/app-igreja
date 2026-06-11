-- Passo 9e: RPCs de administração de papéis e grants (somente super_admin).
-- Execute no SQL Editor do Supabase após access-control-schema.sql.

create or replace function public.is_super_admin_profile(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.profile_access_roles par
      join public.access_roles ar on ar.id = par.role_id
     where par.profile_id = p_profile_id
       and ar.code = 'super_admin'
  );
$$;

create or replace function public.assert_access_admin(p_actor_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_actor_profile_id is null then
    raise exception 'Sessão inválida. Saia e entre novamente no aplicativo.';
  end if;

  if not public.is_super_admin_profile(p_actor_profile_id) then
    raise exception 'Apenas super administradores podem gerenciar permissões.';
  end if;
end;
$$;

-- access_role_display_order: script canônico em access-control-role-display-order.sql

drop function if exists public.listar_access_roles_admin(uuid);

create or replace function public.listar_access_roles_admin(p_actor_profile_id uuid)
returns table (
  id uuid,
  code text,
  name text,
  description text,
  is_system boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_access_admin(p_actor_profile_id);

  return query
  select
    ar.id,
    ar.code,
    ar.name,
    ar.description,
    ar.is_system
  from public.access_roles ar
  order by public.access_role_display_order(ar.code), ar.name asc;
end;
$$;

drop function if exists public.buscar_perfis_access_admin(uuid, text, integer);

create or replace function public.buscar_perfis_access_admin(
  p_actor_profile_id uuid,
  p_query text,
  p_limit integer default 20
)
returns table (
  id uuid,
  full_name text,
  phone text,
  codigo_membro text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_query text;
  v_digits text;
  v_limit integer;
begin
  perform public.assert_access_admin(p_actor_profile_id);

  v_query := trim(coalesce(p_query, ''));
  v_digits := regexp_replace(v_query, '\D', '', 'g');
  v_limit := greatest(1, least(coalesce(p_limit, 20), 50));

  if char_length(v_query) < 2 then
    return;
  end if;

  return query
  select
    p.id,
    coalesce(p.full_name, '') as full_name,
    coalesce(p.phone, '') as phone,
    coalesce(p.codigo_membro, '') as codigo_membro
  from public.profiles p
  where coalesce(p.full_name, '') <> ''
    and (
      p.full_name ilike '%' || v_query || '%'
      or (
        v_digits <> ''
        and regexp_replace(coalesce(p.phone, ''), '\D', '', 'g') like '%' || v_digits || '%'
      )
      or coalesce(p.codigo_membro, '') ilike '%' || v_query || '%'
    )
  order by p.full_name asc
  limit v_limit;
end;
$$;

drop function if exists public.listar_papeis_perfil_access_admin(uuid, uuid);

create or replace function public.listar_papeis_perfil_access_admin(
  p_actor_profile_id uuid,
  p_target_profile_id uuid
)
returns table (
  role_id uuid,
  role_code text,
  role_name text,
  assigned boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_access_admin(p_actor_profile_id);

  if p_target_profile_id is null then
    raise exception 'Perfil não informado.';
  end if;

  if not exists (select 1 from public.profiles p where p.id = p_target_profile_id) then
    raise exception 'Perfil não encontrado.';
  end if;

  return query
  select
    ar.id as role_id,
    ar.code as role_code,
    ar.name as role_name,
    exists (
      select 1
        from public.profile_access_roles par
       where par.profile_id = p_target_profile_id
         and par.role_id = ar.id
    ) as assigned
  from public.access_roles ar
  where ar.code <> 'visitantes'
  order by public.access_role_display_order(ar.code), ar.name asc;
end;
$$;

drop function if exists public.atribuir_papel_perfil_access_admin(uuid, uuid, text);

create or replace function public.atribuir_papel_perfil_access_admin(
  p_actor_profile_id uuid,
  p_target_profile_id uuid,
  p_role_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role_code text;
  v_role_id uuid;
begin
  perform public.assert_access_admin(p_actor_profile_id);

  v_role_code := lower(trim(coalesce(p_role_code, '')));

  if p_target_profile_id is null then
    return jsonb_build_object('success', false, 'message', 'Perfil não informado.');
  end if;

  if v_role_code = '' then
    return jsonb_build_object('success', false, 'message', 'Papel não informado.');
  end if;

  if v_role_code = 'visitantes' then
    return jsonb_build_object(
      'success',
      false,
      'message',
      'O papel visitante é automático: perfis sem papéis já recebem esse acesso.'
    );
  end if;

  select ar.id
    into v_role_id
    from public.access_roles ar
   where ar.code = v_role_code;

  if v_role_id is null then
    return jsonb_build_object('success', false, 'message', 'Papel não encontrado.');
  end if;

  insert into public.profile_access_roles (profile_id, role_id, granted_by_profile_id)
  values (p_target_profile_id, v_role_id, p_actor_profile_id)
  on conflict (profile_id, role_id) do nothing;

  return jsonb_build_object('success', true, 'message', 'Papel atribuído.');
end;
$$;

drop function if exists public.revogar_papel_perfil_access_admin(uuid, uuid, text);

create or replace function public.revogar_papel_perfil_access_admin(
  p_actor_profile_id uuid,
  p_target_profile_id uuid,
  p_role_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role_code text;
  v_role_id uuid;
  v_remaining_super_admins integer;
begin
  perform public.assert_access_admin(p_actor_profile_id);

  v_role_code := lower(trim(coalesce(p_role_code, '')));

  if p_target_profile_id is null then
    return jsonb_build_object('success', false, 'message', 'Perfil não informado.');
  end if;

  if v_role_code = '' then
    return jsonb_build_object('success', false, 'message', 'Papel não informado.');
  end if;

  select ar.id
    into v_role_id
    from public.access_roles ar
   where ar.code = v_role_code;

  if v_role_id is null then
    return jsonb_build_object('success', false, 'message', 'Papel não encontrado.');
  end if;

  if v_role_code = 'super_admin' then
    select count(*)::integer
      into v_remaining_super_admins
      from public.profile_access_roles par
      join public.access_roles ar on ar.id = par.role_id
     where ar.code = 'super_admin'
       and par.profile_id <> p_target_profile_id;

    if coalesce(v_remaining_super_admins, 0) = 0 then
      return jsonb_build_object(
        'success', false,
        'message', 'Não é possível remover o último super administrador.'
      );
    end if;
  end if;

  delete from public.profile_access_roles par
   where par.profile_id = p_target_profile_id
     and par.role_id = v_role_id;

  return jsonb_build_object('success', true, 'message', 'Papel removido.');
end;
$$;

drop function if exists public.listar_grants_recurso_papel_admin(uuid, text, text);

create or replace function public.listar_grants_recurso_papel_admin(
  p_actor_profile_id uuid,
  p_role_code text,
  p_resource_type text
)
returns table (
  resource_id uuid,
  resource_type text,
  resource_key text,
  label text,
  can_view boolean,
  can_update boolean,
  grant_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role_code text;
  v_role_id uuid;
  v_resource_type text;
begin
  perform public.assert_access_admin(p_actor_profile_id);

  v_role_code := lower(trim(coalesce(p_role_code, '')));
  v_resource_type := lower(trim(coalesce(p_resource_type, '')));

  if v_role_code = '' then
    raise exception 'Papel não informado.';
  end if;

  if v_resource_type not in ('screen', 'table', 'column') then
    raise exception 'Tipo de recurso inválido.';
  end if;

  select ar.id
    into v_role_id
    from public.access_roles ar
   where ar.code = v_role_code;

  if v_role_id is null then
    raise exception 'Papel não encontrado.';
  end if;

  return query
  select
    res.id as resource_id,
    res.resource_type,
    res.resource_key,
    res.label,
    coalesce(g.can_view, false) as can_view,
    coalesce(g.can_update, false) as can_update,
    g.id as grant_id
  from public.access_resources res
  left join public.access_grants g
    on g.resource_id = res.id
   and g.role_id = v_role_id
 where res.resource_type = v_resource_type
   and res.is_active = true
   and not (
     res.resource_type = 'screen'
     and res.resource_key like 'scale_type.tstmax%'
   )
 order by
   case when res.resource_key = 'maintenance.card.access_control' then 1 else 0 end,
   res.resource_key asc;
end;
$$;

drop function if exists public.garantir_recurso_controle_acesso_admin(uuid);

create or replace function public.garantir_recurso_controle_acesso_admin(p_actor_profile_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_access_admin(p_actor_profile_id);

  insert into public.access_resources (resource_type, resource_key, label, description, is_active)
  values
    (
      'screen',
      'maintenance.card.access_control',
      'Controle de Acesso',
      'Card de manutenção para gerenciar papéis e permissões (super_admin)',
      true
    )
  on conflict (resource_type, resource_key) do update
    set label = excluded.label,
        description = excluded.description,
        is_active = true;

  insert into public.access_grants (role_id, resource_id, can_view, can_update)
  select r.id, res.id, true, true
    from public.access_roles r
    join public.access_resources res
      on res.resource_type = 'screen'
     and res.resource_key = 'maintenance.card.access_control'
   where r.code = 'super_admin'
  on conflict (role_id, resource_id) where (role_id is not null) do update
    set can_view = excluded.can_view,
        can_update = excluded.can_update,
        updated_at = now();

  return jsonb_build_object('success', true, 'message', 'Recurso Controle de Acesso sincronizado.');
end;
$$;

drop function if exists public.salvar_grant_papel_admin(uuid, text, text, text, boolean, boolean);

create or replace function public.salvar_grant_papel_admin(
  p_actor_profile_id uuid,
  p_role_code text,
  p_resource_type text,
  p_resource_key text,
  p_can_view boolean,
  p_can_update boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role_code text;
  v_role_id uuid;
  v_resource_type text;
  v_resource_key text;
  v_resource_id uuid;
  v_can_view boolean;
  v_can_update boolean;
begin
  perform public.assert_access_admin(p_actor_profile_id);

  v_role_code := lower(trim(coalesce(p_role_code, '')));
  v_resource_type := lower(trim(coalesce(p_resource_type, '')));
  v_resource_key := trim(coalesce(p_resource_key, ''));
  v_can_view := coalesce(p_can_view, false);
  v_can_update := coalesce(p_can_update, false);

  if v_role_code = '' then
    return jsonb_build_object('success', false, 'message', 'Papel não informado.');
  end if;

  if v_resource_type not in ('screen', 'table', 'column') or v_resource_key = '' then
    return jsonb_build_object('success', false, 'message', 'Recurso inválido.');
  end if;

  if not v_can_view and not v_can_update then
    delete from public.access_grants g
     using public.access_roles ar, public.access_resources res
     where g.role_id = ar.id
       and g.resource_id = res.id
       and ar.code = v_role_code
       and res.resource_type = v_resource_type
       and res.resource_key = v_resource_key;

    return jsonb_build_object('success', true, 'message', 'Permissão removida.');
  end if;

  select ar.id
    into v_role_id
    from public.access_roles ar
   where ar.code = v_role_code;

  if v_role_id is null then
    return jsonb_build_object('success', false, 'message', 'Papel não encontrado.');
  end if;

  select res.id
    into v_resource_id
    from public.access_resources res
   where res.resource_type = v_resource_type
     and res.resource_key = v_resource_key
     and res.is_active = true;

  if v_resource_id is null then
    return jsonb_build_object('success', false, 'message', 'Recurso não encontrado.');
  end if;

  insert into public.access_grants (role_id, resource_id, can_view, can_update)
  values (v_role_id, v_resource_id, v_can_view, v_can_update)
  on conflict (role_id, resource_id) where (role_id is not null) do update
    set can_view = excluded.can_view,
        can_update = excluded.can_update,
        updated_at = now();

  return jsonb_build_object('success', true, 'message', 'Permissão salva.');
end;
$$;

-- Papéis que podem faltar em ambientes com schema antigo (aparecem na aba Papéis da UI)
insert into public.access_roles (code, name, description, is_system)
values
  (
    'congregado',
    'Congregado',
    'Participante cadastrado com acesso básico; sem gerência familiar',
    true
  ),
  (
    'visitantes',
    'Visitantes',
    'Acesso público mínimo sem perfil/papéis na sessão',
    true
  )
on conflict (code) do update
  set name = excluded.name,
      description = excluded.description,
      is_system = excluded.is_system;

-- Card access_control no carrossel de manutenção (etiqueta → maintenance.card.access_control)
insert into public.access_resources (resource_type, resource_key, label, description, is_active)
values
  (
    'screen',
    'maintenance.card.access_control',
    'Controle de Acesso',
    'Card de manutenção para gerenciar papéis e permissões (super_admin)',
    true
  )
on conflict (resource_type, resource_key) do update
  set label = excluded.label,
      description = excluded.description,
      is_active = true;

insert into public.access_grants (role_id, resource_id, can_view, can_update)
select r.id, res.id, true, true
  from public.access_roles r
  join public.access_resources res
    on res.resource_type = 'screen'
   and res.resource_key = 'maintenance.card.access_control'
 where r.code = 'super_admin'
on conflict (role_id, resource_id) where (role_id is not null) do update
  set can_view = excluded.can_view,
      can_update = excluded.can_update,
      updated_at = now();

grant execute on function public.is_super_admin_profile(uuid) to anon, authenticated;
grant execute on function public.listar_access_roles_admin(uuid) to anon, authenticated;
grant execute on function public.buscar_perfis_access_admin(uuid, text, integer) to anon, authenticated;
grant execute on function public.listar_papeis_perfil_access_admin(uuid, uuid) to anon, authenticated;
grant execute on function public.atribuir_papel_perfil_access_admin(uuid, uuid, text) to anon, authenticated;
grant execute on function public.revogar_papel_perfil_access_admin(uuid, uuid, text) to anon, authenticated;
grant execute on function public.listar_grants_recurso_papel_admin(uuid, text, text) to anon, authenticated;
grant execute on function public.garantir_recurso_controle_acesso_admin(uuid) to anon, authenticated;
grant execute on function public.salvar_grant_papel_admin(uuid, text, text, text, boolean, boolean) to anon, authenticated;

-- Card Minha Célula (dashboard.card.small_group) por instância.
-- O grant global é único por papel. Desmarcar o card na IBN apagava a linha
-- e escondia Minha Célula nas outras igrejas. A exceção fica em
-- access_grant_tenant_scope; as demais permissões continuam globais.

create table if not exists public.access_grant_tenant_scope (
  tenant_id uuid not null references public.igrejas (id) on delete cascade,
  role_id uuid not null references public.access_roles (id) on delete cascade,
  resource_id uuid not null references public.access_resources (id) on delete cascade,
  can_view boolean not null default false,
  can_update boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, role_id, resource_id)
);

comment on table public.access_grant_tenant_scope is
  'Exceção por igreja do card dashboard.card.small_group. Sem linha, vale o grant global.';

alter table public.access_grant_tenant_scope enable row level security;

create or replace function public.small_group_card_tenant_for_profile(p_profile_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  v_tenant uuid;
begin
  if p_profile_id is not null and p_profile_id = public.current_session_profile_id() then
    v_tenant := public.current_session_tenant_id();
  end if;

  if v_tenant is null and p_profile_id is not null then
    select p.tenant_id
      into v_tenant
      from public.profiles p
     where p.id = p_profile_id;
  end if;

  if v_tenant is null then
    v_tenant := public.current_session_tenant_id();
  end if;

  return v_tenant;
end;
$$;

create or replace function public.small_group_card_role_allowed(
  p_role_id uuid,
  p_tenant_id uuid,
  p_action text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  v_action text := lower(trim(coalesce(p_action, '')));
  v_can_view boolean;
  v_can_update boolean;
begin
  if p_role_id is null or p_tenant_id is null then
    return false;
  end if;

  if v_action not in ('view', 'update') then
    return false;
  end if;

  select s.can_view, s.can_update
    into v_can_view, v_can_update
    from public.access_grant_tenant_scope s
    join public.access_resources r on r.id = s.resource_id
   where s.tenant_id = p_tenant_id
     and s.role_id = p_role_id
     and r.resource_type = 'screen'
     and r.resource_key = 'dashboard.card.small_group'
     and r.is_active = true;

  if found then
    return (v_action = 'view' and v_can_view)
        or (v_action = 'update' and v_can_update);
  end if;

  select g.can_view, g.can_update
    into v_can_view, v_can_update
    from public.access_grants g
    join public.access_resources r on r.id = g.resource_id
   where g.role_id = p_role_id
     and r.resource_type = 'screen'
     and r.resource_key = 'dashboard.card.small_group'
     and r.is_active = true;

  if not found then
    return false;
  end if;

  return (v_action = 'view' and v_can_view)
      or (v_action = 'update' and v_can_update);
end;
$$;

create or replace function public.small_group_card_profile_allowed(
  p_profile_id uuid,
  p_action text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  v_tenant uuid;
begin
  if p_profile_id is null then
    return false;
  end if;

  v_tenant := public.small_group_card_tenant_for_profile(p_profile_id);

  if v_tenant is null then
    return false;
  end if;

  return exists (
    select 1
      from public.profile_access_roles par
     where par.profile_id = p_profile_id
       and public.small_group_card_role_allowed(par.role_id, v_tenant, p_action)
  );
end;
$$;

create or replace function public.profile_has_access(
  p_profile_id uuid,
  p_resource_type text,
  p_resource_key text,
  p_action text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  v_type text;
  v_key text;
  v_action text;
  v_acl_enabled boolean;
  v_allowed boolean;
  v_has_roles boolean;
  v_session uuid;
  v_real uuid;
  v_ghost_header uuid;
begin
  v_type := lower(trim(coalesce(p_resource_type, '')));
  v_key := trim(coalesce(p_resource_key, ''));
  v_action := lower(trim(coalesce(p_action, '')));

  if v_type not in ('screen', 'table', 'column') or v_key = '' then
    return false;
  end if;

  if v_action not in ('view', 'update') then
    return false;
  end if;

  v_session := public.current_session_profile_id();
  v_real := public.current_real_session_profile_id();
  v_ghost_header := public.current_ghost_profile_id_from_header();

  -- Super admin da sessão efetiva (alvo no Ghost, se a troca funcionou).
  if v_session is not null and public.is_super_admin_profile(v_session) then
    return true;
  end if;

  -- Operador autorizado em Ghost consultando o perfil do header:
  -- usar avaliação pura de grants do alvo (sem herdar SA do operador).
  if v_ghost_header is not null
     and p_profile_id is not null
     and p_profile_id = v_ghost_header
     and v_real is not null
     and public.can_operate_ghost_mode(v_real) then
    return public.evaluate_profile_resource_access(
      p_profile_id,
      v_type,
      v_key,
      v_action
    );
  end if;

  if p_profile_id is not null
     and v_session is not null
     and p_profile_id <> v_session
     and not public.is_super_admin_profile(v_session) then
    return false;
  end if;

  select exists (select 1 from public.access_grants limit 1)
    into v_acl_enabled;

  if not v_acl_enabled then
    return false;
  end if;

  if p_profile_id is null then
    return public.role_has_access('visitantes', v_type, v_key, v_action);
  end if;

  if v_key = 'dashboard.card.small_group' then
    return public.small_group_card_profile_allowed(p_profile_id, v_action);
  end if;

  select exists (
    select 1
      from public.access_grants g
      join public.access_resources r on r.id = g.resource_id
     where r.resource_type = v_type
       and r.is_active = true
       and public.access_resource_matches(r.resource_key, v_key)
       and (
         (v_action = 'view' and g.can_view)
         or (v_action = 'update' and g.can_update)
       )
       and (
         g.profile_id = p_profile_id
         or g.role_id in (
           select par.role_id
             from public.profile_access_roles par
            where par.profile_id = p_profile_id
         )
       )
  )
    into v_allowed;

  if coalesce(v_allowed, false) then
    return true;
  end if;

  select exists (
    select 1
      from public.profile_access_roles par
     where par.profile_id = p_profile_id
  )
    into v_has_roles;

  if not coalesce(v_has_roles, false) then
    return public.role_has_access('visitantes', v_type, v_key, v_action);
  end if;

  return false;
end;
$$;

create or replace function public.evaluate_profile_resource_access(
  p_profile_id uuid,
  p_resource_type text,
  p_resource_key text,
  p_action text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_type text;
  v_key text;
  v_action text;
  v_acl_enabled boolean;
  v_allowed boolean;
  v_has_roles boolean;
begin
  if p_profile_id is null then
    return false;
  end if;

  v_type := lower(trim(coalesce(p_resource_type, '')));
  v_key := trim(coalesce(p_resource_key, ''));
  v_action := lower(trim(coalesce(p_action, '')));

  if v_type not in ('screen', 'table', 'column') or v_key = '' then
    return false;
  end if;

  if v_action not in ('view', 'update') then
    return false;
  end if;

  if not public.acl_enforcement_enabled() then
    return true;
  end if;

  if public.profile_has_super_admin_role(p_profile_id) then
    return true;
  end if;

  if v_key = 'dashboard.card.small_group' then
    return public.small_group_card_profile_allowed(p_profile_id, v_action);
  end if;

  select exists (select 1 from public.access_grants limit 1)
    into v_acl_enabled;

  if not v_acl_enabled then
    return false;
  end if;

  select exists (
    select 1
      from public.access_grants g
      join public.access_resources r on r.id = g.resource_id
     where r.resource_type = v_type
       and r.is_active = true
       and public.access_resource_matches(r.resource_key, v_key)
       and (
         (v_action = 'view' and g.can_view)
         or (v_action = 'update' and g.can_update)
       )
       and (
         g.profile_id = p_profile_id
         or g.role_id in (
           select par.role_id
             from public.profile_access_roles par
            where par.profile_id = p_profile_id
         )
       )
  )
    into v_allowed;

  if coalesce(v_allowed, false) then
    return true;
  end if;

  select exists (
    select 1
      from public.profile_access_roles par
     where par.profile_id = p_profile_id
  )
    into v_has_roles;

  if not coalesce(v_has_roles, false) then
    return public.role_has_access('visitantes', v_type, v_key, v_action);
  end if;

  return false;
end;
$$;

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
  v_tenant uuid := public.current_session_tenant_id();
begin
  perform public.assert_access_admin(p_actor_profile_id);

  v_role_code := lower(trim(coalesce(p_role_code, '')));
  v_resource_type := lower(trim(coalesce(p_resource_type, '')));

  -- Proteção aplicada: Gestor não tem visibilidade do Super Administrador
  perform public.assert_gestor_super_admin_shield(
    p_actor_profile_id,
    null,
    v_role_code,
    'list_role_grants'
  );

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
    case
      when res.resource_key = 'dashboard.card.small_group' and s.tenant_id is not null
        then s.can_view
      else coalesce(g.can_view, false)
    end as can_view,
    case
      when res.resource_key = 'dashboard.card.small_group' and s.tenant_id is not null
        then s.can_update
      else coalesce(g.can_update, false)
    end as can_update,
    g.id as grant_id
  from public.access_resources res
  left join public.access_grants g
    on g.resource_id = res.id
   and g.role_id = v_role_id
  left join public.access_grant_tenant_scope s
    on s.resource_id = res.id
   and s.role_id = v_role_id
   and s.tenant_id = v_tenant
   and res.resource_key = 'dashboard.card.small_group'
 where res.resource_type = v_resource_type
   and res.is_active = true
   and not (
     res.resource_type = 'screen'
     and res.resource_key like 'scale_type.tstmax%'
   )
   -- Gestor: sem recursos de PIN/senha na matriz
   and (
     public.is_super_admin_profile(p_actor_profile_id)
     or not (
       res.resource_type = 'column'
       and (
         res.resource_key ilike '%access_pin%'
         or res.resource_key ilike '%password%'
         or res.resource_key ilike '%senha%'
       )
     )
   )
 order by
   case when res.resource_key = 'maintenance.card.access_control' then 1 else 0 end,
   res.resource_key asc;
end;
$$;

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
  v_tenant uuid;
begin
  perform public.assert_access_admin(p_actor_profile_id);

  v_role_code := lower(trim(coalesce(p_role_code, '')));
  v_resource_type := lower(trim(coalesce(p_resource_type, '')));
  v_resource_key := trim(coalesce(p_resource_key, ''));
  v_can_view := coalesce(p_can_view, false);
  v_can_update := coalesce(p_can_update, false);

  -- Proteção aplicada: Gestor não tem visibilidade do Super Administrador
  begin
    perform public.assert_gestor_super_admin_shield(
      p_actor_profile_id,
      null,
      v_role_code,
      'save_role_grant'
    );
  exception
    when others then
      return jsonb_build_object(
        'success', false,
        'http_status', 403,
        'message', SQLERRM
      );
  end;

  if v_role_code = '' then
    return jsonb_build_object('success', false, 'message', 'Papel não informado.');
  end if;

  if v_resource_type not in ('screen', 'table', 'column') or v_resource_key = '' then
    return jsonb_build_object('success', false, 'message', 'Recurso inválido.');
  end if;

  -- Bloqueio de PIN/senha para Gestor (mesmo via matriz de grants).
  if not public.is_super_admin_profile(p_actor_profile_id)
     and public.is_gestor_controle_acesso_profile(p_actor_profile_id)
     and v_resource_type = 'column'
     and (
       v_resource_key ilike '%access_pin%'
       or v_resource_key ilike '%password%'
       or v_resource_key ilike '%senha%'
     ) then
    perform public.log_gestor_acesso_proibido(
      p_actor_profile_id,
      null,
      v_role_code,
      'save_pin_grant',
      jsonb_build_object('resource_key', v_resource_key, 'http_status', 403)
    );
    return jsonb_build_object(
      'success', false,
      'http_status', 403,
      'message', '403 Forbidden: Gestor não pode gerenciar PIN/senha.'
    );
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

  -- Card de pequeno grupo: gravar só na igreja da sessão.
  if v_resource_key = 'dashboard.card.small_group' then
    v_tenant := public.require_session_tenant_id();

    insert into public.access_grant_tenant_scope (
      tenant_id, role_id, resource_id, can_view, can_update
    )
    values (v_tenant, v_role_id, v_resource_id, v_can_view, v_can_update)
    on conflict (tenant_id, role_id, resource_id) do update
      set can_view = excluded.can_view,
          can_update = excluded.can_update,
          updated_at = now();

    return jsonb_build_object(
      'success', true,
      'message', case
        when v_can_view or v_can_update then 'Permissão salva nesta igreja.'
        else 'Permissão removida nesta igreja.'
      end
    );
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

  insert into public.access_grants (role_id, resource_id, can_view, can_update)
  values (v_role_id, v_resource_id, v_can_view, v_can_update)
  on conflict (role_id, resource_id) where (role_id is not null) do update
    set can_view = excluded.can_view,
        can_update = excluded.can_update,
        updated_at = now();

  return jsonb_build_object('success', true, 'message', 'Permissão salva.');
end;
$$;

grant execute on function public.small_group_card_tenant_for_profile(uuid) to anon, authenticated;
grant execute on function public.small_group_card_role_allowed(uuid, uuid, text) to anon, authenticated;
grant execute on function public.small_group_card_profile_allowed(uuid, text) to anon, authenticated;

-- Restaura o card para os papéis de uso e deixa a IBN explicitamente sem ele.
insert into public.access_grants (role_id, resource_id, can_view, can_update)
select r.id, res.id, true, r.code = 'super_admin'
  from public.access_roles r
  join public.access_resources res
    on res.resource_type = 'screen'
   and res.resource_key = 'dashboard.card.small_group'
 where r.code in (
   'super_admin', 'pastoral', 'lider_geral', 'lider', 'member', 'congregado', 'events_admin', 'secretaria'
 )
on conflict (role_id, resource_id) where (role_id is not null) do nothing;

insert into public.access_grant_tenant_scope (tenant_id, role_id, resource_id, can_view, can_update)
select
  'a0000000-0000-4000-8000-000000000001'::uuid,
  r.id,
  res.id,
  false,
  false
  from public.access_roles r
  join public.access_resources res
    on res.resource_type = 'screen'
   and res.resource_key = 'dashboard.card.small_group'
 where r.code in (
   'pastoral', 'lider_geral', 'lider', 'member', 'congregado', 'events_admin', 'secretaria'
 )
on conflict (tenant_id, role_id, resource_id) do nothing;

notify pgrst, 'reload schema';

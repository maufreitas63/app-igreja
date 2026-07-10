-- =============================================================================
-- Multi-tenancy — onda 3a: ACL / ghost / mudança de papel / insights (tenant)
-- =============================================================================
-- Pré-requisito: scripts/multi-tenant-wave0-helper.sql (require_session_tenant_id).
-- Fontes canônicas (versões mais recentes usadas):
--   access-control-admin-rpc.sql
--   access-control-hide-visitantes-profile-role.sql
--   access-control-visitantes-auto-assign.sql
--   access-control-pastoral-congregado-membership.sql
--   access-control-super-admin-pastoral-role-change.sql
--   access-control-pastoral-role-change.sql (overload date-only)
--   access-control-lider-escala.sql
--   access-control-ghost-mode.sql
--   profile-access-insights.sql
--   profile-access-insights-screen-visits-patch.sql
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- buscar_perfis_access_admin
-- ---------------------------------------------------------------------------
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
  v_tenant uuid := public.require_session_tenant_id();
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
  where p.tenant_id = v_tenant
    and coalesce(p.full_name, '') <> ''
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

grant execute on function public.buscar_perfis_access_admin(uuid, text, integer) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- listar_perfis_access_admin
-- ---------------------------------------------------------------------------
create or replace function public.listar_perfis_access_admin(
  p_actor_profile_id uuid,
  p_limit integer default 5000
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
  v_tenant uuid := public.require_session_tenant_id();
  v_limit integer;
begin
  perform public.assert_access_admin(p_actor_profile_id);

  v_limit := greatest(1, least(coalesce(p_limit, 5000), 5000));

  return query
  select
    p.id,
    coalesce(nullif(trim(p.full_name), ''), nullif(trim(p.phone), ''), '(sem nome)') as full_name,
    coalesce(p.phone, '') as phone,
    coalesce(p.codigo_membro, '') as codigo_membro
  from public.profiles p
  where p.tenant_id = v_tenant
    and coalesce(
      nullif(trim(p.full_name), ''),
      nullif(trim(p.phone), ''),
      nullif(trim(p.codigo_membro), '')
    ) is not null
  order by p.full_name asc
  limit v_limit;
end;
$$;

grant execute on function public.listar_perfis_access_admin(uuid, integer) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- listar_papeis_perfil_access_admin
-- ---------------------------------------------------------------------------
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
declare
  v_tenant uuid := public.require_session_tenant_id();
begin
  perform public.assert_access_admin(p_actor_profile_id);

  if p_target_profile_id is null then
    raise exception 'Perfil não informado.';
  end if;

  if not exists (
    select 1
      from public.profiles p
     where p.id = p_target_profile_id
       and p.tenant_id = v_tenant
  ) then
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
         and par.tenant_id = v_tenant
    ) as assigned
  from public.access_roles ar
  where ar.code <> 'visitantes'
  order by public.access_role_display_order(ar.code), ar.name asc;
end;
$$;

grant execute on function public.listar_papeis_perfil_access_admin(uuid, uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- atribuir_papel_perfil_access_admin
-- ---------------------------------------------------------------------------
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
  v_tenant uuid := public.require_session_tenant_id();
  v_role_code text;
  v_role_id uuid;
begin
  perform public.assert_access_admin(p_actor_profile_id);

  v_role_code := lower(trim(coalesce(p_role_code, '')));

  if p_target_profile_id is null then
    return jsonb_build_object('success', false, 'message', 'Perfil não informado.');
  end if;

  if not exists (
    select 1 from public.profiles p
     where p.id = p_target_profile_id and p.tenant_id = v_tenant
  ) then
    return jsonb_build_object('success', false, 'message', 'Perfil não encontrado.');
  end if;

  if v_role_code = '' then
    return jsonb_build_object('success', false, 'message', 'Papel não informado.');
  end if;

  if v_role_code = 'visitantes' then
    return jsonb_build_object(
      'success',
      false,
      'message',
      'O papel visitante é atribuído automaticamente na criação do perfil.'
    );
  end if;

  select ar.id
    into v_role_id
    from public.access_roles ar
   where ar.code = v_role_code;

  if v_role_id is null then
    return jsonb_build_object('success', false, 'message', 'Papel não encontrado.');
  end if;

  perform public.remove_profile_visitantes_role(p_target_profile_id);

  insert into public.profile_access_roles (profile_id, role_id, granted_by_profile_id, tenant_id)
  values (p_target_profile_id, v_role_id, p_actor_profile_id, v_tenant)
  on conflict (profile_id, role_id) do nothing;

  return jsonb_build_object('success', true, 'message', 'Papel atribuído.');
end;
$$;

grant execute on function public.atribuir_papel_perfil_access_admin(uuid, uuid, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- revogar_papel_perfil_access_admin
-- ---------------------------------------------------------------------------
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
  v_tenant uuid := public.require_session_tenant_id();
  v_role_code text;
  v_role_id uuid;
  v_remaining_super_admins integer;
begin
  perform public.assert_access_admin(p_actor_profile_id);

  v_role_code := lower(trim(coalesce(p_role_code, '')));

  if p_target_profile_id is null then
    return jsonb_build_object('success', false, 'message', 'Perfil não informado.');
  end if;

  if not exists (
    select 1 from public.profiles p
     where p.id = p_target_profile_id and p.tenant_id = v_tenant
  ) then
    return jsonb_build_object('success', false, 'message', 'Perfil não encontrado.');
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
       and par.tenant_id = v_tenant
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
     and par.role_id = v_role_id
     and par.tenant_id = v_tenant;

  perform public.ensure_profile_visitantes_role(p_target_profile_id, p_actor_profile_id);

  return jsonb_build_object('success', true, 'message', 'Papel removido.');
end;
$$;

grant execute on function public.revogar_papel_perfil_access_admin(uuid, uuid, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- listar_grants_recurso_papel_admin
-- ---------------------------------------------------------------------------
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
  v_tenant uuid := public.require_session_tenant_id();
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
   and g.tenant_id = v_tenant
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

grant execute on function public.listar_grants_recurso_papel_admin(uuid, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- salvar_grant_papel_admin
-- ---------------------------------------------------------------------------
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
  v_tenant uuid := public.require_session_tenant_id();
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
       and g.tenant_id = v_tenant
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

  insert into public.access_grants (role_id, resource_id, can_view, can_update, tenant_id)
  values (v_role_id, v_resource_id, v_can_view, v_can_update, v_tenant)
  on conflict (role_id, resource_id) where (role_id is not null) do update
    set can_view = excluded.can_view,
        can_update = excluded.can_update,
        updated_at = now(),
        tenant_id = excluded.tenant_id;

  return jsonb_build_object('success', true, 'message', 'Permissão salva.');
end;
$$;

grant execute on function public.salvar_grant_papel_admin(uuid, text, text, text, boolean, boolean) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- listar_perfis_mudanca_papel_pastoral
-- ---------------------------------------------------------------------------
create or replace function public.listar_perfis_mudanca_papel_pastoral(
  p_actor_profile_id uuid,
  p_limit integer default 5000
)
returns table (
  id uuid,
  full_name text,
  phone text,
  codigo_membro text,
  membership_date date,
  membership_out date,
  own_membership_date date,
  own_membership_out date,
  family_id text,
  membership_inherited boolean,
  inherited_from_name text,
  current_role_code text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_limit integer;
begin
  perform public.assert_pastoral_role_change_actor(p_actor_profile_id);

  v_limit := greatest(1, least(coalesce(p_limit, 5000), 5000));

  return query
  select
    p.id,
    coalesce(nullif(trim(p.full_name), ''), nullif(trim(p.phone), ''), '(sem nome)') as full_name,
    coalesce(p.phone, '') as phone,
    coalesce(p.codigo_membro, '') as codigo_membro,
    eff.membership_date,
    eff.membership_out,
    p.membership_date as own_membership_date,
    p.membership_out as own_membership_out,
    coalesce(nullif(trim(p.family_id), ''), '') as family_id,
    coalesce(eff.membership_inherited, false) as membership_inherited,
    coalesce(eff.inherited_from_name, '') as inherited_from_name,
    public.resolve_basic_role_code_for_profile(p.id) as current_role_code
  from public.profiles p
  cross join lateral public.resolve_effective_membership_dates_for_profile(p.id) eff
  where p.tenant_id = v_tenant
    and coalesce(
      nullif(trim(p.full_name), ''),
      nullif(trim(p.phone), ''),
      nullif(trim(p.codigo_membro), '')
    ) is not null
  order by p.full_name asc
  limit v_limit;
end;
$$;

grant execute on function public.listar_perfis_mudanca_papel_pastoral(uuid, integer) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- buscar_perfis_mudanca_papel_pastoral
-- ---------------------------------------------------------------------------
create or replace function public.buscar_perfis_mudanca_papel_pastoral(
  p_actor_profile_id uuid,
  p_query text,
  p_limit integer default 30
)
returns table (
  id uuid,
  full_name text,
  phone text,
  codigo_membro text,
  membership_date date,
  membership_out date,
  own_membership_date date,
  own_membership_out date,
  family_id text,
  membership_inherited boolean,
  inherited_from_name text,
  current_role_code text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_query text;
  v_digits text;
  v_limit integer;
begin
  perform public.assert_pastoral_role_change_actor(p_actor_profile_id);

  v_query := trim(coalesce(p_query, ''));
  v_digits := regexp_replace(v_query, '\D', '', 'g');
  v_limit := greatest(1, least(coalesce(p_limit, 30), 50));

  if char_length(v_query) < 2 then
    return;
  end if;

  return query
  select
    p.id,
    coalesce(nullif(trim(p.full_name), ''), nullif(trim(p.phone), ''), '(sem nome)') as full_name,
    coalesce(p.phone, '') as phone,
    coalesce(p.codigo_membro, '') as codigo_membro,
    eff.membership_date,
    eff.membership_out,
    p.membership_date as own_membership_date,
    p.membership_out as own_membership_out,
    coalesce(nullif(trim(p.family_id), ''), '') as family_id,
    coalesce(eff.membership_inherited, false) as membership_inherited,
    coalesce(eff.inherited_from_name, '') as inherited_from_name,
    public.resolve_basic_role_code_for_profile(p.id) as current_role_code
  from public.profiles p
  cross join lateral public.resolve_effective_membership_dates_for_profile(p.id) eff
  where p.tenant_id = v_tenant
    and (
      coalesce(nullif(trim(p.full_name), ''), nullif(trim(p.phone), ''), nullif(trim(p.codigo_membro), '')) is not null
    )
    and (
      coalesce(p.full_name, '') ilike '%' || v_query || '%'
      or (
        v_digits <> ''
        and regexp_replace(coalesce(p.phone, ''), '\D', '', 'g') like '%' || v_digits || '%'
      )
      or coalesce(p.codigo_membro, '') ilike '%' || v_query || '%'
      or exists (
        select 1
          from public.profile_access_roles par
          join public.access_roles ar on ar.id = par.role_id
         where par.profile_id = p.id
           and par.tenant_id = v_tenant
           and ar.code in ('member', 'congregado')
           and (
             ar.code ilike '%' || lower(v_query) || '%'
             or ar.name ilike '%' || v_query || '%'
           )
      )
      or (
        lower(v_query) like 'visit%'
        and public.resolve_basic_role_code_for_profile(p.id) = 'visitante'
      )
      or (
        lower(v_query) in ('membro', 'member')
        and public.resolve_basic_role_code_for_profile(p.id) = 'member'
      )
      or (
        lower(v_query) like 'congreg%'
        and public.resolve_basic_role_code_for_profile(p.id) = 'congregado'
      )
    )
  order by p.full_name asc
  limit v_limit;
end;
$$;

grant execute on function public.buscar_perfis_mudanca_papel_pastoral(uuid, text, integer) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- definir_papel_basico_perfil_pastoral
-- ---------------------------------------------------------------------------
create or replace function public.definir_papel_basico_perfil_pastoral(
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
  v_tenant uuid := public.require_session_tenant_id();
  v_role_code text;
  v_role_id uuid;
  v_current_role text;
begin
  perform public.assert_pastoral_role_change_actor(p_actor_profile_id);

  if p_target_profile_id is null then
    return jsonb_build_object('success', false, 'message', 'Perfil não informado.');
  end if;

  if not exists (
    select 1 from public.profiles p
     where p.id = p_target_profile_id and p.tenant_id = v_tenant
  ) then
    return jsonb_build_object('success', false, 'message', 'Perfil não encontrado.');
  end if;

  if not public.is_super_admin_profile(p_actor_profile_id)
     and public.profile_has_protected_role_for_pastoral_change(p_target_profile_id) then
    return jsonb_build_object(
      'success',
      false,
      'message',
      'Este perfil possui papel protegido e não pode ser alterado por esta tela.'
    );
  end if;

  v_role_code := lower(trim(coalesce(p_role_code, '')));

  if v_role_code not in ('visitante', 'congregado', 'member') then
    return jsonb_build_object(
      'success',
      false,
      'message',
      'Papel inválido. Use visitante, congregado ou member.'
    );
  end if;

  v_current_role := public.resolve_basic_role_code_for_profile(p_target_profile_id);

  if v_current_role = v_role_code then
    return jsonb_build_object('success', true, 'message', 'Papel já estava definido.');
  end if;

  delete from public.profile_access_roles par
   using public.access_roles ar
   where par.role_id = ar.id
     and par.profile_id = p_target_profile_id
     and par.tenant_id = v_tenant
     and ar.code in ('member', 'congregado', 'visitantes');

  if v_role_code = 'visitante' then
    perform public.ensure_profile_visitantes_role(p_target_profile_id, p_actor_profile_id);

    return jsonb_build_object(
      'success',
      true,
      'message',
      'Perfil definido como visitante.'
    );
  end if;

  select ar.id
    into v_role_id
    from public.access_roles ar
   where ar.code = v_role_code;

  if v_role_id is null then
    return jsonb_build_object('success', false, 'message', 'Papel não encontrado no sistema.');
  end if;

  insert into public.profile_access_roles (profile_id, role_id, granted_by_profile_id, tenant_id)
  values (p_target_profile_id, v_role_id, p_actor_profile_id, v_tenant)
  on conflict (profile_id, role_id) do nothing;

  return jsonb_build_object(
    'success',
    true,
    'message',
    case v_role_code
      when 'member' then 'Papel alterado para Membro.'
      when 'congregado' then 'Papel alterado para Congregado.'
      else 'Papel atualizado.'
    end
  );
end;
$$;

grant execute on function public.definir_papel_basico_perfil_pastoral(uuid, uuid, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- atualizar_membership_date_perfil_pastoral (date only)
-- ---------------------------------------------------------------------------
create or replace function public.atualizar_membership_date_perfil_pastoral(
  p_actor_profile_id uuid,
  p_target_profile_id uuid,
  p_membership_date date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
begin
  perform public.assert_pastoral_role_change_actor(p_actor_profile_id);

  if p_target_profile_id is null then
    return jsonb_build_object('success', false, 'message', 'Perfil não informado.');
  end if;

  if not exists (
    select 1 from public.profiles p
     where p.id = p_target_profile_id and p.tenant_id = v_tenant
  ) then
    return jsonb_build_object('success', false, 'message', 'Perfil não encontrado.');
  end if;

  if not public.is_super_admin_profile(p_actor_profile_id)
     and public.profile_has_protected_role_for_pastoral_change(p_target_profile_id) then
    return jsonb_build_object(
      'success',
      false,
      'message',
      'Este perfil possui papel protegido e não pode ser alterado por esta tela.'
    );
  end if;

  if public.resolve_basic_role_code_for_profile(p_target_profile_id) <> 'member' then
    return jsonb_build_object(
      'success',
      false,
      'message',
      'A data de filiação só pode ser editada para perfis classificados como Membro.'
    );
  end if;

  update public.profiles
     set membership_date = p_membership_date,
         updated_at = now()
   where id = p_target_profile_id
     and tenant_id = v_tenant;

  return jsonb_build_object(
    'success',
    true,
    'message',
    case
      when p_membership_date is null then 'Data de filiação removida.'
      else 'Data de filiação atualizada.'
    end,
    'membership_date', p_membership_date
  );
end;
$$;

grant execute on function public.atualizar_membership_date_perfil_pastoral(uuid, uuid, date) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- atualizar_membership_date_perfil_pastoral (with membership_out)
-- ---------------------------------------------------------------------------
create or replace function public.atualizar_membership_date_perfil_pastoral(
  p_actor_profile_id uuid,
  p_target_profile_id uuid,
  p_membership_date date,
  p_membership_out date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_role text;
begin
  perform public.assert_pastoral_role_change_actor(p_actor_profile_id);

  if p_target_profile_id is null then
    return jsonb_build_object('success', false, 'message', 'Perfil não informado.');
  end if;

  if not exists (
    select 1 from public.profiles p
     where p.id = p_target_profile_id and p.tenant_id = v_tenant
  ) then
    return jsonb_build_object('success', false, 'message', 'Perfil não encontrado.');
  end if;

  if not public.is_super_admin_profile(p_actor_profile_id)
     and public.profile_has_protected_role_for_pastoral_change(p_target_profile_id) then
    return jsonb_build_object(
      'success',
      false,
      'message',
      'Este perfil possui papel protegido e não pode ser alterado por esta tela.'
    );
  end if;

  v_role := public.resolve_basic_role_code_for_profile(p_target_profile_id);

  if v_role not in ('member', 'congregado') then
    return jsonb_build_object(
      'success',
      false,
      'message',
      'As datas de membresia só podem ser editadas para perfis classificados como Membro ou Congregado.'
    );
  end if;

  if v_role = 'congregado' and public.profile_membership_dates_are_inherited(p_target_profile_id) then
    return jsonb_build_object(
      'success',
      false,
      'message',
      'Este congregado herda as datas do responsável familiar. Edite o perfil do responsável legal, pai ou mãe.'
    );
  end if;

  update public.profiles
     set membership_date = p_membership_date,
         membership_out = p_membership_out,
         updated_at = now()
   where id = p_target_profile_id
     and tenant_id = v_tenant;

  return jsonb_build_object(
    'success',
    true,
    'message',
    case
      when p_membership_date is null and p_membership_out is null then 'Datas de membresia removidas.'
      else 'Datas de membresia atualizadas.'
    end,
    'membership_date', p_membership_date,
    'membership_out', p_membership_out
  );
end;
$$;

grant execute on function public.atualizar_membership_date_perfil_pastoral(uuid, uuid, date, date)
  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- listar_liderancas_escala_admin
-- ---------------------------------------------------------------------------
create or replace function public.listar_liderancas_escala_admin(
  p_actor_profile_id uuid,
  p_target_profile_id uuid
)
returns table (
  tipo_escala_id uuid,
  tipo_codigo text,
  tipo_nome text,
  assigned boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
begin
  perform public.assert_access_admin(p_actor_profile_id);

  if p_target_profile_id is null then
    raise exception 'Perfil não informado.';
  end if;

  if not exists (
    select 1 from public.profiles p
     where p.id = p_target_profile_id and p.tenant_id = v_tenant
  ) then
    raise exception 'Perfil não encontrado.';
  end if;

  return query
  select
    te.id as tipo_escala_id,
    te.codigo as tipo_codigo,
    te.nome as tipo_nome,
    exists (
      select 1
        from public.profile_scale_leadership psl
       where psl.profile_id = p_target_profile_id
         and psl.tipo_escala_id = te.id
         and psl.tenant_id = v_tenant
    ) as assigned
  from public.tipos_escala te
 where te.tenant_id = v_tenant
   and te.is_ativa = true
 order by te.nome asc;
end;
$$;

grant execute on function public.listar_liderancas_escala_admin(uuid, uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- salvar_lideranca_escala_admin
-- ---------------------------------------------------------------------------
create or replace function public.salvar_lideranca_escala_admin(
  p_actor_profile_id uuid,
  p_target_profile_id uuid,
  p_tipo_escala_id uuid,
  p_assigned boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_codigo text;
  v_nome text;
begin
  perform public.assert_access_admin(p_actor_profile_id);

  if p_target_profile_id is null or p_tipo_escala_id is null then
    return jsonb_build_object('success', false, 'message', 'Perfil ou tipo de escala não informado.');
  end if;

  if not exists (
    select 1 from public.profiles p
     where p.id = p_target_profile_id and p.tenant_id = v_tenant
  ) then
    return jsonb_build_object('success', false, 'message', 'Perfil não encontrado.');
  end if;

  select te.codigo, te.nome
    into v_codigo, v_nome
    from public.tipos_escala te
   where te.id = p_tipo_escala_id
     and te.tenant_id = v_tenant;

  if v_codigo is null then
    return jsonb_build_object('success', false, 'message', 'Tipo de escala não encontrado.');
  end if;

  perform public.sync_scale_type_access_resource(v_codigo, v_nome);

  if coalesce(p_assigned, false) then
    insert into public.profile_scale_leadership (profile_id, tipo_escala_id, granted_by_profile_id, tenant_id)
    values (p_target_profile_id, p_tipo_escala_id, p_actor_profile_id, v_tenant)
    on conflict (profile_id, tipo_escala_id) do update
      set granted_by_profile_id = excluded.granted_by_profile_id,
          tenant_id = excluded.tenant_id;
  else
    delete from public.profile_scale_leadership psl
     where psl.profile_id = p_target_profile_id
       and psl.tipo_escala_id = p_tipo_escala_id
       and psl.tenant_id = v_tenant;
  end if;

  return jsonb_build_object('success', true, 'message', 'Liderança de escala atualizada.');
end;
$$;

grant execute on function public.salvar_lideranca_escala_admin(uuid, uuid, uuid, boolean) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- listar_perfis_ghost_mode
-- ---------------------------------------------------------------------------
create or replace function public.listar_perfis_ghost_mode(
  p_operator_profile_id uuid,
  p_limit integer default 5000
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
  v_tenant uuid := public.require_session_tenant_id();
  v_limit integer;
begin
  perform public.assert_actor_matches_real_session(p_operator_profile_id);

  if not public.can_operate_ghost_mode(p_operator_profile_id) then
    raise exception 'Sem permissão para usar o Modo Ghost.';
  end if;

  v_limit := greatest(1, least(coalesce(p_limit, 5000), 5000));

  return query
  select
    p.id,
    coalesce(nullif(trim(p.full_name), ''), nullif(trim(p.phone), ''), '(sem nome)') as full_name,
    coalesce(p.phone, '') as phone,
    coalesce(p.codigo_membro, '') as codigo_membro
  from public.profiles p
  where p.tenant_id = v_tenant
    and p.membership_out is null
    and coalesce(
      nullif(trim(p.full_name), ''),
      nullif(trim(p.phone), ''),
      nullif(trim(p.codigo_membro), '')
    ) is not null
  order by p.full_name asc
  limit v_limit;
end;
$$;

grant execute on function public.listar_perfis_ghost_mode(uuid, integer) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- registrar_evento_ghost_mode
-- ---------------------------------------------------------------------------
create or replace function public.registrar_evento_ghost_mode(
  p_operator_profile_id uuid,
  p_event_type text,
  p_target_profile_id uuid default null,
  p_details jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_event text;
begin
  perform public.assert_actor_matches_real_session(p_operator_profile_id);

  if not public.can_operate_ghost_mode(p_operator_profile_id) then
    return jsonb_build_object('success', false, 'message', 'Sem permissão para usar o Modo Ghost.');
  end if;

  v_event := lower(trim(coalesce(p_event_type, '')));

  if v_event not in ('started', 'ended') then
    return jsonb_build_object('success', false, 'message', 'Tipo de evento inválido.');
  end if;

  if p_target_profile_id is not null
     and not exists (
       select 1 from public.profiles p
        where p.id = p_target_profile_id and p.tenant_id = v_tenant
     ) then
    return jsonb_build_object('success', false, 'message', 'Perfil alvo não encontrado.');
  end if;

  insert into public.ghost_mode_audit_log (
    operator_profile_id,
    target_profile_id,
    event_type,
    details,
    tenant_id
  )
  values (
    p_operator_profile_id,
    p_target_profile_id,
    v_event,
    coalesce(p_details, '{}'::jsonb),
    v_tenant
  );

  return jsonb_build_object(
    'success', true,
    'message',
    case
      when v_event = 'started' then 'Modo Ghost iniciado.'
      else 'Modo Ghost encerrado.'
    end
  );
end;
$$;

grant execute on function public.registrar_evento_ghost_mode(uuid, text, uuid, jsonb) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- obter_previa_perfil_ghost_mode
-- ---------------------------------------------------------------------------
create or replace function public.obter_previa_perfil_ghost_mode(
  p_operator_profile_id uuid,
  p_target_profile_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_profile public.profiles%rowtype;
  v_roles jsonb;
  v_assigned_count integer;
begin
  perform public.assert_actor_matches_real_session(p_operator_profile_id);

  if not public.can_operate_ghost_mode(p_operator_profile_id) then
    return jsonb_build_object('success', false, 'message', 'Sem permissão para usar o Modo Ghost.');
  end if;

  if p_target_profile_id is null then
    return jsonb_build_object('success', false, 'message', 'Perfil não informado.');
  end if;

  select p.*
    into v_profile
    from public.profiles p
   where p.id = p_target_profile_id
     and p.tenant_id = v_tenant;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Perfil não encontrado.');
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'role_id', ar.id,
        'role_code', ar.code,
        'role_name', ar.name
      )
      order by public.access_role_display_order(ar.code), ar.name
    ),
    '[]'::jsonb
  )
  into v_roles
  from public.profile_access_roles par
  join public.access_roles ar on ar.id = par.role_id
  where par.profile_id = p_target_profile_id
    and par.tenant_id = v_tenant
    and ar.code <> 'visitantes';

  v_assigned_count := coalesce(jsonb_array_length(v_roles), 0);

  return jsonb_build_object(
    'success', true,
    'profile', jsonb_build_object(
      'id', v_profile.id,
      'full_name', nullif(trim(coalesce(v_profile.full_name, '')), ''),
      'phone', nullif(trim(coalesce(v_profile.phone, '')), ''),
      'codigo_membro', nullif(trim(coalesce(v_profile.codigo_membro, '')), ''),
      'family_id', nullif(trim(coalesce(v_profile.family_id, '')), ''),
      'email', nullif(trim(coalesce(v_profile.email, '')), ''),
      'cpf', nullif(trim(coalesce(v_profile.cpf, '')), ''),
      'birth_date', v_profile.birth_date,
      'membership_out', v_profile.membership_out,
      'lgpd_accepted', v_profile.lgpd_accepted,
      'cep', nullif(trim(coalesce(v_profile.cep, '')), ''),
      'address_street', nullif(trim(coalesce(v_profile.address_street, '')), ''),
      'address_number', nullif(trim(coalesce(v_profile.address_number, '')), ''),
      'address_neighborhood', nullif(trim(coalesce(v_profile.address_neighborhood, '')), ''),
      'address_city', nullif(trim(coalesce(v_profile.address_city, '')), ''),
      'address_state', nullif(trim(coalesce(v_profile.address_state, '')), ''),
      'created_at', v_profile.created_at,
      'updated_at', v_profile.updated_at
    ),
    'roles', v_roles,
    'implicit_visitante', v_assigned_count = 0
  );
end;
$$;

grant execute on function public.obter_previa_perfil_ghost_mode(uuid, uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- record_profile_app_access
-- ---------------------------------------------------------------------------
-- Nota: apenas uma assinatura canônica encontrada em profile-access-insights.sql
-- (não há overload adicional seguro para patch).
-- Tenant: sessão → profiles.tenant_id → default (trigger de login pode não ter header).
create or replace function public.record_profile_app_access(
  p_profile_id uuid,
  p_profile_session_id uuid default null,
  p_accessed_at timestamptz default now()
)
returns void
language plpgsql
security definer
set search_path = public
as $record_profile_app_access$
declare
  v_tenant uuid := coalesce(
    public.current_session_tenant_id(),
    (select p.tenant_id from public.profiles p where p.id = p_profile_id),
    public.resolve_default_tenant_id()
  );
begin
  if p_profile_id is null or v_tenant is null then
    return;
  end if;

  if not exists (
    select 1 from public.profiles p
     where p.id = p_profile_id
       and (p.tenant_id = v_tenant or p.tenant_id is null)
  ) then
    return;
  end if;

  insert into public.profile_app_access_events (profile_id, profile_session_id, accessed_at, tenant_id)
  values (p_profile_id, p_profile_session_id, coalesce(p_accessed_at, now()), v_tenant);
end;
$record_profile_app_access$;

grant execute on function public.record_profile_app_access(uuid, uuid, timestamptz) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- record_profile_app_access_screen_visit
-- ---------------------------------------------------------------------------
create or replace function public.record_profile_app_access_screen_visit(
  p_screen_key text,
  p_screen_label text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $record_profile_app_access_screen_visit$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_profile_id uuid;
  v_session_id uuid;
  v_access_event_id uuid;
  v_screen_key text;
  v_screen_label text;
  v_last_key text;
  v_next_order integer;
begin
  v_session_id := public.resolve_current_profile_session_id();
  v_profile_id := public.current_session_profile_id();

  if v_profile_id is null then
    return;
  end if;

  if not exists (
    select 1 from public.profiles p
     where p.id = v_profile_id and p.tenant_id = v_tenant
  ) then
    return;
  end if;

  v_screen_key := nullif(trim(coalesce(p_screen_key, '')), '');

  if v_screen_key is null then
    return;
  end if;

  v_screen_label := nullif(trim(coalesce(p_screen_label, p_screen_key, '')), '');

  if v_screen_label in ('Dashboard', 'Manutenção')
     or v_screen_key in ('/dashboard', '/maintenance-dashboard') then
    return;
  end if;

  v_access_event_id := public.resolve_current_access_event_id(v_profile_id, v_session_id);

  if v_access_event_id is null then
    return;
  end if;

  -- Garante que o evento de acesso pertence ao tenant da sessão
  if not exists (
    select 1
      from public.profile_app_access_events e
     where e.id = v_access_event_id
       and e.tenant_id = v_tenant
  ) then
    return;
  end if;

  select sv.screen_key
    into v_last_key
    from public.profile_app_access_screen_visits sv
   where sv.access_event_id = v_access_event_id
     and sv.tenant_id = v_tenant
   order by sv.visit_order desc
   limit 1;

  if v_last_key = v_screen_key then
    return;
  end if;

  select coalesce(max(sv.visit_order), 0) + 1
    into v_next_order
    from public.profile_app_access_screen_visits sv
   where sv.access_event_id = v_access_event_id
     and sv.tenant_id = v_tenant;

  insert into public.profile_app_access_screen_visits (
    access_event_id,
    profile_id,
    screen_key,
    screen_label,
    visit_order,
    tenant_id
  )
  values (
    v_access_event_id,
    v_profile_id,
    v_screen_key,
    v_screen_label,
    v_next_order,
    v_tenant
  );
end;
$record_profile_app_access_screen_visit$;

grant execute on function public.record_profile_app_access_screen_visit(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- list_profile_access_insights_admin
-- ---------------------------------------------------------------------------
create or replace function public.list_profile_access_insights_admin(
  p_actor_profile_id uuid
)
returns table (
  profile_id uuid,
  full_name text,
  last_access_at timestamptz,
  access_count bigint
)
language plpgsql
security definer
set search_path = public
as $list_profile_access_insights_admin$
declare
  v_tenant uuid := public.require_session_tenant_id();
begin
  perform public.assert_access_admin(p_actor_profile_id);

  return query
  select
    p.id as profile_id,
    p.full_name,
    max(e.accessed_at) as last_access_at,
    count(e.id)::bigint as access_count
  from public.profiles p
  inner join public.profile_app_access_events e
    on e.profile_id = p.id
   and e.tenant_id = v_tenant
  where p.tenant_id = v_tenant
    and coalesce(trim(p.full_name), '') <> ''
    and lower(trim(p.full_name)) <> 'visitante'
  group by p.id, p.full_name
  having count(e.id) > 0
  order by max(e.accessed_at) desc, p.full_name asc;
end;
$list_profile_access_insights_admin$;

grant execute on function public.list_profile_access_insights_admin(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- list_profile_access_screen_visits_admin
-- ---------------------------------------------------------------------------
create or replace function public.list_profile_access_screen_visits_admin(
  p_actor_profile_id uuid,
  p_target_profile_id uuid
)
returns table (
  access_event_id uuid,
  accessed_at timestamptz,
  screen_key text,
  screen_label text,
  visited_at timestamptz,
  visit_order integer
)
language plpgsql
security definer
set search_path = public
as $list_profile_access_screen_visits_admin$
declare
  v_tenant uuid := public.require_session_tenant_id();
begin
  perform public.assert_access_admin(p_actor_profile_id);

  if p_target_profile_id is null then
    return;
  end if;

  if not exists (
    select 1 from public.profiles p
     where p.id = p_target_profile_id and p.tenant_id = v_tenant
  ) then
    return;
  end if;

  return query
  select
    e.id as access_event_id,
    e.accessed_at,
    sv.screen_key,
    sv.screen_label,
    sv.visited_at,
    sv.visit_order
  from public.profile_app_access_events e
  left join public.profile_app_access_screen_visits sv
    on sv.access_event_id = e.id
   and sv.tenant_id = v_tenant
   and sv.screen_label not in ('Dashboard', 'Manutenção')
   and sv.screen_key not in ('/dashboard', '/maintenance-dashboard')
  where e.profile_id = p_target_profile_id
    and e.tenant_id = v_tenant
  order by e.accessed_at desc, sv.visit_order asc nulls last;
end;
$list_profile_access_screen_visits_admin$;

grant execute on function public.list_profile_access_screen_visits_admin(uuid, uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- clear_profile_access_insights_admin
-- ---------------------------------------------------------------------------
create or replace function public.clear_profile_access_insights_admin(
  p_actor_profile_id uuid
)
returns bigint
language plpgsql
security definer
set search_path = public
as $clear_profile_access_insights_admin$
declare
  v_tenant uuid := public.require_session_tenant_id();
  cnt_before bigint;
  cnt_after bigint;
begin
  perform public.assert_access_admin(p_actor_profile_id);

  select count(*)::bigint
    into cnt_before
    from public.profile_app_access_events e
   where e.tenant_id = v_tenant;

  delete from public.profile_app_access_screen_visits sv
   where sv.tenant_id = v_tenant;

  delete from public.profile_app_access_events e
   where e.tenant_id = v_tenant;

  select count(*)::bigint
    into cnt_after
    from public.profile_app_access_events e
   where e.tenant_id = v_tenant;

  if cnt_after > 0 then
    raise exception 'Falha ao limpar profile_app_access_events (% registros restantes).', cnt_after;
  end if;

  return coalesce(cnt_before, 0);
end;
$clear_profile_access_insights_admin$;

grant execute on function public.clear_profile_access_insights_admin(uuid) to anon, authenticated;

notify pgrst, 'reload schema';

commit;

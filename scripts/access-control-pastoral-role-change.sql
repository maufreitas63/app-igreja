-- Mudança de Papéis — Equipe Pastoral altera visitante / congregado / membro.
-- Execute no SQL Editor do Supabase após access-control-admin-rpc.sql e
-- access-control-pastoral-role-grants.sql.

-- ---------------------------------------------------------------------------
-- Recurso ACL do card na manutenção
-- ---------------------------------------------------------------------------

insert into public.access_resources (resource_type, resource_key, label, description)
values
  (
    'screen',
    'maintenance.card.mudanca_papeis',
    'Manutenção: Mudança de Papéis',
    'Equipe pastoral altera papéis básicos (visitante, congregado, membro)'
  )
on conflict (resource_type, resource_key) do update
  set label = excluded.label,
      description = excluded.description;

insert into public.access_grants (role_id, resource_id, can_view, can_update)
select r.id, res.id, true, true
  from public.access_roles r
  join public.access_resources res
    on res.resource_type = 'screen'
   and res.resource_key = 'maintenance.card.mudanca_papeis'
 where r.code in ('pastoral', 'super_admin')
on conflict (role_id, resource_id) where (role_id is not null) do update
  set can_view = excluded.can_view,
      can_update = excluded.can_update,
      updated_at = now();

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.profile_has_role_code(
  p_profile_id uuid,
  p_role_code text
)
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
       and ar.code = lower(trim(coalesce(p_role_code, '')))
  );
$$;

create or replace function public.assert_pastoral_role_change_actor(p_actor_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_actor_profile_id is null then
    raise exception 'Sessão inválida. Saia e entre novamente no aplicativo.';
  end if;

  if public.is_super_admin_profile(p_actor_profile_id) then
    return;
  end if;

  if not public.profile_has_role_code(p_actor_profile_id, 'pastoral') then
    raise exception 'Apenas a Equipe Pastoral pode alterar papéis básicos por esta tela.';
  end if;
end;
$$;

create or replace function public.resolve_basic_role_code_for_profile(p_profile_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when exists (
      select 1
        from public.profile_access_roles par
        join public.access_roles ar on ar.id = par.role_id
       where par.profile_id = p_profile_id
         and ar.code = 'member'
    ) then 'member'
    when exists (
      select 1
        from public.profile_access_roles par
        join public.access_roles ar on ar.id = par.role_id
       where par.profile_id = p_profile_id
         and ar.code = 'congregado'
    ) then 'congregado'
    else 'visitante'
  end;
$$;

create or replace function public.profile_has_protected_role_for_pastoral_change(p_profile_id uuid)
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
       and ar.code in ('super_admin', 'pastoral', 'lider', 'events_admin', 'family_acceptor')
  );
$$;

-- ---------------------------------------------------------------------------
-- Lista completa (filtro no app) + busca legada por texto
-- ---------------------------------------------------------------------------

drop function if exists public.listar_perfis_mudanca_papel_pastoral(uuid, integer);

create or replace function public.listar_perfis_mudanca_papel_pastoral(
  p_actor_profile_id uuid,
  p_limit integer default 5000
)
returns table (
  id uuid,
  full_name text,
  phone text,
  codigo_membro text,
  current_role_code text
)
language plpgsql
security definer
set search_path = public
as $$
declare
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
    public.resolve_basic_role_code_for_profile(p.id) as current_role_code
  from public.profiles p
  where not public.profile_has_protected_role_for_pastoral_change(p.id)
    and coalesce(
      nullif(trim(p.full_name), ''),
      nullif(trim(p.phone), ''),
      nullif(trim(p.codigo_membro), '')
    ) is not null
  order by p.full_name asc
  limit v_limit;
end;
$$;

drop function if exists public.buscar_perfis_mudanca_papel_pastoral(uuid, text, integer);

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
  current_role_code text
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
    public.resolve_basic_role_code_for_profile(p.id) as current_role_code
  from public.profiles p
  where not public.profile_has_protected_role_for_pastoral_change(p.id)
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

-- ---------------------------------------------------------------------------
-- Define um único papel básico (visitante | congregado | member)
-- ---------------------------------------------------------------------------

drop function if exists public.definir_papel_basico_perfil_pastoral(uuid, uuid, text);

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
  v_role_code text;
  v_role_id uuid;
  v_current_role text;
begin
  perform public.assert_pastoral_role_change_actor(p_actor_profile_id);

  if p_target_profile_id is null then
    return jsonb_build_object('success', false, 'message', 'Perfil não informado.');
  end if;

  if not exists (select 1 from public.profiles p where p.id = p_target_profile_id) then
    return jsonb_build_object('success', false, 'message', 'Perfil não encontrado.');
  end if;

  if public.profile_has_protected_role_for_pastoral_change(p_target_profile_id) then
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
     and ar.code in ('member', 'congregado');

  if v_role_code = 'visitante' then
    return jsonb_build_object(
      'success',
      true,
      'message',
      'Perfil definido como visitante (sem papéis atribuídos).'
    );
  end if;

  select ar.id
    into v_role_id
    from public.access_roles ar
   where ar.code = v_role_code;

  if v_role_id is null then
    return jsonb_build_object('success', false, 'message', 'Papel não encontrado no sistema.');
  end if;

  insert into public.profile_access_roles (profile_id, role_id, granted_by_profile_id)
  values (p_target_profile_id, v_role_id, p_actor_profile_id)
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

grant execute on function public.profile_has_role_code(uuid, text) to anon, authenticated;
grant execute on function public.listar_perfis_mudanca_papel_pastoral(uuid, integer) to anon, authenticated;
grant execute on function public.buscar_perfis_mudanca_papel_pastoral(uuid, text, integer) to anon, authenticated;
grant execute on function public.definir_papel_basico_perfil_pastoral(uuid, uuid, text) to anon, authenticated;

notify pgrst, 'reload schema';

-- Remove escalas de teste (prefixo tstmax) dos Papéis no Controle de Acesso.
-- Execute no SQL Editor do Supabase após access-control-lider-escala.sql.

create or replace function public.sync_scale_type_access_resource(
  p_codigo text,
  p_nome text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_codigo text;
  v_key text;
begin
  v_codigo := lower(trim(coalesce(p_codigo, '')));

  if v_codigo = '' then
    return;
  end if;

  v_key := public.scale_type_resource_key(v_codigo);

  if v_codigo like 'tstmax%' then
    delete from public.access_grants g
     using public.access_resources res
     where g.resource_id = res.id
       and res.resource_type = 'screen'
       and res.resource_key = v_key;

    update public.access_resources
       set is_active = false
     where resource_type = 'screen'
       and resource_key = v_key;

    return;
  end if;

  insert into public.access_resources (resource_type, resource_key, label, description)
  values (
    'screen',
    v_key,
    'Escala: ' || coalesce(nullif(trim(p_nome), ''), v_codigo),
    'Permissão por tipo de escala'
  )
  on conflict (resource_type, resource_key) do update
    set label = excluded.label,
        description = excluded.description,
        is_active = true;
end;
$$;

-- Limpeza imediata dos recursos já cadastrados
delete from public.access_grants g
 using public.access_resources res
 where g.resource_id = res.id
   and res.resource_type = 'screen'
   and res.resource_key like 'scale_type.tstmax%';

update public.access_resources
   set is_active = false
 where resource_type = 'screen'
   and resource_key like 'scale_type.tstmax%';

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
 order by res.resource_key asc;
end;
$$;

grant execute on function public.listar_grants_recurso_papel_admin(uuid, text, text) to anon, authenticated;

select resource_type, resource_key, label, is_active
  from public.access_resources
 where resource_type = 'screen'
   and resource_key like 'scale_type.tstmax%';

notify pgrst, 'reload schema';

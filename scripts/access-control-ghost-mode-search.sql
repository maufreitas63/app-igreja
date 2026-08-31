-- Busca de perfis do Modo Ghost sob demanda (evita carregar a lista inteira e travar a UI).
-- Isolamento por tenant + membership_out nulo (membro ativo). Timeout de 8s.

drop function if exists public.buscar_perfis_ghost_mode(uuid, text, integer);

create or replace function public.buscar_perfis_ghost_mode(
  p_operator_profile_id uuid,
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
set statement_timeout = '8s'
as $$
declare
  v_tenant uuid := public.require_session_tenant_id();
  v_query text;
  v_digits text;
  v_limit integer;
begin
  perform public.assert_actor_matches_real_session(p_operator_profile_id);

  if not public.can_operate_ghost_mode(p_operator_profile_id) then
    raise exception 'Sem permissão para usar o Modo Ghost.';
  end if;

  v_query := trim(coalesce(p_query, ''));
  v_digits := regexp_replace(v_query, '\D', '', 'g');
  v_limit := greatest(1, least(coalesce(p_limit, 20), 50));

  if char_length(v_query) < 2 then
    return;
  end if;

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
    and (
      coalesce(p.full_name, '') ilike '%' || v_query || '%'
      or (
        v_digits <> ''
        and char_length(v_digits) >= 2
        and regexp_replace(coalesce(p.phone, ''), '\D', '', 'g') like '%' || v_digits || '%'
      )
      or coalesce(p.codigo_membro, '') ilike '%' || v_query || '%'
    )
  order by p.full_name asc
  limit v_limit;
end;
$$;

grant execute on function public.buscar_perfis_ghost_mode(uuid, text, integer) to anon, authenticated;

-- Lista completa: mesmo recorte + timeout, para clientes antigos não ficarem pendurados.
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
set statement_timeout = '8s'
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

notify pgrst, 'reload schema';

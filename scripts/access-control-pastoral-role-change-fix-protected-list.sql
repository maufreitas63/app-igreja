-- Corrige lista vazia/incompleta no card Mudança de Papéis.
-- Execute TODO este arquivo no SQL Editor do Supabase.
--
-- Problemas corrigidos:
-- 1) family_acceptor / lider / events_admin não devem ocultar perfis da lista.
-- 2) Lista não filtra papéis protegidos — só bloqueia alteração na escrita.
-- 3) Ator com ACL do card (sem código pastoral) pode listar.
-- 4) Cria perfil mínimo para membros aceitos em members sem profiles.

-- ---------------------------------------------------------------------------
-- 1) Proteção só para escrita (super_admin / pastoral)
-- ---------------------------------------------------------------------------

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
       and ar.code in ('super_admin', 'pastoral')
  );
$$;

-- ---------------------------------------------------------------------------
-- 2) Ator: pastoral, super_admin ou ACL do card
-- ---------------------------------------------------------------------------

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

  if public.profile_has_role_code(p_actor_profile_id, 'pastoral') then
    return;
  end if;

  if public.profile_has_access(
    p_actor_profile_id,
    'screen',
    'maintenance.card.mudanca_papeis',
    'view'
  ) then
    return;
  end if;

  raise exception 'Apenas a Equipe Pastoral pode alterar papéis básicos por esta tela.';
end;
$$;

-- ---------------------------------------------------------------------------
-- 3) Perfis mínimos para membros aceitos sem profiles
-- ---------------------------------------------------------------------------

insert into public.profiles (full_name, phone, family_id, codigo_membro, is_active, lgpd_accepted)
select
  trim(m.full_name),
  nullif(trim(coalesce(m.phone, '')), ''),
  upper(trim(m.family_id)),
  upper(trim(m.family_id)),
  true,
  null
from public.members m
where m.accepted is true
  and nullif(trim(m.full_name), '') is not null
  and nullif(trim(coalesce(m.phone, '')), '') is not null
  and nullif(trim(coalesce(m.family_id, '')), '') is not null
  and not exists (
    select 1
      from public.profiles p
     where public.directory_person_matches_member(
       m.full_name,
       m.phone,
       p.full_name,
       p.phone
     )
  );

-- Papel visitantes para perfis novos sem qualquer papel ACL
do $$
declare
  r record;
begin
  for r in
    select p.id
      from public.profiles p
     where not exists (
       select 1
         from public.profile_access_roles par
        where par.profile_id = p.id
     )
  loop
    begin
      perform public.ensure_profile_visitantes_role(r.id);
    exception
      when undefined_function then
        null;
    end;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4) Listagem completa (sem filtro de papéis protegidos na leitura)
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
  membership_date date,
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
    p.membership_date,
    public.resolve_basic_role_code_for_profile(p.id) as current_role_code
  from public.profiles p
  where coalesce(
      nullif(trim(p.full_name), ''),
      nullif(trim(p.phone), ''),
      nullif(trim(p.codigo_membro), '')
    ) is not null
  order by trim(p.full_name) asc
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
  membership_date date,
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
    p.membership_date,
    public.resolve_basic_role_code_for_profile(p.id) as current_role_code
  from public.profiles p
  where (
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
  order by trim(p.full_name) asc
  limit v_limit;
end;
$$;

grant execute on function public.listar_perfis_mudanca_papel_pastoral(uuid, integer) to anon, authenticated;
grant execute on function public.buscar_perfis_mudanca_papel_pastoral(uuid, text, integer) to anon, authenticated;

-- Conferência
select
  count(*) as total_lista,
  count(*) filter (where current_role_code = 'member') as membros
from public.listar_perfis_mudanca_papel_pastoral(
  public.find_profile_id_by_phone('19996166161'),
  5000
);

notify pgrst, 'reload schema';

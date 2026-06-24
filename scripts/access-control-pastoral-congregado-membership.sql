-- Congregados na Mudança de Papéis: datas efetivas com herança familiar.
-- Execute no SQL Editor do Supabase após access-control-pastoral-membership-out.sql.

create or replace function public.is_family_guardian_relationship(p_relationship text)
returns boolean
language sql
immutable
as $$
  select public.family_relationship_display_rank(p_relationship) in (0, 3, 4);
$$;

create or replace function public.resolve_profile_guardian_profile_id(p_profile_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  with target as (
    select
      p.id,
      upper(nullif(trim(coalesce(p.family_id, '')), '')) as family_id
    from public.profiles p
    where p.id = p_profile_id
  )
  select gp.id
  from target t
  join public.members m
    on upper(trim(coalesce(m.family_id, ''))) = t.family_id
  join public.profiles gp
    on public.directory_person_matches_member(m.full_name, m.phone, gp.full_name, gp.phone)
  where t.family_id is not null
    and public.is_family_guardian_relationship(m.relationship)
    and gp.id <> t.id
  order by public.family_relationship_display_rank(m.relationship) asc, gp.full_name asc
  limit 1;
$$;

create or replace function public.resolve_effective_membership_dates_for_profile(p_profile_id uuid)
returns table (
  membership_date date,
  membership_out date,
  membership_inherited boolean,
  inherited_from_profile_id uuid,
  inherited_from_name text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role text;
  v_own_date date;
  v_own_out date;
  v_guardian_id uuid;
begin
  select
    public.resolve_basic_role_code_for_profile(p.id),
    p.membership_date,
    p.membership_out
  into v_role, v_own_date, v_own_out
  from public.profiles p
  where p.id = p_profile_id;

  if coalesce(v_role, '') <> 'congregado' then
    return query
    select v_own_date, v_own_out, false, null::uuid, null::text;
    return;
  end if;

  v_guardian_id := public.resolve_profile_guardian_profile_id(p_profile_id);

  if v_guardian_id is null then
    return query
    select v_own_date, v_own_out, false, null::uuid, null::text;
    return;
  end if;

  return query
  select
    gp.membership_date,
    gp.membership_out,
    true,
    gp.id,
    coalesce(nullif(trim(gp.full_name), ''), '(responsável)')
  from public.profiles gp
  where gp.id = v_guardian_id;
end;
$$;

create or replace function public.profile_membership_dates_are_inherited(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(e.membership_inherited, false)
  from public.resolve_effective_membership_dates_for_profile(p_profile_id) e
  limit 1;
$$;

drop function if exists public.listar_perfis_mudanca_papel_pastoral(uuid, integer);
drop function if exists public.buscar_perfis_mudanca_papel_pastoral(uuid, text, integer);

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
  where coalesce(
      nullif(trim(p.full_name), ''),
      nullif(trim(p.phone), ''),
      nullif(trim(p.codigo_membro), '')
    ) is not null
  order by p.full_name asc
  limit v_limit;
end;
$$;

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
  order by p.full_name asc
  limit v_limit;
end;
$$;

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
  v_role text;
begin
  perform public.assert_pastoral_role_change_actor(p_actor_profile_id);

  if p_target_profile_id is null then
    return jsonb_build_object('success', false, 'message', 'Perfil não informado.');
  end if;

  if not exists (select 1 from public.profiles p where p.id = p_target_profile_id) then
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
   where id = p_target_profile_id;

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

grant execute on function public.resolve_profile_guardian_profile_id(uuid) to anon, authenticated;
grant execute on function public.resolve_effective_membership_dates_for_profile(uuid) to anon, authenticated;
grant execute on function public.profile_membership_dates_are_inherited(uuid) to anon, authenticated;
grant execute on function public.atualizar_membership_date_perfil_pastoral(uuid, uuid, date, date)
  to anon, authenticated;

notify pgrst, 'reload schema';

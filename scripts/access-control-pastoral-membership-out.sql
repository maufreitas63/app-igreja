-- Data de desligamento (membership_out) na Mudança de Papéis.
-- Execute no SQL Editor do Supabase após access-control-pastoral-membership-date.sql.

alter table public.profiles
  add column if not exists membership_out date;

comment on column public.profiles.membership_out is
  'Data de desligamento da membresia (saída do corpo de membros).';

drop function if exists public.listar_perfis_mudanca_papel_pastoral(uuid, integer);
drop function if exists public.buscar_perfis_mudanca_papel_pastoral(uuid, text, integer);
drop function if exists public.atualizar_membership_date_perfil_pastoral(uuid, uuid, date);

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
    p.membership_out,
    public.resolve_basic_role_code_for_profile(p.id) as current_role_code
  from public.profiles p
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
    p.membership_out,
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

  if public.resolve_basic_role_code_for_profile(p_target_profile_id) <> 'member' then
    return jsonb_build_object(
      'success',
      false,
      'message',
      'As datas de membresia só podem ser editadas para perfis classificados como Membro.'
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

grant execute on function public.atualizar_membership_date_perfil_pastoral(uuid, uuid, date, date)
  to anon, authenticated;

notify pgrst, 'reload schema';

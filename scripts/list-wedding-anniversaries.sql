-- Lista de aniversários de casamento (RL + cônjuge) para o Início e Aniversariantes.
-- SECURITY DEFINER: mesma visibilidade ampla dos aniversários pessoais (profiles),
-- porque RLS de members só libera a própria família.
-- Aplica: npx supabase db query --linked -f scripts/list-wedding-anniversaries.sql

create or replace function public.list_wedding_anniversaries()
returns table (
  family_id text,
  full_name text,
  names text[],
  phone text,
  marriage_date date,
  day integer,
  month integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
begin
  if public.current_session_profile_id() is null then
    raise exception 'Sessão inválida.';
  end if;

  v_tenant := public.require_session_tenant_id();

  return query
  with family_dates as (
    select
      public.normalize_member_family_id(m.family_id) as family_id,
      min(m.marriage_date) as marriage_date
    from public.members m
    where m.tenant_id = v_tenant
      and m.accepted is true
      and m.marriage_date is not null
      and public.normalize_member_family_id(m.family_id) is not null
    group by 1
  ),
  family_people as (
    select
      public.normalize_member_family_id(m.family_id) as family_id,
      m.full_name,
      m.phone,
      m.marriage_date,
      public.normalize_member_name_for_sync(m.relationship) as rel_key
    from public.members m
    where m.tenant_id = v_tenant
      and m.accepted is true
      and public.normalize_member_family_id(m.family_id) in (
        select fd.family_id from family_dates fd
      )
  )
  select
    fd.family_id,
    case
      when nullif(trim(legal.full_name), '') is not null
           and nullif(trim(spouse.full_name), '') is not null then
        trim(legal.full_name) || ' e ' || trim(spouse.full_name)
      else coalesce(nullif(trim(legal.full_name), ''), nullif(trim(spouse.full_name), ''))
    end as full_name,
    array_remove(
      array[nullif(trim(legal.full_name), ''), nullif(trim(spouse.full_name), '')],
      null
    ) as names,
    coalesce(nullif(trim(legal.phone), ''), nullif(trim(spouse.phone), '')) as phone,
    coalesce(legal.marriage_date, spouse.marriage_date, fd.marriage_date) as marriage_date,
    extract(
      day from coalesce(legal.marriage_date, spouse.marriage_date, fd.marriage_date)
    )::integer as day,
    extract(
      month from coalesce(legal.marriage_date, spouse.marriage_date, fd.marriage_date)
    )::integer as month
  from family_dates fd
  left join lateral (
    select fp.full_name, fp.phone, fp.marriage_date
      from family_people fp
     where fp.family_id = fd.family_id
       and fp.rel_key = 'representante legal'
     order by fp.marriage_date nulls last, fp.full_name
     limit 1
  ) legal on true
  left join lateral (
    select fp.full_name, fp.phone, fp.marriage_date
      from family_people fp
     where fp.family_id = fd.family_id
       and fp.rel_key = 'conjuge'
     order by fp.marriage_date nulls last, fp.full_name
     limit 1
  ) spouse on true
  where coalesce(nullif(trim(legal.full_name), ''), nullif(trim(spouse.full_name), '')) is not null;
end;
$$;

grant execute on function public.list_wedding_anniversaries() to anon, authenticated;

notify pgrst, 'reload schema';

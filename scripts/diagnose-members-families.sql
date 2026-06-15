-- Diagnóstico: famílias na tabela members e integrantes por family_id.
-- Execute no SQL Editor do Supabase (somente leitura).

-- ---------------------------------------------------------------------------
-- 1) Resumo geral
-- ---------------------------------------------------------------------------
select
  count(*)::bigint as total_members,
  count(*) filter (where nullif(trim(coalesce(family_id, '')), '') is null)::bigint as sem_family_id,
  count(distinct upper(trim(family_id))) filter (
    where nullif(trim(coalesce(family_id, '')), '') is not null
  )::bigint as familias_distintas,
  count(*) filter (where accepted is true)::bigint as membros_aceitos,
  count(*) filter (where accepted is not true)::bigint as membros_nao_aceitos
from public.members;

-- ---------------------------------------------------------------------------
-- 2) Quantidade de membros por família (ordenado por tamanho da família)
-- ---------------------------------------------------------------------------
with families as (
  select
    upper(trim(m.family_id)) as family_id,
    count(*)::integer as total_membros,
    count(*) filter (where m.accepted is true)::integer as aceitos,
    count(*) filter (where m.accepted is not true)::integer as nao_aceitos,
    min(m.created_at) as primeiro_cadastro,
    max(m.created_at) as ultimo_cadastro
  from public.members m
  where nullif(trim(coalesce(m.family_id, '')), '') is not null
  group by upper(trim(m.family_id))
)
select
  family_id,
  total_membros,
  aceitos,
  nao_aceitos,
  primeiro_cadastro,
  ultimo_cadastro
from families
order by total_membros desc, family_id asc;

-- ---------------------------------------------------------------------------
-- 3) Lista detalhada: membros agrupados por família
-- ---------------------------------------------------------------------------
select
  upper(trim(m.family_id)) as family_id,
  m.id as member_id,
  trim(m.full_name) as full_name,
  nullif(trim(coalesce(m.phone, '')), '') as phone,
  nullif(trim(coalesce(m.relationship, '')), '') as relationship,
  m.accepted,
  m.birth_date,
  m.created_at
from public.members m
where nullif(trim(coalesce(m.family_id, '')), '') is not null
order by
  upper(trim(m.family_id)) asc,
  case lower(trim(translate(
    coalesce(m.relationship, ''),
    'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
    'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN'
  )))
    when 'representante legal' then 0
    when 'conjuge' then 1
    when 'cônjuge' then 1
    when 'filho(a)' then 2
    when 'filho' then 2
    when 'filha' then 2
    when 'pai' then 3
    when 'mae' then 4
    when 'mãe' then 4
    when 'outros' then 5
    else 99
  end,
  trim(m.full_name) asc;

-- ---------------------------------------------------------------------------
-- 4) Famílias com apenas 1 membro (possível cadastro incompleto)
-- ---------------------------------------------------------------------------
with families as (
  select upper(trim(m.family_id)) as family_id
  from public.members m
  where nullif(trim(coalesce(m.family_id, '')), '') is not null
  group by upper(trim(m.family_id))
  having count(*) = 1
)
select
  upper(trim(m.family_id)) as family_id,
  m.id as member_id,
  trim(m.full_name) as full_name,
  m.accepted,
  nullif(trim(coalesce(m.phone, '')), '') as phone
from public.members m
join families f on f.family_id = upper(trim(m.family_id))
order by family_id asc;

-- ---------------------------------------------------------------------------
-- 5) Mesmo family_id com profiles divergentes (profiles x members)
-- ---------------------------------------------------------------------------
select
  upper(trim(m.family_id)) as family_id,
  count(distinct m.id)::integer as members_na_familia,
  count(distinct p.id)::integer as profiles_com_codigo_diferente,
  string_agg(
    distinct coalesce(
      nullif(trim(coalesce(p.family_id, '')), ''),
      nullif(trim(coalesce(p.codigo_membro, '')), '')
    ),
    ', '
    order by coalesce(
      nullif(trim(coalesce(p.family_id, '')), ''),
      nullif(trim(coalesce(p.codigo_membro, '')), '')
    )
  ) as codigos_em_profiles
from public.members m
left join public.profiles p
  on (
    nullif(regexp_replace(coalesce(p.phone, ''), '\D', '', 'g'), '') is not null
    and regexp_replace(coalesce(p.phone, ''), '\D', '', 'g')
      = regexp_replace(coalesce(m.phone, ''), '\D', '', 'g')
  )
  or lower(trim(coalesce(p.full_name, ''))) = lower(trim(coalesce(m.full_name, '')))
where nullif(trim(coalesce(m.family_id, '')), '') is not null
group by upper(trim(m.family_id))
having count(distinct coalesce(
  nullif(trim(coalesce(p.family_id, '')), ''),
  nullif(trim(coalesce(p.codigo_membro, '')), '')
)) > 1
order by family_id asc;

-- ---------------------------------------------------------------------------
-- 6) Diagnóstico IBN0103: members x profiles x o que o card members_list veria
--    (requer members-list-family-sync.sql aplicado para coluna family_id_no_card)
-- ---------------------------------------------------------------------------
-- select * from public.list_members_family_directory('IBN0103');
-- select * from public.list_profiles_family_directory_by_code('IBN0103', false);

select
  upper(trim(m.family_id)) as family_id,
  m.id as member_id,
  trim(m.full_name) as member_name,
  nullif(trim(coalesce(m.phone, '')), '') as member_phone,
  p.id as profile_id,
  trim(p.full_name) as profile_name,
  public.profile_directory_family_code(p.family_id, p.codigo_membro) as profile_family_code,
  m.accepted
from public.members m
left join public.profiles p
  on (
    nullif(regexp_replace(coalesce(p.phone, ''), '\D', '', 'g'), '') is not null
    and regexp_replace(coalesce(p.phone, ''), '\D', '', 'g')
      = regexp_replace(coalesce(m.phone, ''), '\D', '', 'g')
  )
  or lower(trim(coalesce(p.full_name, ''))) = lower(trim(coalesce(m.full_name, '')))
where upper(trim(m.family_id)) = 'IBN0103'
order by trim(m.full_name) asc;

-- Preenche CEP válido em perfis [GEO] sem CEP (Massaguaçu — Caraguatatuba/SP).
-- CEPs reais da região de Massaguaçu (faixa 11676-xxx).
--
-- Pré-requisito opcional: public.normalize_profile_cep_digits
-- (scripts/profiles-cep-validation-report.sql)
--
-- Execute no SQL Editor do Supabase.

create or replace function public.normalize_profile_cep_digits(p_cep text)
returns text
language sql
immutable
as $$
  select nullif(regexp_replace(coalesce(p_cep, ''), '[^0-9]', '', 'g'), '')
$$;

-- ---------------------------------------------------------------------------
-- Antes
-- ---------------------------------------------------------------------------

select
  count(*)::bigint as geo_sem_cep_valido_antes
from public.profiles p
where p.full_name like '[GEO]%'
  and length(public.normalize_profile_cep_digits(p.cep)) is distinct from 8;

-- ---------------------------------------------------------------------------
-- Atualização
-- ---------------------------------------------------------------------------

with massaguacu_ceps (cep) as (
  values
    ('11676-010'), -- Rod. Dr. Manoel Hipólito do Rego
    ('11676-020'),
    ('11676-030'),
    ('11676-040'),
    ('11676-050'),
    ('11676-060'),
    ('11676-070'),
    ('11676-080'),
    ('11676-090'),
    ('11676-100'), -- Rua da Praia de Massaguaçu
    ('11676-110'),
    ('11676-120'),
    ('11676-150'),
    ('11676-200'),
    ('11676-250'),
    ('11676-300'),
    ('11676-400')
),
targets as (
  select
    p.id,
    (
      select c.cep
      from massaguacu_ceps c
      order by random()
      limit 1
    ) as new_cep
  from public.profiles p
  where p.full_name like '[GEO]%'
    and length(public.normalize_profile_cep_digits(p.cep)) is distinct from 8
)
update public.profiles p
set
  cep = t.new_cep,
  updated_at = now()
from targets t
where p.id = t.id;

-- ---------------------------------------------------------------------------
-- Depois
-- ---------------------------------------------------------------------------

select
  count(*)::bigint as geo_total,
  count(*) filter (
    where length(public.normalize_profile_cep_digits(p.cep)) = 8
  )::bigint as geo_com_cep_valido,
  count(*) filter (
    where length(public.normalize_profile_cep_digits(p.cep)) is distinct from 8
  )::bigint as geo_sem_cep_valido_depois
from public.profiles p
where p.full_name like '[GEO]%';

select
  p.full_name,
  p.cep,
  p.address_neighborhood,
  p.address_city,
  p.address_state
from public.profiles p
where p.full_name like '[GEO]%'
order by p.full_name;

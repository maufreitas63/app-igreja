-- Conferência de CEPs em public.profiles
-- Regra alinhada ao app (lib/geoMapGeocoding.ts → normalizeCepDigits):
--   válido = exatamente 8 dígitos após remover tudo que não for número.
--
-- Execute no SQL Editor do Supabase.

create or replace function public.normalize_profile_cep_digits(p_cep text)
returns text
language sql
immutable
as $$
  select nullif(regexp_replace(coalesce(p_cep, ''), '[^0-9]', '', 'g'), '')
$$;

comment on function public.normalize_profile_cep_digits(text) is
  'Extrai apenas dígitos do CEP; retorna null se vazio.';

-- ---------------------------------------------------------------------------
-- 1) Resumo geral
-- ---------------------------------------------------------------------------

with profile_ceps as (
  select
    p.id,
    p.full_name,
    p.cep,
    public.normalize_profile_cep_digits(p.cep) as cep_digits,
    length(public.normalize_profile_cep_digits(p.cep)) as cep_digit_count
  from public.profiles p
),
classified as (
  select
    *,
    case
      when cep is null or btrim(cep) = '' then 'sem_cep'
      when cep_digit_count = 8 then 'cep_valido'
      else 'cep_invalido'
    end as cep_status
  from profile_ceps
)
select
  count(*)::bigint as total_perfis,
  count(*) filter (where cep_status = 'cep_valido')::bigint as ceps_validos,
  count(*) filter (where cep_status = 'cep_invalido')::bigint as ceps_invalidos,
  count(*) filter (where cep_status = 'sem_cep')::bigint as sem_cep,
  round(
    100.0 * count(*) filter (where cep_status = 'cep_valido') / nullif(count(*), 0),
    2
  ) as percentual_validos
from classified;

-- ---------------------------------------------------------------------------
-- 2) Detalhe dos inválidos (amostra para correção)
-- ---------------------------------------------------------------------------

with profile_ceps as (
  select
    p.id,
    p.full_name,
    p.phone,
    p.cep,
    public.normalize_profile_cep_digits(p.cep) as cep_digits,
    length(public.normalize_profile_cep_digits(p.cep)) as cep_digit_count
  from public.profiles p
)
select
  id,
  full_name,
  phone,
  cep as cep_original,
  cep_digits,
  cep_digit_count
from profile_ceps
where cep is not null
  and btrim(cep) <> ''
  and cep_digit_count is distinct from 8
order by full_name
limit 100;

-- ---------------------------------------------------------------------------
-- 3) CEPs válidos repetidos (útil para mapa / geocodificação)
-- ---------------------------------------------------------------------------

with valid_ceps as (
  select public.normalize_profile_cep_digits(p.cep) as cep_digits
  from public.profiles p
  where length(public.normalize_profile_cep_digits(p.cep)) = 8
)
select
  cep_digits,
  count(*)::bigint as perfis_com_esse_cep
from valid_ceps
group by cep_digits
having count(*) > 1
order by perfis_com_esse_cep desc, cep_digits
limit 50;

-- ---------------------------------------------------------------------------
-- 4) Opcional: CEP com 8 dígitos mas suspeito (todos zeros)
-- ---------------------------------------------------------------------------

select
  count(*)::bigint as ceps_8_digitos_todos_zeros
from public.profiles p
where public.normalize_profile_cep_digits(p.cep) = '00000000';

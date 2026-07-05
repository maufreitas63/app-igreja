-- Quantidade de Membros e Congregados ATIVOS por faixa etária.
-- Faixas: Infantil (0–11), Adolescente (12–17), Jovem (18–29), Adulto (30–59), 60+ (60+).
--
-- Pré-requisitos no Supabase:
--   access-control-pastoral-role-change.sql (resolve_basic_role_code_for_profile)
--   access-control-pastoral-congregado-membership.sql (membership efetiva de congregados)
--
-- Ativo = membership_out efetiva vazia (mesma regra do app e dos relatórios de manutenção).

-- ---------------------------------------------------------------------------
-- Helper: faixa etária a partir de birth_date
-- ---------------------------------------------------------------------------

create or replace function public.profile_age_category_label(p_birth_date date)
returns text
language sql
immutable
as $$
  select case
    when p_birth_date is null then 'Sem data de nascimento'
    else (
      case
        when date_part('year', age(current_date, p_birth_date))::int between 0 and 11 then 'Infantil'
        when date_part('year', age(current_date, p_birth_date))::int between 12 and 17 then 'Adolescente'
        when date_part('year', age(current_date, p_birth_date))::int between 18 and 29 then 'Jovem'
        when date_part('year', age(current_date, p_birth_date))::int between 30 and 59 then 'Adulto'
        when date_part('year', age(current_date, p_birth_date))::int >= 60 then '60+'
        else 'Sem data de nascimento'
      end
    )
  end;
$$;

comment on function public.profile_age_category_label(date) is
  'Classifica perfil em Infantil, Adolescente, Jovem, Adulto, 60+ ou Sem data de nascimento.';

-- ---------------------------------------------------------------------------
-- Consulta principal (formato longo: tipo × categoria × quantidade)
-- ---------------------------------------------------------------------------

with ativos as (
  select
    p.id as profile_id,
    coalesce(nullif(trim(p.full_name), ''), nullif(trim(p.phone), ''), '(sem nome)') as nome,
    p.birth_date,
    public.resolve_basic_role_code_for_profile(p.id) as role_code,
    public.profile_age_category_label(p.birth_date) as categoria
  from public.profiles p
  cross join lateral public.resolve_effective_membership_dates_for_profile(p.id) eff
  where coalesce(
      nullif(trim(p.full_name), ''),
      nullif(trim(p.phone), ''),
      nullif(trim(p.codigo_membro), '')
    ) is not null
    and coalesce(p.codigo_membro, '') not ilike 'TstMax%'
    and public.resolve_basic_role_code_for_profile(p.id) in ('member', 'congregado')
    and coalesce(eff.membership_out::text, '') = ''
)
select
  case a.role_code
    when 'member' then 'Membros'
    when 'congregado' then 'Congregados'
    else a.role_code
  end as tipo,
  a.categoria,
  count(*)::bigint as quantidade
from ativos a
group by a.role_code, a.categoria
order by
  case a.role_code when 'member' then 1 when 'congregado' then 2 else 99 end,
  case a.categoria
    when 'Infantil' then 1
    when 'Adolescente' then 2
    when 'Jovem' then 3
    when 'Adulto' then 4
    when '60+' then 5
    else 99
  end;

-- ---------------------------------------------------------------------------
-- Mesma base em formato pivot (linhas = Membros/Congregados, colunas = faixas)
-- ---------------------------------------------------------------------------

with ativos as (
  select
    p.id as profile_id,
    public.resolve_basic_role_code_for_profile(p.id) as role_code,
    public.profile_age_category_label(p.birth_date) as categoria
  from public.profiles p
  cross join lateral public.resolve_effective_membership_dates_for_profile(p.id) eff
  where coalesce(
      nullif(trim(p.full_name), ''),
      nullif(trim(p.phone), ''),
      nullif(trim(p.codigo_membro), '')
    ) is not null
    and coalesce(p.codigo_membro, '') not ilike 'TstMax%'
    and public.resolve_basic_role_code_for_profile(p.id) in ('member', 'congregado')
    and coalesce(eff.membership_out::text, '') = ''
),
contagens as (
  select
    case a.role_code
      when 'member' then 'Membros'
      when 'congregado' then 'Congregados'
      else a.role_code
    end as tipo,
    a.categoria,
    count(*)::bigint as quantidade
  from ativos a
  group by a.role_code, a.categoria
)
select
  c.tipo,
  coalesce(sum(c.quantidade) filter (where c.categoria = 'Infantil'), 0)::bigint as infantil,
  coalesce(sum(c.quantidade) filter (where c.categoria = 'Adolescente'), 0)::bigint as adolescente,
  coalesce(sum(c.quantidade) filter (where c.categoria = 'Jovem'), 0)::bigint as jovem,
  coalesce(sum(c.quantidade) filter (where c.categoria = 'Adulto'), 0)::bigint as adulto,
  coalesce(sum(c.quantidade) filter (where c.categoria = '60+'), 0)::bigint as "60_mais",
  coalesce(sum(c.quantidade) filter (where c.categoria = 'Sem data de nascimento'), 0)::bigint as sem_data_nascimento,
  sum(c.quantidade)::bigint as total
from contagens c
group by c.tipo
order by case c.tipo when 'Membros' then 1 when 'Congregados' then 2 else 99 end;

-- ---------------------------------------------------------------------------
-- Totais gerais (opcional)
-- ---------------------------------------------------------------------------

with ativos as (
  select p.id
  from public.profiles p
  cross join lateral public.resolve_effective_membership_dates_for_profile(p.id) eff
  where coalesce(
      nullif(trim(p.full_name), ''),
      nullif(trim(p.phone), ''),
      nullif(trim(p.codigo_membro), '')
    ) is not null
    and coalesce(p.codigo_membro, '') not ilike 'TstMax%'
    and public.resolve_basic_role_code_for_profile(p.id) in ('member', 'congregado')
    and coalesce(eff.membership_out::text, '') = ''
)
select count(*)::bigint as total_ativos_membros_e_congregados
from ativos;

grant execute on function public.profile_age_category_label(date) to anon, authenticated;

notify pgrst, 'reload schema';

-- =============================================================================
-- UAT IBEP — checagens SOMENTE LEITURA (não altera IBN nem IBEP)
-- =============================================================================
-- Execute após testes manuais na IBEP para confirmar isolamento.
-- Substitua :ibep_id / :ibn_id se necessário (ou use os selects abaixo).
-- =============================================================================

-- 0) IDs das instâncias
select id, code, name, is_active
  from public.igrejas
 where upper(trim(code)) in ('IBN', 'IBEP')
 order by code;

-- 1) Contagens por tenant (baseline / pós-teste)
with tenants as (
  select id, code from public.igrejas where upper(trim(code)) in ('IBN', 'IBEP')
)
select
  t.code,
  (select count(*) from public.profiles p where p.tenant_id = t.id) as profiles_tenant,
  (select count(*) from public.profile_igreja_vinculos v where v.tenant_id = t.id and v.is_active) as vinculos,
  (select count(*) from public.events e where e.tenant_id = t.id) as events
from tenants t
order by t.code;

-- 2) Confirme que seu perfil de login tem vínculo IBEP ativo
-- Ajuste o telefone:
with params as (select '19996166161'::text as phone_digits)
select
  p.id,
  p.full_name,
  public.is_super_admin_profile(p.id) as is_sa,
  i.code,
  v.is_primary,
  v.is_active
from params
join lateral public.find_profile_id_by_phone(params.phone_digits) lp(profile_id) on true
join public.profiles p on p.id = lp.profile_id
left join public.profile_igreja_vinculos v on v.profile_id = p.id and v.is_active
left join public.igrejas i on i.id = v.tenant_id
order by i.code;

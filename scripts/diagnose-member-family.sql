-- Diagnóstico: membro não aparece em Membros Cadastrados / audiência.
-- Ajuste os telefones em params e execute TODO o arquivo no SQL Editor do Supabase.

-- 1) Família do gestor (titular que adiciona o membro)
with params as (
  select '19996166161'::text as manager_phone
),
normalized as (
  select
    manager_phone,
    case
      when manager_phone like '55%' and length(manager_phone) >= 12
        then substring(manager_phone from 3)
      else manager_phone
    end as phone_local
  from params
)
select
  'manager_profile' as source,
  p.id,
  p.full_name,
  p.phone,
  p.family_id,
  p.codigo_membro
from public.profiles p
cross join normalized n
where regexp_replace(coalesce(p.phone, ''), '\D', '', 'g') in (n.manager_phone, n.phone_local, '55' || n.phone_local)
order by p.updated_at desc nulls last;

-- 2) Membro adicionado (deve estar na mesma family_id do gestor, accepted = true)
with params as (
  select '19988262617'::text as member_phone
),
normalized as (
  select
    member_phone,
    case
      when member_phone like '55%' and length(member_phone) >= 12
        then substring(member_phone from 3)
      else member_phone
    end as phone_local
  from params
)
select
  'member_rows' as source,
  m.id,
  m.full_name,
  m.phone,
  m.family_id,
  m.accepted,
  m.relationship,
  m.created_at
from public.members m
cross join normalized n
where regexp_replace(coalesce(m.phone, ''), '\D', '', 'g') in (n.member_phone, n.phone_local, '55' || n.phone_local)
   or m.phone ilike '%8826-2617%'
order by m.family_id, m.created_at desc;

-- 3) Perfil do membro adicionado
with params as (
  select '19988262617'::text as member_phone
),
normalized as (
  select
    member_phone,
    case
      when member_phone like '55%' and length(member_phone) >= 12
        then substring(member_phone from 3)
      else member_phone
    end as phone_local
  from params
)
select
  'member_profile' as source,
  p.id,
  p.full_name,
  p.phone,
  p.family_id,
  p.codigo_membro
from public.profiles p
cross join normalized n
where regexp_replace(coalesce(p.phone, ''), '\D', '', 'g') in (n.member_phone, n.phone_local, '55' || n.phone_local)
   or p.phone ilike '%8826-2617%'
order by p.updated_at desc nulls last;

-- Correção manual (somente após conferir a family_id do gestor no bloco 1):
-- update public.members
--    set family_id = '<FAMILY_ID_DO_GESTOR>', accepted = true
--  where id = '<uuid-do-membro-correto>';

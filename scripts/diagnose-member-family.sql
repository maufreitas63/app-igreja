-- Diagnóstico: membro não aparece no grupo familiar após transferência.
-- Ajuste o telefone em params (bloco 1) e execute TODO o arquivo no SQL Editor do Supabase.

-- 1) Registros em members (define quem aparece no grupo familiar)
with params as (
  select '19988262617'::text as phone_digits
),
normalized as (
  select
    phone_digits,
    case
      when phone_digits like '55%' and length(phone_digits) >= 12
        then substring(phone_digits from 3)
      else phone_digits
    end as phone_local
  from params
)
select
  'members' as source,
  m.id,
  m.full_name,
  m.phone,
  m.family_id,
  m.accepted,
  m.relationship,
  m.created_at
from public.members m
cross join normalized n
where regexp_replace(coalesce(m.phone, ''), '\D', '', 'g') in (n.phone_digits, n.phone_local, '55' || n.phone_local)
   or m.phone ilike '%8826-2617%'
order by m.family_id, m.created_at desc;

-- 2) Registros em profiles (cadastro do usuário)
with params as (
  select '19988262617'::text as phone_digits
),
normalized as (
  select
    phone_digits,
    case
      when phone_digits like '55%' and length(phone_digits) >= 12
        then substring(phone_digits from 3)
      else phone_digits
    end as phone_local
  from params
)
select
  'profiles' as source,
  p.id,
  p.full_name,
  p.phone,
  p.family_id,
  p.codigo_membro
from public.profiles p
cross join normalized n
where regexp_replace(coalesce(p.phone, ''), '\D', '', 'g') in (n.phone_digits, n.phone_local, '55' || n.phone_local)
   or p.phone ilike '%8826-2617%'
order by p.updated_at desc nulls last;

-- Correção manual (somente se o diagnóstico mostrar family_id errado ou accepted = false):
-- update public.members
--    set family_id = 'IBN0001', accepted = true
--  where id = '<uuid-do-membro-correto>';

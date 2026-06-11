-- Diagnóstico do Controle de Acesso (gestor).
-- Execute TUDO no SQL Editor do Supabase e cole aqui os 3 resultados (A, B e C).

-- ========== A) Todos os perfis com este telefone ==========
with params as (
  select '19996166161'::text as phone_digits
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
  'A_perfis' as secao,
  p.id,
  p.full_name,
  p.phone,
  public.normalize_profile_phone(p.phone) as phone_normalized,
  p.updated_at,
  public.is_super_admin_profile(p.id) as is_super_admin,
  public.profile_has_access(p.id, 'screen', '/maintenance-dashboard', 'view') as can_maintenance,
  coalesce(
    (
      select string_agg(ar.code, ', ' order by ar.code)
        from public.profile_access_roles par
        join public.access_roles ar on ar.id = par.role_id
       where par.profile_id = p.id
    ),
    '(sem papéis)'
  ) as roles
from public.profiles p
cross join normalized n
where public.normalize_profile_phone(p.phone) = n.phone_digits
   or public.normalize_profile_phone(p.phone) = n.phone_local
   or public.normalize_profile_phone(p.phone) = '55' || n.phone_local
   or p.phone ilike '%99616-6161%'
order by p.updated_at desc nulls last;

-- ========== B) Qual perfil o LOGIN usa hoje ==========
select
  'B_login' as secao,
  public.find_profile_id_by_phone('19996166161') as login_profile_id,
  p.full_name as login_profile_name,
  p.phone as login_profile_phone,
  public.is_super_admin_profile(p.id) as login_is_super_admin,
  public.profile_has_access(p.id, 'screen', '/maintenance-dashboard', 'view') as login_can_maintenance
from public.profiles p
where p.id = public.find_profile_id_by_phone('19996166161');

-- ========== C) Funções ACL existem? ==========
select
  'C_funcoes' as secao,
  exists (
    select 1
      from pg_proc
     where proname = 'is_super_admin_profile'
       and pronamespace = 'public'::regnamespace
  ) as has_is_super_admin_profile,
  exists (
    select 1
      from pg_proc
     where proname = 'find_profile_id_by_phone'
       and pronamespace = 'public'::regnamespace
  ) as has_find_profile_id_by_phone,
  exists (
    select 1
      from public.access_roles ar
     where ar.code = 'super_admin'
  ) as has_super_admin_role;

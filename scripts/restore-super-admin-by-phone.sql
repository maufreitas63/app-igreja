-- Restaura papel super_admin para um telefone (gestor / psw_mngr).
-- Ajuste o telefone na CTE params e execute no SQL Editor do Supabase.
-- Depois rode scripts/find-profile-prefer-super-admin.sql para o login priorizar este perfil.

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
),
target_profile as (
  select p.id as profile_id, p.full_name, p.phone, p.updated_at
    from public.profiles p
    cross join normalized n
   where public.normalize_profile_phone(p.phone) = n.phone_digits
      or public.normalize_profile_phone(p.phone) = n.phone_local
      or public.normalize_profile_phone(p.phone) = '55' || n.phone_local
   order by
     case when public.is_super_admin_profile(p.id) then 0 else 1 end,
     p.updated_at desc nulls last
   limit 1
),
super_admin_role as (
  select ar.id as role_id
    from public.access_roles ar
   where ar.code = 'super_admin'
   limit 1
)
insert into public.profile_access_roles (profile_id, role_id)
select tp.profile_id, sar.role_id
  from target_profile tp
  cross join super_admin_role sar
 where tp.profile_id is not null
   and sar.role_id is not null
on conflict (profile_id, role_id) do nothing;

-- Conferência:
with params as (
  select '19996166161'::text as phone_digits
)
select
  p.id,
  p.full_name,
  p.phone,
  public.is_super_admin_profile(p.id) as is_super_admin,
  public.find_profile_id_by_phone((select phone_digits from params)) as login_resolves_to,
  public.profile_has_access(p.id, 'screen', 'maintenance.card.access_control', 'view') as can_access_control
from public.profiles p
where p.id = public.find_profile_id_by_phone((select phone_digits from params));

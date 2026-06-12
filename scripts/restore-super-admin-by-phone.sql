-- Restaura super_admin no perfil que o LOGIN realmente usa.
-- Ajuste o telefone em params e execute no Supabase.
-- Depois: scripts/find-profile-prefer-super-admin.sql (se ainda não rodou).

with params as (
  select '19996166161'::text as phone_digits
),
login_profile as (
  select public.find_profile_id_by_phone((select phone_digits from params)) as profile_id
),
super_admin_role as (
  select ar.id as role_id
    from public.access_roles ar
   where ar.code = 'super_admin'
   limit 1
)
insert into public.profile_access_roles (profile_id, role_id)
select lp.profile_id, sar.role_id
  from login_profile lp
  cross join super_admin_role sar
 where lp.profile_id is not null
   and sar.role_id is not null
on conflict (profile_id, role_id) do nothing;

-- Conferência (cole este resultado se ainda não funcionar no app):
with params as (
  select '19996166161'::text as phone_digits
)
select
  p.id,
  p.full_name,
  p.phone,
  public.is_super_admin_profile(p.id) as is_super_admin,
  public.find_profile_id_by_phone((select phone_digits from params)) as login_resolves_to,
  case
    when p.id = public.find_profile_id_by_phone((select phone_digits from params))
     and public.is_super_admin_profile(p.id)
    then 'OK — login e super_admin alinhados'
    when p.id = public.find_profile_id_by_phone((select phone_digits from params))
     and not public.is_super_admin_profile(p.id)
    then 'ERRO — login aponta para perfil sem super_admin'
    else 'outro perfil'
  end as status
from public.profiles p
cross join params
where p.id = public.find_profile_id_by_phone(params.phone_digits);

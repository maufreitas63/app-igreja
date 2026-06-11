-- Diagnóstico: perfis duplicados, papéis ACL e acesso ao app.
-- Ajuste o telefone na CTE abaixo e execute no SQL Editor do Supabase.

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
  p.id,
  p.full_name,
  p.phone,
  public.normalize_profile_phone(p.phone) as phone_normalized,
  p.lgpd_accepted,
  p.updated_at,
  public.is_super_admin_profile(p.id) as is_super_admin,
  public.profile_has_access(p.id, 'screen', '/maintenance-dashboard', 'view') as can_maintenance,
  public.profile_has_access(p.id, 'screen', 'maintenance.card.access_control', 'view') as can_access_control,
  public.profile_has_access(p.id, 'screen', 'dashboard.card.members_list', 'view') as can_members_list,
  public.profile_has_access(p.id, 'screen', 'dashboard.card.financial', 'view') as can_financial,
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
order by
  case when public.is_super_admin_profile(p.id) then 0 else 1 end,
  p.updated_at desc nulls last;

-- Perfil que o login RPC escolheria hoje:
select public.find_profile_id_by_phone('19996166161') as resolved_profile_id;

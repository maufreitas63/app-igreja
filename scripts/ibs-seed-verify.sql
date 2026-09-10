-- Conferência da carga IBS (somente leitura).
-- IBN vinculos ativos: 69 | IBN financials: 948 | IBEP vinculos: 2

select 'IBS_login' as metric, count(*)::text as value
  from public.profiles p
  join public.profile_igreja_vinculos v
    on v.profile_id = p.id
   and v.tenant_id = '81295e39-9167-40b4-a524-702439905e75'
   and v.is_active
 where p.is_active
   and p.family_id ~ '^IBS9[0-9]{3}$'
union all
select 'role_' || ar.code, count(*)::text
  from public.profile_access_roles par
  join public.access_roles ar on ar.id = par.role_id
  join public.profiles p on p.id = par.profile_id
 where p.family_id ~ '^IBS9[0-9]{3}$'
 group by ar.code
union all
select 'IBS_rooms', count(*)::text from public.church_room_settings
 where tenant_id = '81295e39-9167-40b4-a524-702439905e75'
union all
select 'IBS_livros', count(*)::text from public.livros
 where tenant_id = '81295e39-9167-40b4-a524-702439905e75'
union all
select 'IBN_vinculos', count(*)::text from public.profile_igreja_vinculos
 where tenant_id = 'a0000000-0000-4000-8000-000000000001' and is_active
union all
select 'IBN_financials', count(*)::text from public.financials
 where tenant_id = 'a0000000-0000-4000-8000-000000000001'
union all
select 'IBEP_vinculos', count(*)::text from public.profile_igreja_vinculos
 where tenant_id = '68b9e46e-a5e9-45b5-9124-ffa3447d14f4' and is_active;

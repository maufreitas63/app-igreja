-- Remove o papel Visitantes automático dos perfis IBS da carga (IBS9xxx),
-- mantendo-o apenas nos visitantes adultos sem outro papel de vínculo.
begin;
set local row_security = off;

delete from public.profile_access_roles par
 using public.access_roles ar, public.profiles p
 where par.role_id = ar.id
   and ar.code = 'visitantes'
   and par.profile_id = p.id
   and p.family_id ~ '^IBS9[0-9]{3}$'
   and (
     coalesce(p.is_active, false) is not true
     or exists (
       select 1
         from public.profile_access_roles par2
         join public.access_roles ar2 on ar2.id = par2.role_id
        where par2.profile_id = p.id
          and ar2.code in ('member', 'congregado', 'pastoral')
     )
   );

commit;

select ar.code, count(*)
  from public.profile_access_roles par
  join public.access_roles ar on ar.id = par.role_id
  join public.profiles p on p.id = par.profile_id
 where p.family_id ~ '^IBS9[0-9]{3}$'
 group by ar.code
 order by 1;

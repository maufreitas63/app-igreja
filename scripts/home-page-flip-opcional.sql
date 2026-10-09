-- Page Flip da home é opcional por instância (app_parameters.Page_Flip).
-- Só `sim` liga o efeito. Este script deixa `nao` em todas as igrejas.
-- Aplica: npx supabase db query --linked -f scripts/home-page-flip-opcional.sql

begin;

insert into public.app_parameters (parameter, value, tenant_id)
select 'Page_Flip', 'nao', i.id
  from public.igrejas i
 where not exists (
   select 1
     from public.app_parameters ap
    where ap.tenant_id = i.id
      and lower(trim(ap.parameter)) = 'page_flip'
 );

update public.app_parameters
   set value = 'nao',
       parameter = 'Page_Flip'
 where lower(trim(parameter)) = 'page_flip'
   and tenant_id is not null;

notify pgrst, 'reload schema';

commit;

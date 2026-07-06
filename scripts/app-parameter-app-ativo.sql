-- Parâmetros globais de disponibilidade do aplicativo.
-- sim  = acesso normal
-- nao  = bloqueio global (exceto super_admin)
--
-- Alterável no card Controle de Acesso (manutenção).
-- Requer: scripts/app-active-access-control.sql (RPC + ACL)

insert into public.app_parameters (parameter, value)
select 'app_ativo', 'sim'
 where not exists (
   select 1
     from public.app_parameters ap
    where lower(trim(ap.parameter)) = lower('app_ativo')
 );

insert into public.app_parameters (parameter, value)
select 'app_inativo_msg',
       'O aplicativo está temporariamente indisponível. Tente novamente mais tarde.'
 where not exists (
   select 1
     from public.app_parameters ap
    where lower(trim(ap.parameter)) = lower('app_inativo_msg')
 );

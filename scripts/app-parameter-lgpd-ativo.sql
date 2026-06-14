-- Parâmetro global: liga/desliga o módulo LGPD no aplicativo.
-- sim  = fluxo completo (termos, aceite/recusa, selfie no cadastro; tela /lgpd no login)
-- nao  = cadastro só com dados básicos → Índice; login e sessão vão direto ao Índice
--
-- Alterável no card Controle de Acesso (manutenção).
-- Requer: scripts/salvar-app-parameter-admin.sql (RPC + políticas RLS super_admin)

update public.app_parameters
   set value = 'sim'
 where lower(parameter) = lower('LGPD_Ativo');

insert into public.app_parameters (parameter, value)
select 'LGPD_Ativo', 'sim'
 where not exists (
   select 1
     from public.app_parameters ap
    where lower(ap.parameter) = lower('LGPD_Ativo')
 );

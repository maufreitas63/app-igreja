-- Parâmetro global: liga/desliga o módulo LGPD no aplicativo.
-- sim  = fluxo completo (termos, aceite/recusa, selfie no cadastro; tela /lgpd no login)
-- nao  = cadastro só com dados básicos → Índice; login e sessão vão direto ao Índice
--
-- Alterável no card Controle de Acesso (manutenção).

insert into public.app_parameters (parameter, value)
values ('LGPD_Ativo', 'sim')
on conflict (parameter) do update
set value = excluded.value;

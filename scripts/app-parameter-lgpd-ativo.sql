-- Parâmetro global: liga/desliga o módulo LGPD no aplicativo.
-- sim  = LGPD Ativo (alerta vermelho e fluxo de termos habilitados)
-- nao  = LGPD Inativo (sem alerta de pendência no app)
--
-- Alterável também no card Controle de Acesso (manutenção).

insert into public.app_parameters (parameter, value)
values ('LGPD_Ativo', 'sim')
on conflict (parameter) do update
set value = excluded.value;

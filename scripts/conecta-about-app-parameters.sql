-- Versão e revisão do Conecta+ por instância (app_parameters.tenant_id).
-- Leitura via get_app_parameter_value (sessão / tenant ativo).

insert into public.app_parameters (tenant_id, parameter, value)
select i.id, 'conecta_versao', '1.0.0'
  from public.igrejas i
 where not exists (
   select 1
     from public.app_parameters ap
    where ap.tenant_id = i.id
      and lower(trim(ap.parameter)) = 'conecta_versao'
 );

insert into public.app_parameters (tenant_id, parameter, value)
select i.id, 'conecta_revisao', '2026-08-29'
  from public.igrejas i
 where not exists (
   select 1
     from public.app_parameters ap
    where ap.tenant_id = i.id
      and lower(trim(ap.parameter)) = 'conecta_revisao'
 );

notify pgrst, 'reload schema';

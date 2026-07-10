-- Remove duplicatas de LGPD_Ativo em app_parameters.
-- O app usa o nome canônico exato: LGPD_Ativo (lib/appParameters.ts → LGPD_ATIVO_PARAMETER).
--
-- Problema: linhas como LGPD_Ativo + lgpd_ativo (ou LGPD_ATIVO) coexistem porque
-- UNIQUE(parameter) é case-sensitive. get_app_parameter_value usava LIMIT 1 sem ORDER BY.
--
-- Execute no SQL Editor do Supabase (como postgres / service role).

-- 1) Diagnóstico — conferir duplicatas antes de apagar
select parameter, value, ctid
  from public.app_parameters
 where lower(trim(parameter)) = lower('LGPD_Ativo')
 order by parameter;

-- 2) Consolidar em uma única linha LGPD_Ativo (valor da linha canônica, se existir)
do $$
declare
  v_value text;
begin
  select ap.value
    into v_value
    from public.app_parameters ap
   where lower(trim(ap.parameter)) = lower('LGPD_Ativo')
   order by
     case when ap.parameter = 'LGPD_Ativo' then 0 else 1 end,
     ap.parameter
   limit 1;

  if v_value is null then
    v_value := 'sim';
  end if;

  delete from public.app_parameters
   where lower(trim(parameter)) = lower('LGPD_Ativo');

  insert into public.app_parameters (parameter, value)
  values ('LGPD_Ativo', v_value);

  raise notice 'LGPD_Ativo consolidado com value=%', v_value;
end;
$$;

-- 3) Conferência — deve restar uma única linha
select parameter, value
  from public.app_parameters
 where lower(trim(parameter)) = lower('LGPD_Ativo');

-- 4) NÃO recriar índice GLOBAL em parameter.
-- Multi-tenant: use app_parameters_tenant_parameter_lower_unique
-- (scripts/multi-tenant-19-app-parameters-tenant-unique-fix.sql).
-- O índice global abaixo quebra "Criar instância".
--
-- create unique index if not exists app_parameters_parameter_lower_unique
--   on public.app_parameters (lower(trim(parameter)));

notify pgrst, 'reload schema';

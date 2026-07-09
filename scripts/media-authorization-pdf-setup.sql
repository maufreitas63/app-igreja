-- Configuração do PDF de autorização (app_parameters)
-- 1. Gere um secret longo (ex.: openssl rand -hex 32)
-- 2. Substitua SEU_PROJECT_REF e o secret abaixo
-- 3. Execute no SQL Editor do Supabase
-- 4. Configure o MESMO secret na Edge Function (ver MEDIA_AUTHORIZATION_DEPLOY.md)

do $$
declare
  v_project_ref text := 'SEU_PROJECT_REF';
  v_secret text := 'cole-aqui-o-mesmo-secret-da-edge-function';
  v_url text := 'https://' || v_project_ref || '.supabase.co/functions/v1/generate-authorization-pdf';
begin
  if not exists (
    select 1 from public.app_parameters where lower(trim(parameter)) = 'media_authorization_pdf_function_url'
  ) then
    insert into public.app_parameters (parameter, value) values ('media_authorization_pdf_function_url', v_url);
  else
    update public.app_parameters set value = v_url where lower(trim(parameter)) = 'media_authorization_pdf_function_url';
  end if;

  if not exists (
    select 1 from public.app_parameters where lower(trim(parameter)) = 'media_authorization_pdf_function_secret'
  ) then
    insert into public.app_parameters (parameter, value) values ('media_authorization_pdf_function_secret', v_secret);
  else
    update public.app_parameters set value = v_secret where lower(trim(parameter)) = 'media_authorization_pdf_function_secret';
  end if;
end;
$$;

select parameter, value
  from public.app_parameters
 where lower(trim(parameter)) in (
   'media_authorization_pdf_function_url',
   'media_authorization_pdf_function_secret'
 )
 order by parameter;

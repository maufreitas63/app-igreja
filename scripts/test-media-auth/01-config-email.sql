-- TESTE 1 — Configuração de e-mail e URL de confirmação
-- Execute no SQL Editor do Supabase.
-- Esperado: email_status = OK; link_status = OK (sem localhost).

with cfg as (
  select
    public.get_app_parameter_value_trim('recovery_email_provider') as recovery_provider,
    public.get_app_parameter_value_trim('recovery_email_from') as recovery_from,
    public.get_app_parameter_value_trim('recovery_email_function_url') as recovery_function_url,
    case
      when public.get_app_parameter_value_trim('recovery_email_function_secret') is not null then '*** definido ***'
      else null
    end as recovery_function_secret,
    case
      when public.get_app_parameter_value_trim('recovery_email_smtp_user') is not null then '*** definido ***'
      else null
    end as recovery_smtp_user,
    case
      when public.get_app_parameter_value_trim('recovery_email_smtp_password') is not null then '*** definido ***'
      else null
    end as recovery_smtp_password,
    case
      when public.get_app_parameter_value_trim('recovery_email_api_key') is not null then '*** definido ***'
      else null
    end as recovery_api_key,
    public.get_app_parameter_value_trim('media_authorization_app_url') as media_app_url,
    public.get_app_parameter_value_trim('app_public_url') as app_public_url
)
select
  recovery_provider,
  recovery_from,
  recovery_api_key,
  coalesce(media_app_url, app_public_url, 'https://localhost:8081') as confirm_link_base,
  case
    when recovery_provider = 'resend'
      and recovery_from is not null
      and recovery_api_key is not null
      then 'OK — Resend (mesmo caminho do PIN)'
    when recovery_provider = 'gmail'
      and recovery_from is not null
      and recovery_function_url is not null
      and recovery_function_secret is not null
      and recovery_smtp_user is not null
      and recovery_smtp_password is not null
      then 'OK — Gmail (mesmo caminho do PIN)'
    when recovery_provider is null
      and recovery_from is not null
      and recovery_api_key is not null
      then 'OK — Resend inferido'
    else 'INCOMPLETO — configure recovery_email_*'
  end as email_status,
  case
    when coalesce(media_app_url, app_public_url) is null
      then 'ERRO — defina media_authorization_app_url'
    when coalesce(media_app_url, app_public_url) ~* 'localhost|127\.0\.0\.1'
      then 'ERRO — URL local (use produção)'
    else 'OK — URL de produção'
  end as link_status
from cfg;

-- Diagnóstico: envio de e-mail da autorização de imagem e voz.
-- Execute no SQL Editor do Supabase (substitua o e-mail de teste).

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
    public.get_app_parameter_value_trim('app_public_url') as app_public_url,
    public.get_app_parameter_value_trim('media_authorization_email_function_url') as media_email_function_url,
    case
      when public.get_app_parameter_value_trim('media_authorization_email_function_secret') is not null then '*** definido ***'
      else null
    end as media_email_function_secret
)
select
  recovery_provider,
  recovery_from,
  recovery_function_url,
  recovery_function_secret,
  recovery_smtp_user,
  recovery_smtp_password,
  recovery_api_key,
  coalesce(media_app_url, app_public_url, 'https://localhost:8081') as confirm_link_base,
  media_email_function_url,
  media_email_function_secret,
  case
    when coalesce(media_app_url, app_public_url) is null
      then 'ERRO — defina media_authorization_app_url (URL pública do app em produção)'
    when coalesce(media_app_url, app_public_url) ~* 'localhost|127\.0\.0\.1'
      then 'ERRO — URL local não serve em e-mail de produção'
    else 'OK — link de confirmação aponta para produção'
  end as link_status,
  case
    when recovery_provider = 'gmail'
      and recovery_from is not null
      and recovery_function_url is not null
      and recovery_function_secret is not null
      and recovery_smtp_user is not null
      and recovery_smtp_password is not null
      then 'OK — mesmo caminho do PIN (Gmail)'
    when recovery_provider = 'resend'
      and recovery_from is not null
      and recovery_api_key is not null
      then 'OK — mesmo caminho do PIN (Resend)'
    when recovery_provider is null
      and recovery_from is not null
      and recovery_function_url is not null
      and recovery_function_secret is not null
      and recovery_smtp_user is not null
      and recovery_smtp_password is not null
      then 'OK — Gmail inferido (recovery_email_provider vazio)'
    when recovery_provider is null
      and recovery_from is not null
      and recovery_api_key is not null
      then 'OK — Resend inferido (recovery_email_provider vazio)'
    else 'INCOMPLETO — configure recovery_email_* (igual ao PIN)'
  end as email_status,
  case
    when media_email_function_url is not null
      then 'AVISO: media_authorization_email_function_url está definido, mas o RPC atual ignora e usa recovery_email_*.'
    else 'Sem função dedicada de autorização (esperado).'
  end as media_function_note
from cfg;

-- Pendências recentes (substitua o e-mail):
-- select id, profile_id, email, created_at, expires_at
--   from public.pending_authorizations
--  where lower(email) = lower('seu@email.com')
--  order by created_at desc
--  limit 5;

-- Cadastre a URL pública (substitua pela URL real do Cloudflare Pages):
-- insert into public.app_parameters (parameter, value)
-- values ('media_authorization_app_url', 'https://seu-app.pages.dev')
-- on conflict do nothing;
-- update public.app_parameters
--    set value = 'https://seu-app.pages.dev'
--  where lower(trim(parameter)) = 'media_authorization_app_url';

-- Teste de envio manual (substitua nome, e-mail e URL pública):
-- select public.send_media_authorization_confirm_email(
--   'seu@email.com',
--   'Seu Nome',
--   'https://seu-app.pages.dev/autorizacao-midia-confirmar?token=teste-diagnostico'
-- );

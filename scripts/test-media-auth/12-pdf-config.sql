-- TESTE 12 — Configuração do PDF
-- Esperado: pdf_status = OK (URL + secret definidos)

with cfg as (
  select
    public.get_app_parameter_value_trim('media_authorization_pdf_function_url') as pdf_url,
    case
      when public.get_app_parameter_value_trim('media_authorization_pdf_function_secret') is not null
        then '*** definido ***'
      else null
    end as pdf_secret
)
select
  pdf_url,
  pdf_secret,
  case
    when pdf_url is not null
      and pdf_url ~* '^https://.+\.supabase\.co/functions/v1/generate-authorization-pdf$'
      and pdf_secret is not null
      then 'OK — PDF configurado'
    when pdf_url is null and pdf_secret is null
      then 'INCOMPLETO — execute scripts/media-authorization-pdf-setup.sql'
    else 'INCOMPLETO — revise URL e secret'
  end as pdf_status
from cfg;

-- TESTE 3b — Resend compartilhado (PIN + autorização)
-- Substitua o e-mail e execute no SQL Editor.
-- Esperado: 2 linhas com ok=true e resendId preenchido em ambas.
-- Confira em https://resend.com/emails (2 envios seguidos).

with params as (
  select
    'maufreitas63@gmail.com'::text as email,
    'mauricio Seu Nome'::text as full_name
)
select
  'pin_via_resend' as teste,
  public.send_resend_transactional_email(
    (select email from params),
    'Teste PIN (caminho compartilhado)',
    'Se este e-mail chegou, o Resend está OK para PIN e autorização.'
  ) as resultado
union all
select
  'autorizacao_via_resend' as teste,
  public.send_media_authorization_pending_email(
    (select email from params),
    (select full_name from params),
    coalesce(
      public.get_app_parameter_value_trim('media_authorization_app_url'),
      public.get_app_parameter_value_trim('app_public_url'),
      'https://app-igreja.pages.dev'
    ) || '/autorizacao-midia-confirmar?token=' || encode(gen_random_bytes(32), 'hex')
  ) as resultado;

-- Se send_resend_transactional_email não existir: reexecute
-- scripts/password-recovery-email-flow.sql e depois scripts/media-authorization-rpc.sql

-- TESTE 2 — Funções RPC de e-mail instaladas?
-- Execute no SQL Editor do Supabase.
-- Esperado: 7+ linhas com status OK.

select
  p.proname as function_name,
  pg_get_function_result(p.oid) as return_type,
  case
    when p.proname = 'normalize_media_authorization_token'
      and pg_get_function_result(p.oid) = 'text'
      then 'OK'
    when p.proname in (
      'send_media_authorization_confirm_email',
      'send_media_authorization_confirm_email_via_resend',
      'send_media_authorization_pending_email',
      'send_resend_transactional_email',
      'submit_media_authorization_pending',
      'test_media_authorization_email_delivery',
      'confirm_media_authorization',
      'ping_profile_session'
    )
      and pg_get_function_result(p.oid) = 'jsonb'
      then 'OK'
    else 'VERIFICAR'
  end as status
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'send_media_authorization_confirm_email',
    'send_media_authorization_confirm_email_via_resend',
    'send_media_authorization_pending_email',
    'send_resend_transactional_email',
    'submit_media_authorization_pending',
    'test_media_authorization_email_delivery',
    'confirm_media_authorization',
    'ping_profile_session',
    'normalize_media_authorization_token'
  )
order by p.proname;

-- Se faltar função: reexecute scripts/media-authorization-rpc.sql

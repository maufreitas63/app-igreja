-- Verifica se as funções de e-mail da autorização existem no Supabase.

select
  p.proname as function_name,
  pg_get_function_result(p.oid) as return_type
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'send_media_authorization_confirm_email',
    'send_media_authorization_confirm_email_via_resend',
    'submit_media_authorization_pending',
    'test_media_authorization_email_delivery'
  )
order by p.proname;

-- Teste (substitua o e-mail):
-- select public.test_media_authorization_email_delivery('seu@email.com', 'Seu Nome', null);

-- TESTE 3 — Envio de e-mail de teste (Resend/Gmail)
-- Substitua o e-mail abaixo e execute no SQL Editor do Supabase.
-- Esperado: {"ok":true,"provider":"resend","resendId":"...","to":"..."}
-- Depois confira em https://resend.com/emails

with params as (
  select
    'seu@email.com'::text as email,
    'Seu Nome'::text as full_name
)
select public.test_media_authorization_email_delivery(
  (select email from params),
  (select full_name from params),
  null
) as resultado;

-- TESTE 3 — Envio de e-mail de teste (Resend/Gmail)
-- Substitua o e-mail abaixo e execute no SQL Editor do Supabase.
-- Esperado: {"ok":true,"provider":"resend","resendId":"...","to":"..."}
-- Depois confira em https://resend.com/emails
--
-- ATENÇÃO: este teste só valida ENVIO. O link do e-mail NÃO confirma autorização
-- (não cria pendência no banco). Para testar confirmação, use o envio pelo aplicativo.

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

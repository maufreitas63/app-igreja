-- Diagnóstico pós-envio da autorização pelo app.
-- Execute após clicar em "Enviar e confirmar por e-mail".

-- 1) Pendências recentes (se vazio após envio com sucesso no app, o e-mail falhou no servidor)
select
  id,
  profile_id,
  email,
  created_at,
  expires_at,
  left(token, 10) || '...' as token_prefix
from public.pending_authorizations
order by created_at desc
limit 10;

-- 2) Autorizações já confirmadas
select
  id,
  full_name,
  email,
  accepted_at,
  left(coalesce(confirmation_token, ''), 10) || '...' as token_prefix
from public.authorizations
order by accepted_at desc
limit 10;

-- 3) Teste direto do Resend/Gmail (substitua e-mail e URL)
-- select public.send_media_authorization_confirm_email(
--   'seu@email.com',
--   'Seu Nome',
--   coalesce(
--     public.get_app_parameter_value_trim('media_authorization_app_url'),
--     public.get_app_parameter_value_trim('app_public_url'),
--     'https://localhost:8081'
--   ) || '/autorizacao-midia-confirmar?token=teste-diagnostico'
-- );

-- 4) Se o teste (3) retornar resendId mas o e-mail não chegar:
--    Resend → Suppressions / Bounces — remova o destinatário se estiver bloqueado
--    (comum após marcar o primeiro e-mail como spam).

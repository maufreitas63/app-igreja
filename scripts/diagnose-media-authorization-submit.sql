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

-- 3) Teste direto (mostra erro completo se falhar)
-- select public.test_media_authorization_email_delivery('seu@email.com', 'Seu Nome', null);

-- 4) Conferir token do link (cole o token da URL após token=)
-- select public.normalize_media_authorization_token('COLE_O_TOKEN_AQUI') as token_normalizado;
-- select id, email, created_at, expires_at
--   from public.pending_authorizations
--  where token = public.normalize_media_authorization_token('COLE_O_TOKEN_AQUI');

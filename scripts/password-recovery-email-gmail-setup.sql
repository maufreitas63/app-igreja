-- Exemplo de configuração Gmail para recuperação de senha (sem domínio).
-- Ajuste os valores e execute no SQL Editor do Supabase APÓS:
--   1. scripts/password-recovery-security.sql
--   2. scripts/password-recovery-email-flow.sql
--   3. Deploy da Edge Function send-password-recovery-email (ver cabeçalho do email-flow.sql)

-- Gere uma chave aleatória longa e use o MESMO valor aqui e em:
--   supabase secrets set RECOVERY_EMAIL_FUNCTION_SECRET=...

insert into public.app_parameters (parameter, value)
values
  ('recovery_email_provider', 'gmail'),
  (
    'recovery_email_function_url',
    'https://SEU_PROJECT_REF.supabase.co/functions/v1/send-password-recovery-email'
  ),
  ('recovery_email_function_secret', 'SUBSTITUA_POR_CHAVE_SECRETA_LONGA'),
  ('recovery_email_smtp_user', 'ibnmassagua@gmail.com'),
  ('recovery_email_smtp_password', 'SUBSTITUA_PELA_SENHA_DE_APP_DO_GOOGLE'),
  ('recovery_email_from', 'Igreja IBN Massagua <ibnmassagua@gmail.com>')
on conflict (parameter) do update
  set value = excluded.value;

-- Senha de app Google: https://myaccount.google.com/apppasswords
-- (requer verificação em 2 etapas na conta Google)

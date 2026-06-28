-- Recuperação de senha — envio via Resend com domínio ibnorte.api.br
--
-- FLUXO DE E-MAIL (já implementado no app + SQL):
--   DE (remetente fixo):  recovery_email_from → nao-responda@ibnorte.api.br
--   PARA (destinatário):  profiles.email do membro (cadastrado ou informado na recuperação)
--
-- O usuário NÃO recebe no nao-responda@; esse endereço só ENVIA o PIN.
-- Cada membro recebe no e-mail pessoal gravado em profiles.email.
--
-- NÃO é necessário criar caixa de e-mail no Cloudflare para ENVIAR.
-- O Resend envia em nome do domínio após verificar os registros DNS.
--
-- === PASSO A PASSO (uma vez) ===
--
-- 1) RESEND (resend.com → Domains → Add Domain)
--    Domínio: ibnorte.api.br
--    Copie os registros DNS que o Resend mostrar (DKIM, SPF/MX em "send", DMARC opcional).
--
-- 2) CLOUDFLARE (dash.cloudflare.com → zona ibnorte.api.br → DNS → Add record)
--    Para cada registro do Resend:
--      Type / Name / Content conforme o painel do Resend
--      Proxy: DNS only (nuvem CINZA) em todos os registros de e-mail
--    Nomes comuns no Cloudflare (Name = só a parte antes do domínio):
--      TXT  resend._domainkey   → valor DKIM longo do Resend
--      TXT  send                 → v=spf1 include:amazonses.com ~all
--      MX   send                 → feedback-smtp.sa-east-1.amazonses.com (priority 10)
--      TXT  _dmarc               → v=DMARC1; p=none;  (opcional)
--
-- 3) RESEND → Verify Domain (aguarde DNS propagar, 5 min a 48 h)
--
-- 4) SUPABASE — preencha a API key abaixo e execute este script
--    (após password-recovery-security.sql e password-recovery-email-flow.sql)
--
-- === OPCIONAL: receber e-mails em nao-responda@ (encaminhar para Gmail) ===
-- Cloudflare → Email → Email Routing → Enable
-- Create address: nao-responda@ibnorte.api.br → Forward to ibnmassagua@gmail.com
-- Isso NÃO substitui o Resend; só encaminha mensagens que alguém enviar PARA nao-responda@.
--
-- === TESTE ===
-- select public.send_password_recovery_pin_email('destino@exemplo.com', '1234');

insert into public.app_parameters (parameter, value)
values
  ('recovery_email_provider', 'resend'),
  ('recovery_email_api_key', 'SUBSTITUA_PELA_CHAVE_RE_resend'),
  ('recovery_email_from', 'Igreja IBN Norte <nao-responda@ibnorte.api.br>')
on conflict (parameter) do update
  set value = excluded.value;

-- Remova parâmetros Gmail se não for mais usar (opcional):
-- delete from public.app_parameters
--  where parameter in (
--    'recovery_email_smtp_user',
--    'recovery_email_smtp_password',
--    'recovery_email_function_url',
--    'recovery_email_function_secret'
--  );

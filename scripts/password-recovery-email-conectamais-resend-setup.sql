-- Remetente genérico da plataforma (multi-instância) — Resend + conectamais.api.br
--
-- Substitui o remetente legado ibnorte.api.br por um endereço único da plataforma:
--   DE (remetente fixo):  recovery_email_from → nao-responda@conectamais.api.br
--   PARA (destinatário):  profiles.email do membro (cadastrado ou informado na recuperação)
--
-- O usuário NÃO recebe no nao-responda@; esse endereço só ENVIA (PIN, autorização, etc.).
-- Cada membro recebe no e-mail pessoal gravado em profiles.email.
--
-- Por que genérico: novas igrejas copiam app_parameters do tenant padrão. Um domínio
-- por igreja quebraria o envio nas demais instâncias. A plataforma envia; o conteúdo
-- e o contexto continuam por tenant.
--
-- NÃO é necessário criar caixa de e-mail no Cloudflare para ENVIAR.
-- O Resend envia em nome do domínio após verificar os registros DNS.
--
-- === PASSO A PASSO (uma vez, se o domínio ainda não estiver no Resend) ===
--
-- 1) RESEND (resend.com → Domains → Add Domain)
--    Domínio: conectamais.api.br
--    Copie os registros DNS que o Resend mostrar (DKIM, SPF/MX em "send", DMARC opcional).
--
-- 2) CLOUDFLARE (dash.cloudflare.com → zona conectamais.api.br → DNS → Add record)
--    Para cada registro do Resend:
--      Type / Name / Content conforme o painel do Resend
--      Proxy: DNS only (nuvem CINZA) em todos os registros de e-mail
--    Nomes comuns no Cloudflare (Name = só a parte antes do domínio):
--      TXT  resend._domainkey   → COPIE O VALOR EXATO da tabela do Resend (começa com p=MIGfMA0GCS...)
--      TXT  send                 → v=spf1 include:amazonses.com ~all
--      MX   send                 → feedback-smtp.*.amazonses.com (priority 10)
--      TXT  _dmarc               → v=DMARC1; p=none;  (opcional)
--
-- 3) RESEND → Verify Domain (aguarde DNS propagar, 5 min a 48 h)
--
-- 4) SUPABASE — execute a seção A abaixo (migração do from em todos os tenants).
--    Se ainda não houver API key, use a seção B (preencha a chave antes).
--
-- === OPCIONAL: receber e-mails em nao-responda@ (encaminhar) ===
-- Cloudflare → Email → Email Routing → Enable
-- Create address: nao-responda@conectamais.api.br → Forward to um Gmail operacional
-- Isso NÃO substitui o Resend; só encaminha mensagens que alguém enviar PARA nao-responda@.
--
-- === TESTE ===
-- select public.send_password_recovery_pin_email('destino@exemplo.com', '1234');
-- Confira em https://resend.com/emails se o From é nao-responda@conectamais.api.br

begin;

-- ---------------------------------------------------------------------------
-- A) Migração: atualiza o remetente em TODOS os tenants (multi-instância)
-- ---------------------------------------------------------------------------
update public.app_parameters
   set value = 'Conecta Mais <nao-responda@conectamais.api.br>'
 where lower(trim(parameter)) = 'recovery_email_from';

-- Garante o parâmetro nos tenants que ainda não têm recovery_email_from
-- (copia o valor genérico; a API key continua sendo a já existente no tenant, se houver).
insert into public.app_parameters (parameter, value, tenant_id)
select
  'recovery_email_from',
  'Conecta Mais <nao-responda@conectamais.api.br>',
  i.id
from public.igrejas i
where not exists (
  select 1
  from public.app_parameters ap
  where ap.tenant_id = i.id
    and lower(trim(ap.parameter)) = 'recovery_email_from'
);

-- ---------------------------------------------------------------------------
-- B) Opcional — primeira configuração Resend (descomente e preencha a API key)
--    Atualiza provider + api_key em todos os tenants. Não rode com placeholder.
-- ---------------------------------------------------------------------------
-- update public.app_parameters
--    set value = 'resend'
--  where lower(trim(parameter)) = 'recovery_email_provider';
--
-- insert into public.app_parameters (parameter, value, tenant_id)
-- select 'recovery_email_provider', 'resend', i.id
-- from public.igrejas i
-- where not exists (
--   select 1 from public.app_parameters ap
--   where ap.tenant_id = i.id
--     and lower(trim(ap.parameter)) = 'recovery_email_provider'
-- );
--
-- update public.app_parameters
--    set value = 'SUBSTITUA_PELA_CHAVE_RE_resend'
--  where lower(trim(parameter)) = 'recovery_email_api_key';
--
-- insert into public.app_parameters (parameter, value, tenant_id)
-- select 'recovery_email_api_key', 'SUBSTITUA_PELA_CHAVE_RE_resend', i.id
-- from public.igrejas i
-- where not exists (
--   select 1 from public.app_parameters ap
--   where ap.tenant_id = i.id
--     and lower(trim(ap.parameter)) = 'recovery_email_api_key'
-- );

commit;

-- Conferência:
-- select tenant_id, parameter, value
--   from public.app_parameters
--  where lower(trim(parameter)) in (
--    'recovery_email_from',
--    'recovery_email_provider',
--    'recovery_email_api_key'
--  )
--  order by tenant_id, parameter;

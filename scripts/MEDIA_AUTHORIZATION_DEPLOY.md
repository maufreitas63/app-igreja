# Autorização de imagem e voz — deploy manual

## 1. SQL (Supabase SQL Editor)

Execute nesta ordem:

1. `scripts/media-authorization-schema.sql`
2. `scripts/password-recovery-email-flow.sql` (**reexecute** após atualização do Resend compartilhado)
3. `scripts/media-authorization-rpc.sql` (**reexecute** após atualizações de e-mail)

## 2. E-mail (reutiliza recuperação de senha)

O envio da autorização usa **exatamente o mesmo provedor do PIN** (`recovery_email_*`). Não é necessário função dedicada para o e-mail de confirmação.

| parameter | uso |
|-----------|-----|
| `recovery_email_provider` | `gmail` ou `resend` |
| `recovery_email_smtp_user` | Gmail |
| `recovery_email_smtp_password` | senha de app Google |
| `recovery_email_from` | remetente |
| `recovery_email_function_url` | Edge Function `send-password-recovery-email` |
| `recovery_email_function_secret` | secret da Edge Function |
| `recovery_email_api_key` | Resend (alternativa) |

**Importante:** defina também `media_authorization_app_url` com a URL pública do app (ex.: `https://seu-app.pages.dev`) para o link de confirmação apontar para produção.

**Se o PIN chega mas a autorização não:** reexecute `scripts/media-authorization-rpc.sql` e rode os testes em `scripts/test-media-auth/`.

## 3. Edge Functions (opcional — só PDF)

Função dedicada de e-mail (`send-authorization-magic-link`) **não é mais usada** pelo RPC; o envio vai pelo mesmo Gmail/Resend do PIN.

Para PDF após confirmação:

```bash
supabase functions deploy generate-authorization-pdf --no-verify-jwt
```

Parâmetros opcionais em `app_parameters`:

- `media_authorization_pdf_function_url`
- `media_authorization_pdf_function_secret`

## Causa raiz recorrente (Resend “para” de novo)

O teste **03b** envia direto ao Resend **sem sessão** e **sem gravar pendência**. O app exige `x-session-token` válido. Se o token expirou, o formulário abre mas o submit **não chama o Resend** — parece que “o Resend parou”.

**Correções aplicadas:**
- App envia **token + profile-id** nos headers (token expirado não bloqueia mais o submit).
- `resolve_profile_id_for_media_authorization` no RPC aceita profile-id quando o token expirou.
- App renova sessão automaticamente antes do submit (`ping_profile_session` + novo token).
- Autorização **prefere Resend** quando `recovery_email_api_key` está configurado.

Se o PIN de login funciona mas a autorização não: faça **logout + login** uma vez e tente de novo.

## 4. Testes de diagnóstico (SQL Editor)

Scripts em `scripts/test-media-auth/` — execute **um por vez**, na ordem:

| Arquivo | O que testa |
|---------|-------------|
| `01-config-email.sql` | Resend/Gmail + URL de confirmação |
| `02-functions-exist.sql` | Funções RPC instaladas |
| `03-send-test-email.sql` | Envio de e-mail de teste |
| `03b-resend-shared-path.sql` | PIN + autorização no mesmo caminho Resend |
| `04-list-pending.sql` | Links pendentes (não confirmados) |
| `04b-diagnose-empty.sql` | Por que o 04 está vazio (03b não cria pendência) |
| `05-list-confirmed.sql` | Autorizações já confirmadas |
| `06-check-token-from-link.sql` | Token copiado do e-mail |
| `07-set-production-url.sql` | Cadastrar URL pública do app |
| `08-confirm-token-manual.sql` | Confirmar token via SQL |
| `10-session-ping.sql` | Sessão no SQL Editor (sem headers = ok false) |

Se o botão retornar sucesso mas o e-mail não chegar:

1. Rode `01` e `02`
2. Rode `03b` (ou `03`) e confira [resend.com/emails](https://resend.com/emails)
3. Reexecute `password-recovery-email-flow.sql` e `media-authorization-rpc.sql` se `02` ou `03b` falhar
4. Verifique spam (assunto: **Confirme sua autorizacao no app**)
5. Teste PIN na tela de login — se PIN também não chega, o problema é `recovery_email_*`

## 5. Confirmação do link

- O link do e-mail abre uma tela com botão **Confirmar autorização** (não confirma sozinho ao abrir).
- Cada envio gera um token novo; links antigos ficam inválidos após um novo envio.
- Se aparecer *link inválido ou já utilizado*, solicite um **novo envio** pelo app.
- Execute `scripts/media-authorization-confirm-idempotent.sql` e reexecute `media-authorization-rpc.sql` após atualizações.

# Autorização de imagem e voz — deploy manual

## 1. SQL (Supabase SQL Editor)

Execute nesta ordem:

1. `scripts/media-authorization-schema.sql`
2. `scripts/password-recovery-email-flow.sql` (se ainda não executado)
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

**Se o PIN chega mas a autorização não:** reexecute `scripts/media-authorization-rpc.sql` e rode `scripts/diagnose-media-authorization-email.sql` no Supabase.

## 3. Edge Functions (opcional — só PDF)

Função dedicada de e-mail (`send-authorization-magic-link`) **não é mais usada** pelo RPC; o envio vai pelo mesmo Gmail/Resend do PIN.

Para PDF após confirmação:

```bash
supabase functions deploy generate-authorization-pdf --no-verify-jwt
```

Parâmetros opcionais em `app_parameters`:

- `media_authorization_pdf_function_url`
- `media_authorization_pdf_function_secret`

## 4. Diagnóstico

Se o botão retornar sucesso mas o e-mail não chegar:

1. Execute `scripts/diagnose-media-authorization-email.sql`
2. Confirme `recovery_email_*` no `app_parameters`
3. Reexecute `scripts/media-authorization-rpc.sql`
4. Verifique spam/lixo eletrônico (assunto: **Confirme sua autorização no app**)
5. Teste envio de PIN na tela de login — se PIN também não chega, o problema é na configuração Gmail/Resend

## 5. Confirmação do link

- O link do e-mail abre uma tela com botão **Confirmar autorização** (não confirma sozinho ao abrir).
- Cada envio gera um token novo; links antigos ficam inválidos após um novo envio.
- Se aparecer *link inválido ou já utilizado*, solicite um **novo envio** pelo app.
- Execute `scripts/media-authorization-confirm-idempotent.sql` e reexecute `media-authorization-rpc.sql` após atualizações.

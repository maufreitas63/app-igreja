# Autorização de imagem e voz — deploy manual

## 1. SQL (Supabase SQL Editor)

Execute nesta ordem:

1. `scripts/media-authorization-schema.sql`
2. `scripts/password-recovery-email-flow.sql` (se ainda não executado)
3. `scripts/media-authorization-rpc.sql` (**reexecute** após atualizações de e-mail)

## 2. E-mail (reutiliza recuperação de senha)

Por padrão, o envio usa os mesmos parâmetros do PIN por e-mail:

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

## 3. Edge Functions (opcional)

Se quiser função dedicada em vez do fallback Gmail/Resend:

```bash
supabase functions deploy send-authorization-magic-link --no-verify-jwt
supabase functions deploy generate-authorization-pdf --no-verify-jwt
```

Parâmetros opcionais em `app_parameters`:

- `media_authorization_email_function_url`
- `media_authorization_email_function_secret`
- `media_authorization_pdf_function_url`
- `media_authorization_pdf_function_secret`

## 4. Diagnóstico

Se o botão retornar sucesso mas o e-mail não chegar:

1. Confirme `recovery_email_*` no `app_parameters`
2. Reexecute `scripts/media-authorization-rpc.sql`
3. Verifique spam/lixo eletrônico
4. Teste envio de PIN na tela de login — se PIN também não chega, o problema é na configuração Gmail/Resend

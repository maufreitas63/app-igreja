# Autorização de imagem e voz — deploy manual

## 1. SQL (Supabase SQL Editor)

Execute nesta ordem:

1. `scripts/media-authorization-schema.sql`
2. `scripts/media-authorization-rpc.sql`

## 2. Edge Functions

```bash
supabase login
supabase link --project-ref SEU_PROJECT_REF

supabase secrets set MEDIA_AUTHORIZATION_EMAIL_SECRET=uma-chave-longa
supabase secrets set MEDIA_AUTHORIZATION_PDF_SECRET=outra-chave-longa
supabase secrets set RESEND_API_KEY=re_...
supabase secrets set MEDIA_AUTHORIZATION_EMAIL_FROM="Igreja <nao-responda@seudominio.com>"

supabase functions deploy send-authorization-magic-link --no-verify-jwt
supabase functions deploy generate-authorization-pdf --no-verify-jwt
```

## 3. app_parameters

| parameter | exemplo |
|-----------|---------|
| `media_authorization_app_url` | `https://seu-app.pages.dev` |
| `media_authorization_email_function_url` | `https://REF.supabase.co/functions/v1/send-authorization-magic-link` |
| `media_authorization_email_function_secret` | mesmo valor de `MEDIA_AUTHORIZATION_EMAIL_SECRET` |
| `media_authorization_pdf_function_url` | `https://REF.supabase.co/functions/v1/generate-authorization-pdf` |
| `media_authorization_pdf_function_secret` | mesmo valor de `MEDIA_AUTHORIZATION_PDF_SECRET` |

Sem os parâmetros de e-mail, o RPC retorna `devConfirmUrl` em desenvolvimento para testes locais.

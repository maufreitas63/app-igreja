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
| `recovery_email_from` | remetente genérico da plataforma (`Conecta Mais <nao-responda@conectamais.api.br>`) |
| `recovery_email_function_url` | Edge Function `send-password-recovery-email` |
| `recovery_email_function_secret` | secret da Edge Function |
| `recovery_email_api_key` | Resend (alternativa) |

Setup do remetente multi-instância: `scripts/password-recovery-email-conectamais-resend-setup.sql` (`nao-responda@conectamais.api.br`).

**Importante:** defina também `media_authorization_app_url` com a URL pública do app (ex.: `https://seu-app.pages.dev`) para o link de confirmação apontar para produção.

**Se o PIN chega mas a autorização não:** reexecute `scripts/media-authorization-rpc.sql` e rode os testes em `scripts/test-media-auth/`.

## 3. PDF após confirmação

Após confirmar o link, o RPC chama a Edge Function `generate-authorization-pdf`, grava o arquivo no bucket `authorizations` e preenche `authorizations.storage_path`.

### 3.1 Deploy da Edge Function (uma vez)

No terminal, na pasta do projeto:

```bash
supabase login
supabase link --project-ref SEU_PROJECT_REF
```

Gere um secret (guarde o mesmo valor para o passo 3.2):

```bash
# PowerShell — string aleatória
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

Configure o secret e faça deploy:

```bash
supabase secrets set MEDIA_AUTHORIZATION_PDF_SECRET=SEU_SECRET_AQUI
supabase functions deploy generate-authorization-pdf --no-verify-jwt
```

### 3.2 Parâmetros no Supabase (SQL Editor)

Edite e execute `scripts/media-authorization-pdf-setup.sql` (substitua `SEU_PROJECT_REF` e o secret).

| parameter | uso |
|-----------|-----|
| `media_authorization_pdf_function_url` | `https://SEU_REF.supabase.co/functions/v1/generate-authorization-pdf` |
| `media_authorization_pdf_function_secret` | Mesmo valor de `MEDIA_AUTHORIZATION_PDF_SECRET` |

### 3.3 RPC de PDF no banco

Se o teste `13` disser *function invoke_media_authorization_pdf_generation does not exist*, execute **um** dos scripts:

- `scripts/media-authorization-pdf-rpc-patch.sql` (só PDF — mais rápido), **ou**
- `scripts/media-authorization-rpc.sql` (completo — recomendado após qualquer atualização)

### 3.4 Testes

| Script | O que testa |
|--------|-------------|
| `12-pdf-config.sql` | URL + secret configurados |
| `13-generate-pdf.sql` | Gera PDF para autorização já confirmada (cole o `id` do teste 05) |
| `05-list-confirmed.sql` | Deve mostrar `storage_path` preenchido após o PDF |

### 3.5 No app

Na tela de autorização, após confirmar: **Baixar PDF** (se já gerado) ou **Gerar PDF** (se confirmou antes de configurar o PDF).

### 3.6 Edge Functions legadas

`send-authorization-magic-link` **não é usada** — o e-mail vai pelo mesmo Resend/Gmail do PIN.

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
| `12-pdf-config.sql` | Configuração do PDF |
| `13-generate-pdf.sql` | Gerar PDF para autorização existente |

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

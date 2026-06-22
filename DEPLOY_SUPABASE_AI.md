# Deploy do módulo de IA (Supabase Edge Function)

O chat com Gemini roda em uma **Edge Function** (`ai-chat`), não no PWA. O PWA apenas consome o endpoint com o token de sessão do app.

## 1. SQL no Supabase

No **SQL Editor**, execute na ordem:

1. `scripts/access-control-ai-curator.sql` — papel **Curador IA**, tabela `ai_audit_logs`, view `user_roles`, RPCs
2. (Opcional) `scripts/access-control-role-display-order.sql` — ordem do papel na UI

Atribua o papel **Curador IA** ao perfil desejado em **Manutenção → Controle de Acesso**.

## 2. Secret da API Gemini

No Supabase Dashboard:

**Project Settings → Edge Functions → Secrets**

| Nome | Valor |
|------|--------|
| `GEMINI_API_KEY` | Chave da API Google AI (Gemini) |

`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` são injetados automaticamente nas Edge Functions.

## 3. Deploy da função

Requisitos: [Supabase CLI](https://supabase.com/docs/guides/cli) autenticada.

```bash
cd app-igreja
supabase link --project-ref bldbrsuiwctoaxzcrjoc
supabase functions deploy ai-chat --no-verify-jwt
```

`--no-verify-jwt` é necessário porque o app usa **sessão customizada** (`x-session-token`), não JWT do Supabase Auth.

## 4. Validar

1. Perfil com papel **Curador IA** abre **Manutenção → Assistente IA**
2. Pergunta no chat → resposta em streaming
3. **Super admin** vê aba **Auditoria** com `question`, `ai_response`, `role_at_time` e timestamp
4. Sem o papel → mensagem `nao autorizado para esta funçao`

## 5. PWA (Cloudflare)

O frontend vai no deploy normal (`git push` → `npm run build:web`). Não exponha `GEMINI_API_KEY` no `.env` do PWA.

## Modelo

- **gemini-1.5-flash** via `streamGenerateContent` (SSE)
- System prompt: *Assistente de Gestão da Igreja*

## Segurança

- RBAC: `profile_is_ai_curator` / view `user_roles` (`role_code = curador_ia`)
- Auditoria: `insert_ai_audit_log` antes de concluir o stream
- RLS em `ai_audit_logs`: leitura apenas para **super_admin**

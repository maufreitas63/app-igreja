# Deploy do módulo de IA

O chat com Gemini em **produção** usa a **Cloudflare Pages Function** `functions/api/ai-chat.js` (rota `/api/ai-chat`), publicada automaticamente com o PWA.

## 1. SQL no Supabase

No **SQL Editor**, execute na ordem:

1. `scripts/access-control-ai-curator.sql` — papel **Curador IA**, tabela `ai_audit_logs`, view `user_roles`, RPCs
2. (Opcional) `scripts/access-control-role-display-order.sql` — ordem do papel na UI

Atribua o papel **Curador IA** ao perfil desejado em **Manutenção → Controle de Acesso**.

## 2. Variáveis no Cloudflare Pages (produção)

**Settings → Environment variables → Production:**

| Variável | Descrição |
|----------|-----------|
| `GEMINI_API_KEY` | API Google Gemini |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role do projeto Supabase |

Opcional: `SUPABASE_URL` (já há padrão no código).

Após definir, faça **novo deploy** (push em `main` ou **Retry deployment**).

## 3. (Opcional) Supabase Edge Function

Alternativa para **desenvolvimento local** (`localhost`) ou se preferir hospedar no Supabase:

### Secret Gemini

No Supabase Dashboard: **Edge Functions → Secrets** → `GEMINI_API_KEY`

### Deploy

```bash
cd app-igreja
supabase link --project-ref bldbrsuiwctoaxzcrjoc
supabase functions deploy ai-chat --no-verify-jwt
```

## 4. Validar

1. Perfil com papel **Curador IA** abre **Manutenção → Assistente IA**
2. Pergunta no chat → resposta em streaming
3. **Super admin** vê aba **Auditoria** com `question`, `ai_response`, `role_at_time` e timestamp
4. Sem o papel → mensagem `nao autorizado para esta funçao`

## 5. PWA (Cloudflare)

O frontend vai no deploy normal (`git push` → `npm run build:web`). **Nunca** exponha `GEMINI_API_KEY` nem `SUPABASE_SERVICE_ROLE_KEY` no cliente.

## Modelo

- **gemini-1.5-flash** via `streamGenerateContent` (SSE)
- System prompt: *Assistente de Gestão da Igreja*

## Segurança

- RBAC: `profile_is_ai_curator` / view `user_roles` (`role_code = curador_ia`)
- Auditoria: `insert_ai_audit_log` antes de concluir o stream
- RLS em `ai_audit_logs`: leitura apenas para **super_admin**

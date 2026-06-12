# Rotas públicas (sem guard ACL de tela)

Estas rotas são intencionalmente abertas e não usam `useScreenAccessGuard`:

| Rota | Motivo |
|------|--------|
| `/` (`app/index.tsx`) | Login |
| `/register` | Cadastro inicial |
| `/totem-checkin` | Totem de check-in (quiosque) |
| `/cadastro-familia` | Redirecionamento web |
| `/sessao-encerrada` | Sessão encerrada |

Dados sensíveis nesses fluxos dependem de **RLS** e **RPCs** no Supabase, não só do cliente.

## Sessão assinada (fase 2)

Após executar `scripts/profile-sessions.sql` no Supabase:

- Login (`verificar_login`) e cadastro inicial retornam `session_token`.
- O app envia `x-session-token` nas requisições (em vez de confiar só em `x-profile-id`).
- Logout revoga o token via `revoke_profile_session`.
- Sessões antigas sem token continuam com `x-profile-id` até o próximo login.

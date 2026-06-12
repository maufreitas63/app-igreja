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

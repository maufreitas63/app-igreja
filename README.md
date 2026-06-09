# App IBN — Igreja Batista Norte

Aplicativo móvel e PWA (Expo SDK 54) para membros e equipe da igreja: eventos, check-in, família, pastoral, financeiro, escalas e manutenção.

## Documentação

Mapa completo: [`INDICE_DOCUMENTACAO.md`](INDICE_DOCUMENTACAO.md)

| Documento | Conteúdo |
|-----------|----------|
| [`CAMADAS_SEGURANCA.md`](CAMADAS_SEGURANCA.md) | Especificação das 4 camadas de segurança |
| [`FUNCIONALIDADES.md`](FUNCIONALIDADES.md) | Lista de funcionalidades por área |
| [`BLUEPRINT.md`](BLUEPRINT.md) | Telas, fluxos e controles |
| [`CONTROLE_ACESSO.md`](CONTROLE_ACESSO.md) | Modelo ACL e inventário |

PDFs gerados em [`pdfs/`](pdfs/).

## Desenvolvimento

```bash
npm install
npm run web          # PWA em http://localhost:8081
npm run build:docs   # Regenera pacotes .md e PDFs
```

## Stack

- **Frontend:** React Native, Expo Router, TypeScript
- **Backend:** Supabase (PostgreSQL, RLS, RPC)
- **Auth:** PIN + sessão local (`user_profile_id`)

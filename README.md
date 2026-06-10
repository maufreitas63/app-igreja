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

PDFs gerados em [`pdfs/`](pdfs/). Manuais: membro [`PACOTE_5_MANUAL_PAINEL.md`](PACOTE_5_MANUAL_PAINEL.md) · equipe [`PACOTE_6_MANUAL_MANUTENCAO.md`](PACOTE_6_MANUAL_MANUTENCAO.md).

## Desenvolvimento

```bash
npm install
npm run web              # PWA em http://localhost:8081
npm run build:web        # Export estático para deploy (dist/)
npm run generate:icons   # Regenera ícones a partir da marca d'água
npm run build:docs       # Regenera pacotes .md e PDFs em pdfs/
```

## Stack

- **Frontend:** React Native, Expo Router, TypeScript
- **Backend:** Supabase (PostgreSQL, RLS, RPC)
- **Auth:** PIN + sessão local (`user_profile_id`)

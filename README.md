# Conecta+ — projeto e documentação

Plataforma multi-tenant para a operação de igrejas, construída com Expo SDK 54, React Native/React Web, Expo Router e Supabase. O canal principal é a PWA publicada no Cloudflare Pages.

A experiência publicada usa **Início + menu lateral + Eu quero… + Perfil + engrenagem de manutenção**. O antigo carrossel do Painel permanece congelado e não deve ser usado como referência funcional.

## Principais capacidades

- membros, famílias, cadastro público e Recepção Familiar;
- eventos, Agenda da Família, totem, quórum, geofence e Espaço Infantil;
- cuidado pastoral, escalas, células, murais, livros e documentos;
- financeiro, campanhas, Primícias e relatórios de despesas;
- ACL, multi-tenant, Modo Ghost, auditoria, billing Stripe e Gestão Liberada;
- Abigail, Régua de Acolhimento, instâncias e Aliança Conecta Reino.

## Stack

- Expo `~54.0.37`, Expo Router `~6.0.24`, React 19.1 e React Native 0.81.5;
- TypeScript 5.9;
- Supabase/PostgreSQL com RLS, RPCs `SECURITY DEFINER`, Storage e Realtime;
- Cloudflare Pages: `npm run build:web` gera `dist/`;
- formulário público familiar em Vite, entregue no mesmo domínio.

## Desenvolvimento

```bash
npm install
npm run web
npm run lint
npm run build:web
```

Requer Node.js `>=20.19.4`. Segredos e configurações locais ficam em `.env`, que não deve ser versionado.

## Documentação

Comece por [`INDICE_DOCUMENTACAO.md`](INDICE_DOCUMENTACAO.md). As fontes principais são:

- [`FUNCIONALIDADES.md`](FUNCIONALIDADES.md): inventário funcional atual;
- [`MANUAL_DASHBOARD_MEMBRO.md`](MANUAL_DASHBOARD_MEMBRO.md): uso pelo membro;
- [`MANUAL_DASHBOARD_MANUTENCAO.md`](MANUAL_DASHBOARD_MANUTENCAO.md): operação pela engrenagem;
- [`MANUAL_ENTREGA.md`](MANUAL_ENTREGA.md): entrega funcional e técnica;
- [`DESCRITIVO_APLICACAO.md`](DESCRITIVO_APLICACAO.md): arquitetura e segurança;
- [`BLUEPRINT.md`](BLUEPRINT.md): mapa técnico de módulos e fluxos;
- [`FAQ.md`](FAQ.md): dúvidas operacionais.

### Regenerar documentos derivados

```bash
npm run build:docs:md       # recompõe PACOTE_*.md a partir das fontes
npm run build:docs:pdf      # gera PDFs, manual de entrega e descritivo
npm run build:docs          # build web + fontes derivadas + PDFs
npm run build:docs:doc      # documentos Word institucionais
npm run build:access-roles-pdf
npm run build:validation-checklist-xlsx
```

Edite primeiro os arquivos-fonte; não edite manualmente `PACOTE_*.md` quando o conteúdo é gerado por `scripts/build-pacotes-md.mjs`.

## Banco e deploy

SQL versionado fica em `scripts/` e deve ser aplicado ao projeto Supabase linkado. O deploy web ocorre por push na branch `main`, que dispara o build do Cloudflare Pages. Consulte [`DEPLOY_CLOUDFLARE.md`](DEPLOY_CLOUDFLARE.md) e [`CHECKLIST_VALIDACAO_POS_DEPLOY.md`](CHECKLIST_VALIDACAO_POS_DEPLOY.md).

*Revisado em 05/10/2026.*

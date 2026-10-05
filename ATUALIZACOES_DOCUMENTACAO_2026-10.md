# Atualizações da documentação — 05/10/2026

Revisão geral do pacote documental do **Conecta+ / app-igreja**, alinhada ao código e às implementações publicadas até **05/10/2026**.

---

## Mudança estrutural de navegação

A documentação deixa de tratar o **carrossel do Painel** (`/(tabs)/dashboard`) como caminho principal. O produto publicado é:

1. **Início** — eventos, avisos, Agenda da Família, bolo do dia, sticker de novos membros, Eu quero…, Abigail  
2. **Menu lateral** — vida do membro  
3. **Engrenagem** — operação da igreja (grupos em `lib/appDrawerMenu.ts`)  
4. **Perfil** — identidade, família, carteirinha, trilha, serviços  

Cards em `FROZEN_DASHBOARD_CARD_CONTENTS` permanecem congelados (`lib/frozenPublication.ts`).

---

## Fontes atualizadas (Markdown)

| Arquivo | Escopo da revisão |
|---|---|
| `FUNCIONALIDADES.md` | Inventário funcional completo do produto publicado |
| `MANUAL_DASHBOARD_MEMBRO.md` | Manual passo a passo do membro (UX atual) |
| `MANUAL_DASHBOARD_MANUTENCAO.md` | Manual da engrenagem por grupo |
| `FAQ.md` | Perguntas alinhadas à UX e aos fluxos novos |
| `MANUAL_ENTREGA.md` | Entrega, jornada e status |
| `DESCRITIVO_APLICACAO.md` | Descritivo técnico |
| `BLUEPRINT.md` | Blueprint e rotas |
| `INDICE_DOCUMENTACAO.md` | Mapa do pacote |
| `MANUAL_TREINAMENTO.md` | Missões com caminhos atuais |
| `CONTROLE_ACESSO.md` / `MANUAL_CONTROLE_ACESSO.md` / `CAMADAS_SEGURANCA.md` / `PAPEIS_CONTROLE_ACESSO.md` | ACL, Gestor, Ghost, LGPD por instância |
| `DASHBOARD_CARDS.md` | Estado legado/congelado |
| `ARQUITETURA_BLUEPRINT_PWA.md` | Stack Expo 54, multi-tenant, billing, IA |
| `docs/PROCESSO_RECEPCAO_FAMILIAR.md` | Novos Membros, inbox, régua, sticker |
| `pacotes-funcionalidades.md` | Recorte comercial |
| `README.md` | Visão do repositório e geração de docs |
| `scripts/build-experiencia-usuario-docx.mjs` | Experiência do usuário (DOCX) |
| `scripts/build-pacotes-md.mjs` | Pacotes 1–7 e treinamento diário |

---

## Implementações cobertas nesta revisão (amostra)

- Multi-tenant / instâncias; mesmo celular de totem em várias igrejas  
- Stripe, paywall e **Gestão Liberada**  
- PIN por **e-mail**; texto LGPD por instância; **Ao sair** com URL  
- Modo Ghost (identidade efetiva, sem bounce ao Início, paywall do operador)  
- Home: bolo (aniversário/casamento), sticker, Abigail, Eu quero… (Cuidado Pastoral)  
- Recepção Familiar **Novos Membros**, convite `family_id`, pré-preenchimento de celular  
- Inbox de novos cadastros + auto-régua só para visitante efetivo  
- Lista de Famílias; Visitantes / Cadastro Rápido  
- Atribuições; Documentos oficiais; Apoio Mútuo (categoria → nomes → cartão)  
- Espaço Infantil com QR / código; cuidados da criança  
- Pastoral: solicitação de cancelamento + **Excluir** (super_admin)  
- Enxergar em buscas; Gestor sem ver Super Admin/PIN; Acessos Usuários só super_admin  

---

## Artefatos externos regeneráveis

```bash
# Pacotes Markdown (sem re-capturar telas — preserva PNGs em docs/manual-*/screens)
node scripts/embed-manual-painel-illustrations.mjs
node scripts/embed-manual-manutencao-illustrations.mjs
node scripts/build-pacotes-md.mjs

# PDFs e Word
npm run build:docs:pdf
npm run build:docs:doc
npm run build:access-roles-pdf
npm run build:analise-institucional-pdf
npm run build:analise-institucional-doc
npm run build:roteiro-institucional-pdf
npm run build:roteiro-institucional-doc
node scripts/build-experiencia-usuario-docx.mjs
node scripts/build-recepcao-familiar-pdf.mjs
```

Saídas principais: `PACOTE_*.md`, `pdfs/*`, `docs/*.docx`, `docs/Experiencia-do-Usuario-Conecta.docx`.

> `npm run build:docs:md` e `npm run build:docs` **re-capturam** telas a partir do `dist/` e apagam PNGs existentes em `docs/manual-painel/screens`. Use só quando o servidor de captura estiver disponível e as sessões de demo estiverem preparadas.

---

## Capturas

Pasta `Screeshot/` (cópias de rotas do app) e restauração de `docs/manual-painel/screens` / `docs/manual-manutencao/screens` a partir do histórico Git + cópias novas (Recepção, Régua, Pastoral, Access, Visitantes, Apoio Mútuo, etc.).

---

*Revisão documental v2026-10-05.*

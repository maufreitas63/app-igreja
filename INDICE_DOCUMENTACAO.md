# Índice da Documentação — Conecta+

Mapa das fontes técnicas, funcionais, operacionais e dos artefatos de entrega do **app-igreja / Conecta+**.

**Atualizado em:** 05/10/2026  
**Estado de navegação:** a experiência publicada é **Início + menu lateral + Eu quero… + Perfil + engrenagem**. O antigo carrossel de `/(tabs)/dashboard` e `/(tabs)/explore` está congelado; não deve orientar treinamento, venda ou validação.  
**Changelog desta revisão:** [`ATUALIZACOES_DOCUMENTACAO_2026-10.md`](ATUALIZACOES_DOCUMENTACAO_2026-10.md)

---

## 1. Comece por aqui

| Documento | Finalidade | Público |
|---|---|---|
| [`FUNCIONALIDADES.md`](FUNCIONALIDADES.md) | Fonte funcional completa e atual | Todos |
| [`MANUAL_ENTREGA.md`](MANUAL_ENTREGA.md) | Jornada do cliente, arquitetura, implantação e status | Cliente, operação e TI |
| [`MANUAL_DASHBOARD_MEMBRO.md`](MANUAL_DASHBOARD_MEMBRO.md) | Uso do Início, menu, Eu quero… e Perfil | Membros e famílias |
| [`MANUAL_DASHBOARD_MANUTENCAO.md`](MANUAL_DASHBOARD_MANUTENCAO.md) | Uso da engrenagem por grupo operacional | Secretaria, liderança e administração |
| [`FAQ.md`](FAQ.md) | Respostas rápidas do ambiente publicado | Todos |
| [`DESCRITIVO_APLICACAO.md`](DESCRITIVO_APLICACAO.md) | Stack, módulos, rotas, dados e segurança | TI e arquitetura |
| [`BLUEPRINT.md`](BLUEPRINT.md) | Mapa técnico e fluxos de referência | Produto, TI e manutenção |

PDFs correspondentes, quando gerados, ficam em [`pdfs/`](pdfs/).

---

## 2. Mapa do pacote de entrega

### 2.1 Fontes funcionais e operacionais

| Arquivo | Conteúdo |
|---|---|
| `FUNCIONALIDADES.md` | Produto publicado por domínio, público e rota |
| `MANUAL_DASHBOARD_MEMBRO.md` | Primeiro acesso, Início, Agenda, Espaço Infantil, Perfil, pastoral e menu |
| `MANUAL_DASHBOARD_MANUTENCAO.md` | Operação e Segurança, Pessoas, Culto/Eventos, Finanças e Governança/TI |
| `MANUAL_TREINAMENTO.md` | Missões práticas usando a navegação atual |
| `FAQ.md` | Login, família, recepção, Ghost, billing, totem e solução de problemas |
| `pacotes-funcionalidades.md` | Recorte comercial Básico/Padrão/Avançado |
| `docs/PROCESSO_RECEPCAO_FAMILIAR.md` | Processo ponta a ponta de convite, fila, inbox, régua e sticker |

### 2.2 Fontes técnicas e de governança

| Arquivo | Conteúdo |
|---|---|
| `DESCRITIVO_APLICACAO.md` | Arquitetura Expo 54/Supabase/Cloudflare, multi-tenant e Stripe |
| `BLUEPRINT.md` | Rotas, componentes conceituais, fluxos e cards congelados |
| `CONTROLE_ACESSO.md` | Modelo ACL e inventário de recursos |
| `MANUAL_CONTROLE_ACESSO.md` | Operação de papéis e grants |
| `CAMADAS_SEGURANCA.md` | Defesa em profundidade |
| `PAPEIS_CONTROLE_ACESSO.md` | Mapa visual de papéis |
| `DEPLOY_CLOUDFLARE.md` | Publicação da PWA |
| `CHECKLIST_VALIDACAO_POS_DEPLOY.md` | Verificações depois da publicação |

### 2.3 Pacotes derivados para o cliente

| Pacote | Fonte principal | Público |
|---|---|---|
| `PACOTE_1_VISAO_GERAL.md` | Funcionalidades, treinamento e FAQ | Todos |
| `PACOTE_2_OPERACAO.md` | Ecossistema e operação | Secretaria e líderes |
| `PACOTE_3_GOVERNANCA_TI.md` | ACL, segurança e Blueprint | Administração e TI |
| `PACOTE_4_ANEXO_TECNICO.md` | Arquitetura PWA e legado técnico | Arquitetura |
| `PACOTE_5_MANUAL_PAINEL.md` | Manual atual do membro | Membros e famílias |
| `PACOTE_6_MANUAL_MANUTENCAO.md` | Manual atual da engrenagem | Equipe e gestores |
| `PACOTE_7_TREINAMENTO_DIARIO.md` | Onboarding em sete dias | Membros |

Os pacotes são artefatos derivados. Quando houver divergência, prevalecem as fontes atualizadas e o código.

---

## 3. Ordem de leitura recomendada

### Membro ou família
1. `MANUAL_DASHBOARD_MEMBRO.md`.
2. `FAQ.md`.
3. `MANUAL_TREINAMENTO.md` ou Pacote 7.

### Secretaria, recepção e eventos
1. `MANUAL_DASHBOARD_MANUTENCAO.md`.
2. `docs/PROCESSO_RECEPCAO_FAMILIAR.md`.
3. `CHECKLIST_VALIDACAO_POS_DEPLOY.md`.

### Pastoral e tesouraria
1. Partes correspondentes de `MANUAL_DASHBOARD_MANUTENCAO.md`.
2. `FUNCIONALIDADES.md`.
3. `CONTROLE_ACESSO.md`.

### Super Administrador e TI
1. `MANUAL_ENTREGA.md`.
2. `DESCRITIVO_APLICACAO.md`.
3. `BLUEPRINT.md`.
4. `CAMADAS_SEGURANCA.md`, `CONTROLE_ACESSO.md` e `DEPLOY_CLOUDFLARE.md`.

---

## 4. Navegação que a documentação deve ensinar

- **Início:** eventos e avisos, Agenda da Família, aniversários do dia, sticker de novos registros, Abigail e Eu quero….
- **Menu lateral:** Perfil, Financeiro, Documentos oficiais, Minha Célula, Escalas, murais, Apoio Mútuo, Sugestões, ajuda, redes e Sobre.
- **Eu quero…:** Dízimos e Ofertas, Campanhas e Projetos, Primícias e Cuidado Pastoral.
- **Perfil:** dados cadastrais, serviços, família, Carteirinha, Trilha, Reembolsos e leitura.
- **Engrenagem:** módulos agrupados por ACL em Operação, Pessoas, Culto/Eventos, Finanças e Governança/TI.

`lib/appDrawerMenu.ts` é a fonte de verdade dos menus. `lib/frozenPublication.ts` define o que permanece fora da publicação.

---

## 5. Geração e manutenção

```bash
npm run build:docs:md
npm run build:docs:pdf
npm run build:docs
npm run build:docs:doc
npm run build:manual-entrega-pdf
npm run build:access-roles-pdf
npm run build:validation-checklist-xlsx
```

- `build:docs:md` regenera pacotes Markdown e ilustrações dos manuais.
- `build:docs:pdf` gera pacotes PDF, Manual de Entrega e Descritivo.
- `build:docs` também executa `build:web`; use apenas quando desejar validar o produto e todos os documentos.
- `build:docs:doc` produz os documentos Word institucionais.
- Antes de gerar, atualize as fontes; não mantenha correções apenas no PDF ou no pacote derivado.

---

## 6. Documentos de validação e suporte

| Artefato | Uso |
|---|---|
| `CHECKLIST_VALIDACAO_POS_DEPLOY.md` | Smoke test de produção |
| `pdfs/CHECKLIST_VALIDACAO_POR_PAPEL.xlsx` | Validação por identidade/ACL |
| `docs/PROCESSO_RECEPCAO_FAMILIAR.md` | Teste ponta a ponta de recepção |
| `DEPLOY_CLOUDFLARE.md` | Build, push, Cloudflare e cache |
| `README.md` | Visão curta do repositório e comandos |

---

## 7. Fora da entrega funcional publicada

- `/(tabs)/dashboard` é compatibilidade/redirecionamento, não o hub do produto.
- `/(tabs)/explore` e `/explore` estão congelados.
- Cards antigos `event_alt`, `qr`, `kids_teens`, `offerings`, `pastoral`, `members_list`, `birthdays`, `financial`, `vigilance_scales`, `parking_vehicle_v2`, `scale_roster`, `grouped_manage`, `administrativo` e `campaign_card` não devem ser republicados.
- Minha Célula e Mural de Oportunidades continuam vivos em rotas dedicadas.
- `Cópia (1)BLUEPRINT.md`, regras de agente e scripts internos não são documentação de cliente.

---

*Conecta+ · pacote documental v2026-10-05 · revisão de 05/10/2026.*

# Manual de Entrega — Conecta+

**Sistema:** plataforma multi-tenant de gestão e relacionamento para igrejas
**Versão do app:** 1.0.0
**Data de referência:** 05/10/2026
**Públicos:** cliente, liderança, operação, produto e equipe técnica

---

## Como usar este manual

- **§1–§3:** valor do produto e jornada publicada.
- **§4:** arquitetura, dados, segurança, implantação e sustentação.
- **§5:** estado atual, critérios de aceite e pontos de atenção.

Fontes complementares: `FUNCIONALIDADES.md`, `MANUAL_DASHBOARD_MEMBRO.md`, `MANUAL_DASHBOARD_MANUTENCAO.md`, `DESCRITIVO_APLICACAO.md`, `BLUEPRINT.md` e `INDICE_DOCUMENTACAO.md`.

---

# Parte A — Produto entregue

## 1. Visão geral

### 1.1 O que é

O Conecta+ é uma PWA instalável e aplicação Expo para múltiplas igrejas. Centraliza cadastro e família, comunicação, eventos, presença, Espaço Infantil, pastoral, discipulado, células, escalas, murais, documentos, finanças, governança, cobrança e auditoria.

### 1.2 Experiência publicada

O produto não é mais organizado pelo antigo carrossel. O percurso atual é:

| Área | Uso |
|---|---|
| **Início** | Eventos, avisos, Agenda da Família, aniversários do dia, sticker, Abigail e Eu quero… |
| **Menu lateral** | Perfil, Financeiro, Documentos, Célula, Escalas, murais, Apoio Mútuo, Sugestões e ajuda |
| **Eu quero…** | Dízimos/Ofertas, Campanhas/Projetos, Primícias e Cuidado Pastoral |
| **Perfil** | Dados, família, Carteirinha, Trilha, serviços e Reembolsos |
| **Engrenagem** | Operação e segurança, pessoas, culto/eventos, finanças/inteligência e governança/TI |

`/(tabs)/dashboard` é compatibilidade e redirecionamento. `/(tabs)/explore` está congelado. Cards antigos não devem ser apresentados como produto publicado.

### 1.3 Públicos

- visitante, congregado, membro e família;
- recepção, secretaria e operação de culto;
- voluntários, líderes de célula e escala;
- pastoral e intercessão;
- tesouraria e administração;
- Gestor de Controle de Acesso e Super Administrador;
- dispositivo de totem e equipe do Espaço Infantil;
- administração da rede de igrejas.

### 1.4 Benefícios

| Dor | Entrega |
|---|---|
| Cadastros dispersos | Perfil, família, formulário público, fila, inbox e diretórios |
| Acolhimento sem sequência | Recepção, sticker, Régua D+1/D+4/D+8 e mudança de papel |
| Presença manual | Agenda, audiência, QR/totem, quórum e geofence |
| Retirada infantil insegura | QR familiar, entrada/saída e dados de cuidado |
| Pedidos pastorais sem rastreio | Pedido, sigilo, estágios, agenda e cancelamento controlado |
| Escalas e comunicação fragmentadas | Programação em bloco, contatos e avisos |
| Finanças sem transparência | Visão do membro, tesouraria, campanhas, Primícias e RD |
| Governança fraca | ACL, RLS, RPCs, auditoria, Ghost e isolamento multi-tenant |
| SaaS sem controle comercial | Planos Stripe, capacidade, contratos e Gestão Liberada |

---

## 2. Jornada do usuário

### 2.1 Entrada e seleção da igreja

1. O usuário abre o domínio/link da igreja.
2. Informa celular e continua.
3. Digita PIN de quatro dígitos.
4. Primeiro PIN e recuperação são enviados exclusivamente por e-mail.
5. Se vinculado a várias instâncias, seleciona a igreja.
6. O app resolve `profile_id`, `tenant_id`, sessão e onboarding.
7. Cadastro incompleto abre Cadastro; LGPD pendente abre LGPD; caso regular abre Início.

A sessão é restaurada enquanto válida. Logout limpa referências locais e pode abrir o site oficial se a opção **Ao sair** estiver habilitada na instância.

### 2.2 Cadastro e família

- cadastro mínimo com nome, nascimento, telefone e CEP;
- texto LGPD e switch `LGPD_Ativo` por tenant;
- selfie quando exigida;
- endereço assistido por CEP;
- Perfil e Dados Cadastrais;
- Gerenciar Família com parentesco, transferências e `family_id`;
- Carteirinha Digital com identificação familiar;
- campos de saúde/cuidado infantil e data de casamento.

### 2.3 Início e Agenda

1. Início carrega eventos publicados e avisos da igreja ativa.
2. O usuário toca no evento e abre a Agenda da Família.
3. Marca os participantes em Audiência.
4. Pode adicionar compromisso ao calendário.
5. Dependendo do evento, apresenta QR no totem, usa geofence ou registra quórum.
6. Para criança, o QR familiar também apoia entrada e retirada no Espaço Infantil.

O bolo só aparece quando há aniversário pessoal ou de casamento naquele dia.

### 2.4 Eu quero…

- **Dízimos e Ofertas:** valor, recebedor e chave PIX.
- **Campanhas e Projetos:** contribuição identificada em campanha ativa.
- **Primícias:** compromisso em espécie por categoria.
- **Cuidado Pastoral:** motivo, beneficiário, destino e descrição.

Em Cuidado Pastoral, pedido ainda novo pode ser excluído conforme a regra. Depois do início do acompanhamento, o membro solicita cancelamento e justifica; o Super Administrador confirma **Excluir** no painel pastoral.

### 2.5 Perfil, menu e vida comunitária

O menu dá acesso às rotas permanentes: Financeiro, Documentos oficiais, Minha Célula, Escalas, Mural de Oportunidades, Mural de Generosidade, Apoio Mútuo, Sugestões, Como faço…?, Redes Sociais e Sobre.

O Perfil concentra Dados Cadastrais, serviços oferecidos, família, Carteirinha, Trilha de Discipulado, Reembolsos e Cantinho da Leitura conforme ACL.

### 2.6 Abigail

A Abigail aparece no Início, ao lado de Eu quero…, para papéis autorizados. A chave Gemini pertence à igreja e fica no Supabase. Somente Super Administrador configura a chave; interações podem ser auditadas conforme grant. A assistente não substitui aconselhamento pastoral nem emergência.

---

## 3. Jornada operacional

### 3.1 Engrenagem

Os módulos são agrupados por domínio e filtrados pela ACL:

- **Operação e Segurança:** salas, totem e autorização de mídia.
- **Gestão de Pessoas:** Cadastro Rápido, Recepção, Régua, diretórios, mapa, aniversários, pastoral, células, murais, administrativo e livros.
- **Culto e Eventos:** programação, Gantt, avisos, salas, escalas e presença.
- **Finanças e Inteligência:** informações financeiras, campanhas, Primícias e preditivo.
- **Governança e TI:** Trilha, ajuda, relatórios, ACL, papéis, transferência, logs, Ghost, billing, Aliança, instâncias e Gemini.

### 3.2 Recepção, inbox, régua e sticker

1. Recepção monta convite; **Novos Membros** preserva `family_id`.
2. Link leva tenant e celular pré-preenchido.
3. Formulário gera lote pendente.
4. Operador revisa conflitos, CEP, nascimento e integrantes.
5. Gravar promove pessoas; Rejeitar não cria perfis finais.
6. Novo perfil entra na inbox da igreja.
7. Régua automática nasce apenas para visitante efetivo: `visitantes` sem `congregado`, `member` ou `super_admin`, com cadastro mínimo e telefone.
8. Sticker prioriza a fila de Recepção; depois abre Mudança Papéis filtrada em Visitante.

### 3.3 Espaço Infantil e Cadastro Rápido

Cadastro Rápido distingue novo visitante, recorrente e membro; preserva/cria família, coleta crianças e dados de cuidado, gera QR/crachá e compartilha por WhatsApp. A equipe lê o mesmo vínculo na entrada e na saída.

### 3.4 Finanças

- membro consulta resultado, comparativos, 12 meses, orçamento e saldos;
- tesouraria importa/edita lançamentos e concilia RDs;
- campanhas têm período, meta e publicação;
- Primícias registra compromissos em espécie;
- billing Stripe mantém plano, contrato, capacidade, pagamento, cancelamento e retomada.

**Gestão Liberada** é um parâmetro por tenant: remove o paywall comercial de toda a instância, sem conceder ACL. Instância inativa e assinatura são estados distintos.

### 3.5 Modo Ghost

O auditor escolhe um alvo e navega com sua identidade efetiva. Perfil, telefone, família, ACL e dados pertencem ao alvo; o bypass do Super Administrador real fica desligado. Iniciar e encerrar Ghost levam ao Início uma vez. Durante a simulação, abrir rota não deve provocar bounce. Billing, tenant e paywall permanecem com o operador real.

### 3.6 Multi-tenant

Cada operação usa igreja ativa. Perfis, famílias, eventos, documentos, finanças, pastoral, recepção, IA e logs são isolados por `tenant_id`. Caches são invalidados ao trocar instância. O mesmo celular pode existir em tenants distintos, inclusive como totem.

---

# Parte B — Arquitetura e sustentação

## 4. Guia técnico

### 4.1 Stack

| Camada | Tecnologia |
|---|---|
| Cliente | Expo 54.0.37, React 19.1, React Native 0.81.5, TypeScript 5.9 |
| Rotas | Expo Router 6, file-based, export web |
| Backend | Supabase/PostgreSQL, PostgREST, RPCs, RLS, Storage, Realtime |
| Form público | Vite/React em `standalone/cadastro-familia/` |
| Hospedagem | Cloudflare Pages, `dist/` |
| Pagamentos | Stripe via APIs no ambiente Cloudflare |
| IA | Gemini, chave por tenant no Supabase |

### 4.2 Organização do código

| Pasta | Responsabilidade |
|---|---|
| `app/` | rotas Expo Router e composição de telas |
| `components/` | UI, formulários, modais e painéis |
| `hooks/` | estado/efeitos de domínio |
| `lib/` | sessão, ACL, APIs, regras e utilitários |
| `scripts/` | SQL, validações, build e documentação |
| `standalone/cadastro-familia/` | formulário público |
| `public/` | assets PWA e configuração web |

### 4.3 Sessão e identidade

O app usa autenticação customizada por RPC, não uma sessão Supabase Auth padrão para todos os usuários. `profile_sessions` fornece token; o fetch injeta cabeçalhos de sessão. O servidor resolve perfil e tenant. No Ghost, helpers de identidade efetiva substituem o perfil real nos domínios do usuário.

### 4.4 Dados centrais

- `profiles`, `members`, famílias e `profile_sessions`;
- `tenant_instances`/estrutura equivalente e parâmetros por igreja;
- `events`, `event_registrations`, `checkins`, locais e salas;
- recepção, inbox e visitor follow-up;
- pastoral e agenda/slots;
- financials, campanhas, Primícias e expense reports;
- escalas, voluntários e tipos;
- ACL: recursos, papéis, grants e vínculos;
- billing, planos, assinaturas, pagamentos e contratos;
- trilha, livros, murais, sugestões, documentos e auditorias.

### 4.5 Segurança em profundidade

1. **Dispositivo:** PIN, armazenamento local, câmera/localização e separação de totem.
2. **Cliente:** guards fail-closed, filtro de menu/ações/colunas e identidade efetiva.
3. **Transporte:** HTTPS, anon key e cabeçalhos de sessão; nunca `service_role` no cliente.
4. **Banco:** RLS, tenant, RPCs `SECURITY DEFINER`, transações, constraints e auditoria.

O Gestor em Controle de Acesso é blindado no SQL: não vê Super Administrador, logs do Super Administrador nem PIN/senha. O cliente repete os filtros como defesa em profundidade.

### 4.6 RPCs e operações sensíveis

RPCs cuidam de login/sessão, ACL, cadastro familiar, mudança de papéis, check-in, geofence, ciclos de escala, importação financeira, billing e cancelamento pastoral. Operações críticas validam ator, tenant, alvo e grant no servidor.

### 4.7 Rotas essenciais

| Rota | Uso |
|---|---|
| `/` | login |
| `/forgot-password` | recuperação por e-mail |
| `/register`, `/lgpd` | onboarding |
| `/selecionar-igreja` | instância |
| `/(tabs)` | Início |
| `/(tabs)/dashboard` | legado/redirecionamento |
| `/perfil`, `/manage-profile`, `/manage-members` | perfil/família |
| `/ofertas`, `/primicias`, `/pastoral`, `/pastoral-history` | Eu quero… |
| `/financial`, `/expense-report`, `/documentos-oficiais` | finanças/documentos |
| `/pequeno-grupo`, `/escalas`, `/mural-*`, `/apoio-mutuo` | comunidade |
| `/maintenance-dashboard` | painéis da engrenagem |
| `/visitantes-cadastro-rapido`, `/cracha-visitante` | visitante/QR |
| `/totem-checkin`, `/configuracao-salas` | presença/salas |
| `/billing`, `/igrejas` | comercial/tenants |
| `/cadastro-familia` | entrada para formulário público |

### 4.8 Publicação congelada

`lib/frozenPublication.ts` é autoritativo. Cards antigos permanecem no código apenas para compatibilidade. Deep links suportados são resolvidos para rotas dedicadas; sem substituta, vão ao Início. Não importar/reconectar implementação congelada.

### 4.9 Ambiente e comandos

```bash
npm install
npm run web
npm run lint
npm run build:web
npm run build:family-form
npm run build:docs:md
npm run build:docs:pdf
```

Node.js mínimo: 20.19.4. Variáveis e segredos não são versionados.

### 4.10 SQL

Scripts ficam em `scripts/*.sql` e são aplicados ao projeto Supabase linkado, por exemplo:

```bash
npx supabase db query --linked -f "scripts/arquivo.sql"
```

Aplicar SQL e publicar PWA são etapas diferentes; ambos devem ser rastreados. O script permanece versionado depois de aplicado.

### 4.11 Deploy

```text
commit/push main → Cloudflare Pages → npm run build:web → dist/
```

Após publicação: aguardar Success, fazer hard refresh e executar `CHECKLIST_VALIDACAO_POS_DEPLOY.md`. Validar também RPCs/SQL quando a mudança tocar banco.

---

## 5. Status da entrega em 05/10/2026

| Área | Estado | Observação |
|---|---|---|
| PWA/Cloudflare | Operacional | build em `dist/` |
| Início/menu/engrenagem | Publicado | experiência principal |
| Carrossel antigo | Congelado | não treinar/republicar |
| Multi-tenant | Implementado | isolamento precisa ser preservado em toda RPC |
| Login/PIN/e-mail | Implementado | WhatsApp fora da autenticação |
| Família/Recepção | Implementado | convite com `family_id`, fila e inbox |
| Régua | Implementado | somente visitante efetivo |
| Eventos/totem/geofence | Implementado | depende de configuração/SQL |
| Espaço Infantil | Implementado | entrada e saída por QR |
| Pastoral | Implementado | exclusão controlada após cancelamento |
| Financeiro/campanhas/RD | Implementado | por ACL e tenant |
| ACL/Gestor | Implementado | blindagem autoritativa no SQL |
| Ghost | Implementado | identidade efetiva; sem bounce |
| Stripe/Gestão Liberada | Implementado | por tenant |
| Abigail | Implementado | chave e auditoria por igreja |
| Documentação | Atualizada | fontes em 05/10/2026; derivados devem ser regenerados |

### 5.1 Critérios de aceite

- navegação ensinada sem carrossel;
- menus coincidem com `lib/appDrawerMenu.ts`;
- tenant correto em tela, dados e RPC;
- sessão real e Ghost não se misturam;
- Gestor não enxerga Super Admin/PIN;
- recepção preserva família e régua só nasce para visitante efetivo;
- paywall respeita assinatura/Gestão Liberada e ignora identidade simulada;
- rotas congeladas não são publicadas;
- build, SQL e smoke test são concluídos na ordem adequada.

### 5.2 Pontos de atenção

- SQL e cliente fora de sincronia podem produzir RPC ausente ou regra antiga.
- cache local pode exigir logout/login ou hard refresh.
- geofence exige coordenadas, janela, raio e precisão válidos.
- documentos e módulos vazios podem significar ausência de publicação, não falha.
- dados médicos, pastorais, financeiros e de diretório exigem finalidade e grant.

### 5.3 Checklist de entrega

- [ ] tenant, marca, contatos, PIX, redes e Ao sair configurados;
- [ ] App Ativo, Gestão Liberada e LGPD revisados;
- [ ] papéis/grants e blindagem do Gestor validados;
- [ ] eventos, salas, totem, quórum e geofence testados;
- [ ] Recepção, inbox, régua e sticker testados;
- [ ] billing/Stripe e capacidade verificados;
- [ ] Ghost testado com alvo sem grants amplos;
- [ ] SQL aplicado e smoke test executado;
- [ ] documentação derivada/PDF regenerada.

---

*Conecta+ · Manual de Entrega · revisão de 05/10/2026.*

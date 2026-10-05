# Blueprint — Conecta+

Referência de arquitetura, navegação, módulos, fluxos e segurança do `app-igreja`.

**Atualizado em:** 05/10/2026
**Fontes de verdade de publicação:** `lib/appDrawerMenu.ts` e `lib/frozenPublication.ts`.

---

## 1. Visão do sistema

| Aspecto | Implementação |
|---|---|
| Produto | PWA/app Expo multi-tenant para igrejas |
| Cliente | Expo 54, React 19, React Native 0.81, TypeScript |
| Rotas | Expo Router 6 |
| Backend | Supabase/PostgreSQL, PostgREST, RPC, RLS, Storage e Realtime |
| Sessão | celular + PIN, token de sessão e tenant ativo |
| Deploy | Cloudflare Pages, `npm run build:web` → `dist/` |
| Pagamentos | Stripe por endpoints Cloudflare |
| IA | Gemini por tenant |

---

## 2. Blueprint de navegação publicada

```text
Login / seleção de igreja / onboarding
                  │
                  ▼
                Início
       ┌──────────┼──────────────┐
       ▼          ▼              ▼
 Menu lateral  Eu quero…     Engrenagem
       │          │              │
       ▼          ▼              ▼
 Perfil e      Contribuir     Operação e Segurança
 módulos       Pastoral       Gestão de Pessoas
 do membro     Primícias      Culto e Eventos
                              Finanças e Inteligência
                              Governança e TI
```

### 2.1 Início

- próximos eventos e Agenda da Família;
- avisos e notificações pessoais;
- bolo de aniversários pessoais/casamento do dia;
- sticker de novos registros;
- Abigail para papéis autorizados;
- faixa Eu quero….

### 2.2 Menu lateral do membro

1. Início
2. Perfil
3. Financeiro
4. Documentos oficiais
5. Minha Célula
6. Escalas
7. Mural de Oportunidades
8. Mural de Generosidade
9. Apoio Mútuo
10. Sugestões
11. Como faço…?
12. Redes Sociais
13. Sobre o Conecta+

### 2.3 Engrenagem

| Grupo | Módulos |
|---|---|
| Operação e Segurança | Configuração de salas, Totem, Autorização de imagem/voz |
| Gestão de Pessoas | Cadastro Rápido, Recepção, Régua, membros, usuários, famílias, mapa, aniversários, pastoral, células, murais, administrativo, livros |
| Culto e Eventos | Programação, Gantt, avisos, salas, tipos/voluntários/programação de escala, presença |
| Finanças e Inteligência | Informações Financeiras, Campanhas, Primícias, Modelo Preditivo |
| Governança e TI | Trilha, ajuda, conhecimento, relatórios, ACL, papéis, transferência, logs, Ghost, billing, Aliança, instâncias, Gemini |

Itens são filtrados por vínculo, papel, grant, tenant e identidade efetiva.

---

## 3. Legado congelado

O antigo Painel não é o produto publicado.

### Cards congelados

`event_alt`, `qr`, `kids_teens`, `offerings`, `pastoral`, `members_list`, `birthdays`, `financial`, `vigilance_scales`, `parking_vehicle_v2`, `scale_roster`, `grouped_manage`, `administrativo` e `campaign_card`.

### Rotas congeladas

- `/(tabs)/explore`
- `/explore`

### Regras

- `/(tabs)/dashboard` redireciona para a experiência viva;
- não importar `frozen-dashboard-cards.comment.ts`;
- deep links antigos usam `resolveFrozenDashboardDeepLink`;
- quando há substituta, abrem rota dedicada; sem substituta, abrem Início;
- Minha Célula e Mural de Oportunidades são exceções vivas em rotas dedicadas.

---

## 4. Mapa de rotas

| Rota | Responsabilidade |
|---|---|
| `/` | login, restauração e entrada do totem |
| `/forgot-password` | recuperação por e-mail |
| `/register` | cadastro inicial |
| `/selecionar-igreja` | escolha do tenant |
| `/lgpd` | consentimento/selfie |
| `/(tabs)` | Início |
| `/perfil` | hub pessoal |
| `/manage-profile` | dados cadastrais |
| `/manage-members` | família |
| `/lista-familias`, `/membros`, `/mapa-geolocalizacao` | diretórios |
| `/ofertas`, `/primicias` | contribuições |
| `/pastoral`, `/pastoral-history` | cuidado pastoral |
| `/financial`, `/expense-report` | finanças/RD |
| `/documentos-oficiais`, `/administrativo` | documentos |
| `/pequeno-grupo` | Minha Célula |
| `/mural-oportunidades`, `/mural-generosidade` | murais |
| `/apoio-mutuo` | serviços comunitários |
| `/escalas` | escala do membro |
| `/visitantes-cadastro-rapido`, `/cracha-visitante` | visitante e QR |
| `/totem-checkin` | confirmação de presença |
| `/configuracao-salas` | configuração infantil |
| `/trilha-discipulado` | jornada formativa |
| `/livros-doados` | acervo |
| `/como-faco`, `/conhecimento` | ajuda |
| `/maintenance-dashboard` | painéis de gestão |
| `/atribuicoes` | papéis operacionais |
| `/billing` | planos/assinatura |
| `/igrejas` | tenants |
| `/alianca-conecta-reino`, `/alianca-indicados` | rede/parceria |
| `/cadastro-familia` | redirecionamento ao formulário público |

---

## 5. Arquitetura de componentes

```text
app/_layout
  ├─ restauração de sessão
  ├─ seleção de tenant
  ├─ gate de app/billing
  ├─ roteamento de onboarding
  └─ providers globais

app/(tabs)/index (Início)
  ├─ eventos / agenda
  ├─ avisos
  ├─ admission sticker
  ├─ Abigail
  ├─ Eu quero…
  └─ drawer

app/maintenance-dashboard
  ├─ resolve panel
  ├─ ACL/identidade efetiva
  └─ componentes Maintenance*
```

`appDrawerMenu.ts` resolve item → rota ou painel. `navigateWithScreenAccess` aplica gate; no Ghost, helpers específicos impedem bounce ao Início.

---

## 6. Domínios de dados

| Domínio | Entidades principais |
|---|---|
| Identidade | profiles, members, famílias, profile_sessions |
| Tenant | instâncias, vínculos, app_parameters, branding |
| ACL | resources, roles, grants, profile roles, logs |
| Eventos | events, registrations, checkins, locations, rooms |
| Recepção | lotes, integrantes, inbox e visitor follow-up |
| Pastoral | requests, categories, assignments, slots |
| Financeiro | financials, campaigns, Primícias, expense reports |
| Escalas | tipos, voluntários, programação e trocas |
| Conteúdo | documentos, livros, trilha, conhecimento, avisos |
| Comercial | plans, subscriptions, payments, contracts, referrals |
| IA | configuração Gemini e logs de interação |

Todas as entidades operacionais devem ser tenant-scoped.

---

## 7. Fluxos críticos

### 7.1 Login e onboarding

```text
celular → verificar_login → sessão/token + tenant
 → múltiplos tenants? selecionar igreja
 → cadastro mínimo?
 → LGPD ativo e pendente?
 → Início
```

Primeiro PIN/recuperação: e-mail. WhatsApp é operacional.

### 7.2 Evento e presença

```text
staff publica evento
 → Início lista evento
 → família abre Agenda
 → marca audiência
 → [totem QR | geofence | quórum]
 → checkin confirmado
```

Geofence valida janela, raio, precisão e coordenadas. Alteração crítica do evento/local invalida presença incompatível.

### 7.3 Espaço Infantil

```text
família/visitante cadastra criança + cuidado
 → audiência/QR
 → equipe lê QR na sala
 → confirma entrada
 → responsável reapresenta QR
 → equipe confirma retirada
```

### 7.4 Recepção Familiar

```text
convite livre ou Novos Membros
 → tenant + family_id + celular
 → formulário público
 → lote pending
 → revisão/conflitos
 → processar ou rejeitar
 → profiles/members + inbox
 → régua somente visitante efetivo
 → sticker orienta admissão
```

### 7.5 Pastoral

```text
membro envia pedido
 → fila por destino/sigilo
 → responsável e estágio
 → encerramento
ou
 → solicitação de cancelamento
 → Super Admin confirma Excluir
```

### 7.6 Billing

```text
instância escolhe plano
 → checkout Stripe
 → retorno/webhook
 → assinatura/pagamento sincronizados
 → gate por status/capacidade
```

Se Gestão Liberada estiver ativa, o gate comercial é dispensado; ACL continua ativa.

### 7.7 Ghost

```text
operador real seleciona alvo
 → sessão registra target
 → Início uma vez como alvo
 → perfil/família/ACL/dados do alvo
 → encerra Ghost
 → Início na identidade real
```

Cobrança e tenant permanecem vinculados ao operador real.

---

## 8. Segurança e confiança

### 8.1 Camadas

1. dispositivo e sessão local;
2. cliente, guards e filtros;
3. HTTPS e cabeçalhos de sessão;
4. PostgreSQL com RLS/RPC/tenant;
5. infraestrutura Cloudflare/Supabase/Stripe.

### 8.2 ACL

Recursos: `screen`, `dashboard_card`, `table`, `column`; ações `view` e `update`. A UI oculta o que não está concedido, mas o servidor é autoritativo.

### 8.3 Gestor de Controle de Acesso

A proteção SQL impede o Gestor de:

- listar/ver/editar `super_admin`;
- ver registros de acesso do Super Administrador;
- ver ou conceder acesso a `access_pin`, password ou senha.

### 8.4 Multi-tenant

RPCs obtêm tenant da sessão e validam alvo. Formulários públicos não devem depender de default global. Storage, documentos, billing, IA e parâmetros também são escopados.

### 8.5 Ghost

O alvo é a identidade efetiva. Operador real não fura ACL. Grant negado no Ghost não provoca redirect automático nem overlay de “sem acesso nesta simulação”; RLS e dados continuam como alvo.

---

## 9. Regras operacionais por módulo

### Recepção
- nunca unir pessoa apenas por telefone;
- preservar `family_id` consistente;
- conflito impede promoção;
- inbox e fila são conceitos diferentes;
- régua automática só para visitante efetivo.

### Pastoral
- sigilo não é distribuído à intercessão por padrão;
- cancelamento acompanhado exige justificativa;
- Excluir definitivo é reservado ao Super Administrador no estado válido.

### Financeiro
- membro é leitura;
- escrita é tesouraria/RPC;
- RD finalizado tem regras próprias de exclusão/conciliação;
- dados sempre por tenant.

### Billing
- instância ativa não é sinônimo de assinatura ativa;
- Gestão Liberada não é Super Admin e não é grant;
- Ghost não altera paywall.

---

## 10. Menu técnico de manutenção

| `moduleKey` | Destino |
|---|---|
| `family_reception` | painel `family_reception` |
| `visitor_followup` | painel `visitor_followup` |
| `pastoral_care` | painel `pastoral_care` |
| `financials` | painel `financials` |
| `access_control` | painel `access_control` |
| `mudanca_papeis` | painel `mudanca_papeis` |
| `profile_access_insights` | painel `profile_access_insights` |
| `auditor` | painel `auditor` |
| `menu_billing` | `/billing` |
| `menu_igrejas` | `/igrejas` |
| `menu_salas` | `/configuracao-salas` |
| `menu_totem` | `/totem-checkin` |

Outros itens seguem o mapa completo de `APP_DRAWER_SETTINGS_ITEMS`.

---

## 11. Build e implantação

### Web

```text
git push main → Cloudflare Pages → npm run build:web → dist/
```

### Banco

```bash
npx supabase db query --linked -f "scripts/arquivo.sql"
```

### Validação

- lint/build proporcional à mudança;
- aplicar SQL antes de depender da RPC;
- smoke test por papel e tenant;
- validar Ghost, Gestor e billing quando tocados;
- aguardar Success no Cloudflare e fazer hard refresh.

---

## 12. Critérios para alteração futura

1. Nova navegação do membro entra em `APP_DRAWER_MENU_ITEMS` ou Eu quero….
2. Nova gestão entra em grupo de `APP_DRAWER_SETTINGS_ITEMS`.
3. Toda rota recebe política explícita de sessão/ACL/tenant.
4. Escrita sensível usa RPC transacional.
5. Ghost usa identidade efetiva.
6. Billing nunca usa alvo simulado.
7. Não reconectar cards congelados sem decisão explícita de publicação.
8. Atualizar `FUNCIONALIDADES.md`, manuais, Blueprint e índice.

---

## 13. Status de publicação

| Superfície | Estado |
|---|---|
| Início | Publicada |
| Menu lateral | Publicado |
| Eu quero… | Publicado |
| Perfil | Publicado |
| Engrenagem | Publicada e filtrada por ACL |
| Rotas dedicadas | Publicadas conforme grant |
| Dashboard antigo | Congelado/redirecionado |
| Explore antigo | Congelado |

*Conecta+ · Blueprint técnico e funcional · revisão de 05/10/2026.*

# Descritivo Técnico — Conecta+

**Sistema:** app-igreja / Conecta+
**Versão:** 1.0.0
**Data de referência:** 05/10/2026

---

## 1. Resumo executivo

O Conecta+ é uma plataforma Expo/React Native com canal principal PWA, backend Supabase e publicação Cloudflare Pages. Uma única base atende múltiplas igrejas com isolamento por `tenant_id`. O produto cobre identidade, família, eventos, presença, recepção, acolhimento, Espaço Infantil, pastoral, voluntariado, documentos, finanças, controle de acesso, auditoria, IA e cobrança SaaS.

A navegação publicada parte de **Início**, **menu lateral**, **Eu quero…**, **Perfil** e **engrenagem**. O carrossel antigo não é uma superfície ativa de produto.

---

## 2. Stack e execução

| Item | Tecnologia |
|---|---|
| Runtime de build | Node.js >= 20.19.4 |
| Linguagem | TypeScript 5.9, JavaScript ESM e PostgreSQL SQL |
| Aplicação | Expo SDK 54.0.37 |
| UI | React 19.1, React Native 0.81.5 e React Native Web |
| Rotas | Expo Router 6.0.24 |
| Estado/formulários | hooks React, React Hook Form e Zod |
| Banco/API | Supabase/PostgreSQL, PostgREST, RPCs, RLS, Storage e Realtime |
| Mapas | Leaflet web e react-native-maps |
| Formulário público | Vite 6 |
| Hospedagem | Cloudflare Pages |
| Pagamentos | Stripe, mediado por endpoints no Cloudflare |
| IA | Gemini com chave por tenant no Supabase |

O cliente Supabase opera com `persistSession: false`; a aplicação mantém sua própria referência de sessão e token.

---

## 3. Arquitetura lógica

```text
PWA / Expo
  ├─ app/          rotas e composição
  ├─ components/   UI e painéis
  ├─ hooks/        estado e efeitos
  └─ lib/          domínio, sessão, ACL e APIs
       │ HTTPS + anon key + cabeçalhos de sessão
       ▼
Supabase
  ├─ PostgREST/RPC
  ├─ PostgreSQL + RLS + triggers
  ├─ Storage
  └─ Realtime

Cloudflare Pages
  ├─ conteúdo estático dist/
  └─ APIs de checkout/webhook Stripe
```

Não há servidor Express intermediário para a lógica de acesso. Autorização autoritativa está no PostgreSQL/RPC; a UI replica filtros para usabilidade e defesa em profundidade.

---

## 4. Navegação e rotas

### 4.1 Superfícies publicadas

- **Início (`/(tabs)`):** eventos, avisos, aniversário do dia, Agenda, sticker, Abigail e Eu quero….
- **Menu:** itens de autonomia definidos em `APP_DRAWER_MENU_ITEMS`.
- **Engrenagem:** módulos de gestão definidos em `APP_DRAWER_SETTINGS_ITEMS` e agrupados em cinco domínios.
- **Rotas dedicadas:** telas vivas acessíveis pelo menu, ações e deep links.

### 4.2 Rotas principais

| Domínio | Rotas |
|---|---|
| Acesso | `/`, `/forgot-password`, `/register`, `/lgpd`, `/selecionar-igreja`, `/sessao-encerrada` |
| Home | `/(tabs)`, `/avisos` |
| Perfil/família | `/perfil`, `/manage-profile`, `/manage-members`, `/lista-familias`, `/membros`, `/aniversariantes` |
| Comunidade | `/pequeno-grupo`, `/escalas`, `/mural-oportunidades`, `/mural-generosidade`, `/apoio-mutuo` |
| Eu quero… | `/ofertas`, `/primicias`, `/pastoral`, `/pastoral-history` |
| Financeiro/documentos | `/financial`, `/expense-report`, `/documentos-oficiais`, `/administrativo` |
| Eventos | `/visitantes-cadastro-rapido`, `/cracha-visitante`, `/totem-checkin`, `/configuracao-salas`, `/agenda-cancelar` |
| Conteúdo | `/trilha-discipulado`, `/livros-doados`, `/suggestions-improvements`, `/como-faco`, `/conhecimento` |
| Administração | `/maintenance-dashboard`, `/atribuicoes`, `/billing`, `/igrejas`, `/alianca-conecta-reino`, `/alianca-indicados`, `/admin/orquestrador` |
| Público | `/cadastro-familia` redireciona ao standalone |

### 4.3 Publicação congelada

`lib/frozenPublication.ts` contém a lista autoritativa. `/(tabs)/dashboard` redireciona para a experiência viva; `/(tabs)/explore` e `/explore` estão congelados. Deep links de cards antigos são resolvidos para rotas dedicadas quando existe equivalente. `small_group` e `opportunity_mural_card` continuam vivos em `/pequeno-grupo` e `/mural-oportunidades`.

---

## 5. Módulos funcionais

### Identidade e família
Login celular/PIN, e-mail de primeiro acesso, recuperação, onboarding, LGPD por tenant, perfil, endereço, selfie, PIN, família, carteira digital e transferência.

### Início e comunicação
Eventos/avisos, agenda familiar, celebrações do dia, notificações pessoais, sticker de admissão, Abigail e ações Eu quero….

### Recepção e acolhimento
Formulário público, convite com tenant/`family_id`, Novos Membros, fila, matching, conflitos, inbox, Régua D+1/D+4/D+8 e mudança de papéis.

### Eventos e presença
CRUD/publicação, audiência, capacidade, calendário, totem QR, quórum, geofence, locais, check-in do Espaço Infantil e Cadastro Rápido.

### Pastoral
Pedidos com sigilo/intercessão, histórico, estágios, responsável, agenda/slots, cancelamento e exclusão confirmada por Super Administrador.

### Comunidade
Células, escalas, oportunidades, generosidade, Apoio Mútuo, sugestões, livros, Trilha e documentos oficiais.

### Finanças
Dízimos/ofertas, campanhas, Primícias, leitura do membro, importação/planejamento, comentários, RD e conciliação.

### Governança
ACL, papéis, Atribuições, mudança/transferência, relatórios, logs de acesso, Ghost, tenants, Gemini e parâmetros.

### Comercial
Planos, preços Stripe, checkout, assinaturas, pagamentos, capacidade, contrato, cancelamento/retomada, Gestão Liberada, Aliança e Indicados.

---

## 6. Modelo multi-tenant

A igreja ativa é parte da sessão. Dados operacionais incluem `tenant_id` ou são resolvidos por associação autoritativa. RPCs devem chamar helpers de sessão/tenant e rejeitar mistura entre instâncias.

Princípios:

- listagens sempre filtradas pela igreja ativa;
- formulários públicos recebem tenant explícito;
- `family_id` não substitui `tenant_id`;
- parâmetros, branding, PIX, Gemini, LGPD e billing são por tenant;
- troca de igreja invalida caches dependentes;
- mesmo telefone pode existir em tenants diferentes;
- Super Administrador pode administrar instâncias, sem remover o isolamento de dados em fluxos comuns.

---

## 7. Sessão, autenticação e identidade efetiva

### 7.1 Sessão normal

1. `verificar_login` valida celular/PIN no servidor.
2. `profile_sessions` emite token quando disponível.
3. AsyncStorage mantém telefone, perfil, token e contexto necessário.
4. `supabaseSessionFetch` injeta headers.
5. PostgreSQL resolve ator e tenant.

PIN não é recuperado/exibido por listagens. Primeiro acesso e recuperação usam e-mail.

### 7.2 Ghost

A identidade efetiva é resolvida por `loadEffectiveSessionProfile`, `resolveEffectiveProfileId` e telefone efetivo. Perfil, família, ACL e dados pertencem ao alvo. Identidade real só é usada para auditoria, início/fim da simulação, cobrança e escolha de tenant.

No Ghost:

- sem bypass do Super Admin para ACL simulada;
- sem bounce ao Início por grant negado;
- sem história artificial que desfaça navegação;
- início e fim são os únicos redirects automáticos ao Início.

---

## 8. Segurança em camadas

| Camada | Controles |
|---|---|
| Dispositivo | PIN, armazenamento local, SecureStore quando aplicável, permissões e logout |
| Cliente | guards, menu/ações filtrados, ACL de coluna, fail-closed e identidade efetiva |
| Transporte | HTTPS, anon key, session token e profile/ghost headers controlados |
| Banco | RLS, tenant, RPC `SECURITY DEFINER`, validação de ator/alvo e transações |
| Infraestrutura | Cloudflare, headers/cache, segredos fora do bundle e webhooks verificados |

### Blindagem do Gestor

A camada SQL aplica `assert_gestor_super_admin_shield` e filtros de visibilidade. Gestor não lista, visualiza ou edita Super Administrador; não vê seus logs; não vê PIN/senha. O cliente repete o bloqueio.

### Dados sensíveis

CPF, PIN, consentimento, selfie, alertas médicos, necessidades específicas, pastoral sigiloso, finanças e logs exigem grants e finalidade. Service role nunca é embutida no cliente.

---

## 9. RPCs e transações

Famílias, check-in, escala, financeiro, ACL, billing, pastoral e recepção usam RPCs para manter invariantes. Exemplos de responsabilidades:

- emitir/validar sessão e identidade;
- verificar acesso a recurso;
- promover lote familiar de modo transacional;
- confirmar totem/geofence sem duplicidade;
- aplicar ciclo de escala em lote;
- importar lançamentos e conciliar RD;
- avaliar/cancelar pedido pastoral;
- criar checkout/sincronizar assinatura;
- aplicar proteção do Gestor e isolamento tenant.

Triggers sincronizam família/endereço, invalidam check-ins incompatíveis e criam eventos operacionais como inbox/régua quando os critérios são atendidos.

---

## 10. Recepção, inbox e régua

A submissão pública permanece `pending` até decisão. Matching não usa telefone sozinho. Convite de Novos Membros leva `family_id` e pré-preenche celular. Promoção cria/atualiza `profiles` e `members` no tenant.

A inbox registra novos perfis. A régua automática exige visitante efetivo (`visitantes` sem `congregado`, `member` ou `super_admin`), cadastro mínimo e telefone. Promoção interrompe a jornada. Sticker da Home prioriza Recepção e depois Mudança Papéis.

---

## 11. Stripe, billing e Gestão Liberada

- planos possuem código, capacidade e preço Stripe;
- checkout é criado no backend Cloudflare;
- retorno/webhook sincroniza assinatura e pagamento;
- gate considera tenant ativo, assinatura, capacidade e exceções administrativas;
- Gestão Liberada desativa exigência comercial para o tenant;
- Gestão Liberada não concede grants;
- Ghost nunca usa a assinatura do alvo.

---

## 12. Build, deploy e SQL

### Desenvolvimento

```bash
npm install
npm run web
npm run lint
npm run build:web
```

### Produção

`git push origin main` aciona Cloudflare Pages, que executa `npm run build:web` e publica `dist/`.

### Banco

SQL fica versionado em `scripts/` e é aplicado no projeto linkado:

```bash
npx supabase db query --linked -f "scripts/arquivo.sql"
```

Build web não aplica SQL automaticamente. Alterações de cliente e banco devem ser coordenadas e validadas.

---

## 13. Documentação e geração

| Comando | Resultado |
|---|---|
| `npm run build:docs:md` | pacotes Markdown e ilustrações |
| `npm run build:docs:pdf` | PDFs, Manual de Entrega e Descritivo |
| `npm run build:docs` | build web + documentação completa |
| `npm run build:docs:doc` | Word institucional |
| `npm run build:access-roles-pdf` | mapa visual ACL |
| `npm run build:validation-checklist-xlsx` | checklist por papel |

---

## 14. Riscos técnicos controlados

- incompatibilidade entre cliente e RPC: mitigada por SQL versionado e mensagens de RPC ausente;
- vazamento entre tenants: mitigado por sessão/tenant, RLS, RPC e testes de isolamento;
- privilégio no Ghost: mitigado por identidade efetiva e bypass desligado;
- Gestor alcançar Super Admin: mitigado autoritativamente no SQL;
- duplicidade de presença/família: constraints, matching e transações;
- replay/webhook Stripe: validação e sincronização idempotente;
- cache PWA: HTML revalidável, assets hash e hard refresh pós-deploy;
- cards legados voltarem à publicação: lista congelada e resolução centralizada.

---

## 15. Estado técnico em 05/10/2026

- Expo 54 e PWA Cloudflare operacionais;
- 57 arquivos de rota TSX no diretório `app/` na revisão;
- navegação por Home/menu/engrenagem publicada;
- multi-tenant, billing, Ghost, Abigail e Recepção integrados;
- cards legados congelados;
- documentação-fonte atualizada; artefatos derivados precisam ser regenerados após mudanças.

*Conecta+ · Descritivo Técnico · revisão de 05/10/2026.*

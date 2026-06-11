# Funcionalidades do aplicativo IBN

Lista completa das funcionalidades do **app-igreja** (Igreja Batista Norte), organizada por área.

Itens marcados com *(staff)* exigem permissão de manutenção ou papel administrativo.

**Documentação relacionada:** [`INDICE_DOCUMENTACAO.md`](INDICE_DOCUMENTACAO.md) · [`PACOTE_1_VISAO_GERAL.md`](PACOTE_1_VISAO_GERAL.md) · [`BLUEPRINT.md`](BLUEPRINT.md) · [`MANUAL_TREINAMENTO.md`](MANUAL_TREINAMENTO.md) · [`CONTROLE_ACESSO.md`](CONTROLE_ACESSO.md)

**Atualizado em:** 22/05/2026

---

## Autenticação e sessão

- Login por **celular + PIN de 4 dígitos** (validação no Supabase via `verificar_login`)
- **Primeira entrada** com geração de PIN temporário via **WhatsApp** (configurável: envio ao usuário ou ao gestor)
- **Modo totem** — login dedicado com senha `9999` e celular `cel_totem`
- Restauração automática de sessão ao reabrir o app
- **Logout seguro** — limpa telefone e `profile_id` do aparelho (`Sair do aplicativo` / `Encerrar sessão`)
- Redirecionamento pós-login conforme estado do perfil (dashboard, cadastro, LGPD, totem)
- Links para **Instagram** e **YouTube** da igreja na tela de login (**somente no passo 1 — celular**; ocultos no passo da senha)
- Tela de login **sem marca d'água** (demais telas autenticadas exibem marca d'água discreta)

---

## Cadastro e perfil

- **Cadastro inicial** — nome, nascimento, telefone, selfie, aceite LGPD
- **Trava LGPD** — rolagem obrigatória dos termos antes do aceite
- Upload de **selfie** (câmera nativa ou arquivo na web)
- Reserva automática de **código de família** (`family_id`)
- **Dados cadastrais** — edição de perfil com seções recolhíveis
- Campos: nome, nascimento, CPF, e-mail, telefone, endereço completo
- **Sync de endereço por CEP** (RPC `sync_profile_address_from_cep`)
- **Alteração de senha de acesso** (PIN atual → novo PIN)
- **Selfie** — captura, substituição com confirmação
- **Veículos** — cadastro de placa, marca, modelo e cor
- **Vincular à família** — busca por código e solicitação de vínculo
- **Onboarding** — fluxo guiado para completar cadastro pendente
- **Termos LGPD** — tela dedicada para aceite/recusa com registro no banco
- Controle de colunas por **ACL** (campos visíveis/editáveis por papel)

---

## Família

- **Gerenciar família** — CRUD de membros (`members`)
- Busca de perfil existente por **telefone** ou **nome** ao adicionar membro
- **Transferência entre famílias** — se a pessoa já pertence a outra família, o gestor confirma a transferência para a sua
- Parentesco (cônjuge, filho(a), etc.)
- **Reconhecimento familiar** — checkbox de aceite por membro (toggle na lista)
- **Herança de endereço completo** — ao aceitar, transferir ou adicionar membro, o endereço do gestor (CEP, rua, número, complemento, bairro, cidade, estado) é copiado para o perfil do membro (`lib/inheritFamilyAddress.ts`)
- Sincronização de `family_id` em `members` e `profiles` via RPC `accept_managed_member_into_family` (`scripts/sync-managed-member-profile-family-rpc.sql`)
- Proteção do **representante legal** (não pode ser excluído)
- Detecção de duplicatas (nome + telefone na família)
- Indicadores visuais **Kids/Teens** por idade

---

## Painel principal (Dashboard)

- Carrossel horizontal de **cards** (deslize ou botões `‹` / `›` no rodapé)
- Indicador de posição no rodapé (`1 / N`) e badge do card ativo no cabeçalho
- Botões `‹` / `›` avançam 1 card a cada 500 ms enquanto pressionados
- Padding responsivo conforme largura da tela (`lib/uiTokens.ts`)
- Saudação personalizada com nome do membro
- Alerta visual se **LGPD pendente** (cabeçalho vermelho)
- Banner de **ACL indisponível** (modo estrito)
- **Índice do Aplicativo** (`/(tabs)/index`) — tela inicial com etiquetas/atalhos para cada card; distribuição uniforme na altura da tela
- Tela de **Menu/atalhos** legada integrada ao índice; **ícones coloridos** por módulo
- Acesso à **manutenção** via ícone engrenagem *(staff)* — índice com ícones coloridos e tokens visuais compartilhados
- Cards filtrados por **permissão de perfil** (ACL)
- **Paletas visuais distintas** por tipo de card (`lib/dashboardCardThemes.ts`)
- **Retorno ao card de origem** — telas abertas a partir do dashboard (perfil, família, mapa, pastoral, financeiro) voltam ao card que as chamou via parâmetro `returnDashboardCard`
- Toasts com **mensagens longas em múltiplas linhas** (`components/ui/appToastConfig.tsx`)

### Cards do dashboard (membro)

| Card | Funcionalidades |
|------|-----------------|
| **Agenda da Família** | Seleção de evento, vagas, inscrição/audiência (pré-check-in), checkbox em massa |
| **Check-in / QR Code** | Etiqueta da família, QR para totem, badges Kids/Teens, modal de seleção manual |
| **SALA(S)** | Monitoramento read-only de entrada Kids/Teens — **somente membros da própria família** |
| **Dízimos e Ofertas** | Sempre visível no carrossel; dados do recebedor, chave PIX, **Copiar chave PIX** com ícone *touch-app*, atualizar chave |
| **Coração Aberto** | Atalho para pedido pastoral |
| **Lista de Membros** | Botões **Visitantes** e **Mapa Geral** na mesma linha; alternância membros/visitantes; busca; tabela nome/família; WhatsApp; modal de membros da família |
| **Aniversariantes** | Filtro por mês, lista com WhatsApp |
| **Financeiro** | Atalho para relatórios (somente leitura) |
| **Escalas** | Lista de tipos de escala, escala por data, WhatsApp dos servos |
| **Estacionamento** | Identificação de veículo por placa, WhatsApp do proprietário |
| **Gestão de Cadastros** (`grouped_manage`) | Título do card; atalhos **Dados Cadastrais** e **Gerenciar Família** com ícones |

---

## Eventos e check-in

- Listagem de eventos publicados com data, local e capacidade
- **Inscrição na audiência** (pré-check-in) por membro da família
- Suporte a fluxos: **check-in automático**, **totem**, **manual**, **quórum**
- Gate de pré-check-in antes de liberar card QR
- **QR Code** da família para leitura no totem
- Card QR visível **somente no dia do evento** (regra configurável)
- **Quórum** — um membro por sessão; trava após confirmação no totem
- **Totem** (`/totem-checkin`) — scan de QR, lookup e confirmação via RPC
- Backfill de check-ins ao abrir fluxo do totem (`ensure_totem_checkin_flow`)
- Proteção contra **duplo check-in** e reprocessamento (cooldown, fila local)
- Status: pré-check-in, confirmado, já confirmado, processando
- Badges **IBN KIDS** / **IBN TEENS** por evento

---

## Salas Kids e Teens

- Inscrição via audiência no dashboard
- **Monitor no dashboard (membro)** — contagem e status read-only, filtrado por `family_id` da sessão
- **Monitor na manutenção (staff)** — exibe todos os inscritos do evento (sem filtro por família)
- **Check-in de sala** *(staff)* — marcação de entrada por inscrição na manutenção
- WhatsApp do responsável após entrada confirmada

---

## Quórum e presença *(staff)*

- Configuração **Requer Quorum** no evento
- Tabela de registro de quórum no editor de eventos (atualização a cada 15 s)
- **Lista de Presença** — documento imprimível com hora do check-in
- Atualização automática após confirmação no totem

---

## Pastoral

- **Coração Aberto** — formulário de pedido de cuidado/intercessão
- Seleção de **Motivo** e **Situação** em chips segmentados (layout empilhado em telas estreitas)
- Categorias e subcategorias de motivo (`scripts/pastoral-request-categories.sql`)
- Beneficiário: eu, família ou terceiro
- Destino: **Sigilo pastoral** ou **Intercessão**
- Envio vinculado ao perfil logado
- **Meus pedidos** — histórico com status e pull-to-refresh
- **Cuidado pastoral** *(staff)* — painel de gestão de pedidos na manutenção

---

## Financeiro

### Membro (leitura)

- Seletor de mês (REALIZADO e meses só-PLANEJADO com badge)
- **Resultado do mês** — boletim com saldo acumulado e YTD
- **Comparativo mensal** — mês atual vs anterior
- **Últimos 12 meses** — matriz de valores
- **Planejado × Realizado** — comparativo de orçamento
- Aviso quando comentários financeiros não carregam

### Relatórios de Despesas (RD)

- Membro envia RD com itens, valor total e chave PIX (`/expense-report`)
- Tesouraria concilia RD pendente a lançamento financeiro na manutenção
- **Relatórios de Despesas** — lista do mês na manutenção; **Remover vínculo** (desconciliar)
- Relatório mensal: pendentes pelo mês de emissão; conciliados pelo mês do **lançamento vinculado**

### Manutenção *(staff)*

- Importação de lançamentos via **CSV** ou colar planilha
- Modos: substituir ou acrescentar; seletor de versão **REALIZADO / PLANEJADO** na carga e no esvaziar mês
- **Esvaziar mês** — exclusão escopada por versão orçamentária
- Seções colapsáveis com accordion (apenas uma aberta por vez)
- Picker de mês de referência ampliado; modal de comentário sem pré-preenchimento
- Resumo separado por versão orçamentária
- Mês padrão: mês anterior (limitado até o mês corrente)

---

## Escalas

### Visualização *(membro)*

- Lista de tipos de escala no dashboard
- Datas, servos e contato WhatsApp
- Escala de estacionamento com identificação por placa

### Manutenção *(staff)*

- **Tipos de escala** — CRUD de códigos, nomes, **vagas por domingo** e **modo do ciclo** (individual/equipe)
- **Servos em disponibilidade** — voluntários por tipo, ordem sequencial
- **Registro manual** de escala (data + servo)
- **Gerar ciclo em bloco** — preview + aplicação transacional (`aplicar_ciclo_escala`)
- Regras: até `vagas_por_servico` servos por domingo; modo **individual** (cada servo em domingo distinto no ciclo) ou **equipe** (preenche N vagas no mesmo domingo); ordem crescente; início após MAX(data)
- Remoção de voluntário com recompactação de ordem
- Alerta de escalas futuras ao remover servo
- Contexto do ciclo via RPC `get_scale_cycle_context`

---

## Mapa de geolocalização (PWA/web)

- Mapa **Leaflet** com pins por CEP dos perfis
- Filtros: todos, com papel, visitantes
- Geocodificação servidor-primária + cache local (`geoCepCache.v8`)
- Snapshot de mapa versionado (`profilesMapSnapshot.v7`)
- Painel de detalhe do membro (nome, papel, endereço, WhatsApp)
- Estatísticas: perfis, pins, CEPs inválidos
- **Atualizar mapa** — sincronização sob demanda
- ACL de perfil no mapa (visitante vs membro)
- Versão nativa: placeholder informando uso via PWA

---

## Manutenção *(staff)*

| Módulo | Funcionalidades |
|--------|-----------------|
| **Programação de Eventos** | CRUD, publicação, totem, quórum, Kids/Teens, ofertas, capacidade |
| **Cronograma (Gantt)** | Visão dia/mês, toque para editar evento |
| **Sala(s) - Check In** | Marcação interativa de entrada nas salas |
| **Lista de Presença** | Quórum — leitura e impressão |
| **Tipos de Escala** | CRUD com **vagas por domingo** e **modo do ciclo** (individual/equipe) |
| **Servos** | Voluntários e ordem sequencial |
| **Programação de Escalas** | Registro manual + **Escala em bloco** (preview transacional) |
| **Cuidado Pastoral** | Gestão de pedidos |
| **Informações Financeiras** | Carga, manutenção de lançamentos e relatórios RD do mês |
| **Controle de Acesso** | Papéis, grants; seleção de perfil por dropdown *(super_admin)* |
| **Cadastro de Usuário** | Busca, correção de CEP/endereço e exclusão completa de perfil *(super_admin)* |

---

## Identidade visual

- **Marca d'água** global (`AppShell` + `WatermarkSurface`) em telas autenticadas
- Excluída na tela de login; altura alinhada ao card central do dashboard
- Opacidade discreta; não interfere na leitura nem substitui ACL

---

## Controle de acesso (ACL)

- Papéis: `visitantes`, `congregado`, `member`, `family_acceptor`, `lider`, `events_admin`, `pastoral`, `super_admin`
- Permissões por **tela**, **card do dashboard**, **tabela** e **coluna**
- RPC `profile_has_access` com modo estrito (`EXPO_PUBLIC_ACL_STRICT`)
- Guards de rota em telas sensíveis
- RLS no Supabase com header `x-profile-id`
- UI administrativa de papéis e grants *(super_admin)*
- Fail-closed em erros reais de ACL; colunas de perfil bloqueadas até carregar permissões

### Telas protegidas por ACL

| Tela | Rota |
|------|------|
| Dashboard | `/(tabs)/dashboard` |
| Dados cadastrais | `/manage-profile` |
| Gerenciar família | `/manage-members` |
| Coração Aberto | `/pastoral` |
| Meus pedidos | `/pastoral-history` |
| Financeiro | `/financial` |
| Relatório de despesas | `/expense-report` |
| Mapa | `/mapa-geolocalizacao` |
| LGPD | `/lgpd` |
| Manutenção | `/maintenance-dashboard` |

### Telas sem ACL de tela

| Tela | Observação |
|------|------------|
| Login | Público |
| Cadastro | Público (com `?phone=`) |
| Totem | Aparelho dedicado |

---

## Comunicação e integrações

- Abertura de **WhatsApp** — aniversariantes, membros, servos de escala, proprietários de veículo, família
- **PIX** — exibição e cópia da chave de ofertas
- Parâmetros globais em `app_parameters` (PIX, prefixo família, totem, LGPD, etc.)
- Redes sociais na tela de login

---

## Segurança e infraestrutura

- Backend **Supabase** (PostgreSQL + RPCs + Storage)
- Projeto: `bldbrsuiwctoaxzcrjoc`
- PIN validado no servidor; atualização de PIN via RPC dedicada
- Campos sensíveis protegidos (CPF, PIN, LGPD, alertas médicos)
- Escritas críticas via RPC `security definer`
- INSERT direto em `escalas_log` bloqueado no cliente
- Sessão local com reparo automático de referência de perfil
- PWA exportável (`npm run build:web` → `dist/`)
- Ícones do app (favicon, splash, Android) gerados pela arte da marca d'água (`npm run generate:icons`)
- Purga de caches legados do mapa
- Política de geocodificação documentada (servidor-primário)

---

## Mapa de rotas

```
/                      → Login
/register              → Cadastro inicial
/(tabs)/dashboard      → Painel principal
/(tabs)                → Menu de atalhos
/manage-profile        → Dados cadastrais
/manage-members        → Gerenciar família
/pastoral              → Coração Aberto
/pastoral-history      → Meus pedidos
/financial             → Financeiro (leitura)
/mapa-geolocalizacao   → Mapa (PWA)
/lgpd                  → Termos LGPD
/maintenance-dashboard → Manutenção
/totem-checkin         → Totem de check-in
```

---

## Resumo por público

| Público | Principais funcionalidades |
|---------|---------------------------|
| **Membro** | Login, cadastro, perfil, família, eventos, check-in QR, salas (leitura), ofertas, pastoral, aniversariantes, financeiro (leitura), escalas (leitura), mapa |
| **Totem** | Scan QR, confirmação de check-in |
| **Equipe** | Manutenção: eventos, salas, quórum, escalas, financeiro, pastoral |
| **Super admin** | Controle de acesso, cadastro de usuários |

---

*Documento gerado a partir do código-fonte e do [`BLUEPRINT.md`](BLUEPRINT.md).*

# Pacote 1 — Visão Geral

Documentação **autocontida** para diretoria, membros, famílias e voluntários.

**Atualizado em:** 10/06/2026

Conteúdo integrado: Funcionalidades · Manual de Treinamento · FAQ

---

# Parte 1 — Funcionalidades do aplicativo IBN

---

# Funcionalidades do aplicativo IBN

Lista completa das funcionalidades do **app-igreja** (Igreja Batista Norte), organizada por área.

Itens marcados com *(staff)* exigem permissão de manutenção ou papel administrativo.

**Documentação relacionada:** [`INDICE_DOCUMENTACAO.md`](INDICE_DOCUMENTACAO.md) · [`PACOTE_1_VISAO_GERAL.md`](PACOTE_1_VISAO_GERAL.md) · [`BLUEPRINT.md`](BLUEPRINT.md) · [`MANUAL_TREINAMENTO.md`](MANUAL_TREINAMENTO.md) · [`CONTROLE_ACESSO.md`](CONTROLE_ACESSO.md)

**Atualizado em:** 10/06/2026

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
| **Controle de Acesso** | Papéis, grants, permissões por perfil *(super_admin)* |
| **Cadastro de Usuário** | Busca e edição de perfis *(super_admin)* |

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


---

# Parte 2 — Manual de Treinamento (Mão na Massa)

---

# Manual de Treinamento — Mão na Massa
## App de Gestão IBN (Igreja Batista Norte)

**Público:** membros, famílias e voluntários que usam o aplicativo no celular ou na versão web (PWA).  
**Formato:** missões práticas — cada missão é uma tarefa que você executa no app enquanto lê.  
**Tempo estimado:** 25 a 40 minutos (primeira vez).

**Pacote de documentação:** [`PACOTE_1_VISAO_GERAL.md`](PACOTE_1_VISAO_GERAL.md) · Índice completo: [`INDICE_DOCUMENTACAO.md`](INDICE_DOCUMENTACAO.md)

---

## Introdução

Bem-vindo ao aplicativo da **Igreja Batista Norte (IBN)**.

Este app foi criado para aproximar você da vida da igreja no dia a dia: participar de eventos, confirmar presença, cuidar dos seus dados, acompanhar sua família e acessar recursos como ofertas, pastoral e escalas — tudo a partir do seu celular, com segurança.

Seus dados são validados em tempo real no banco de dados da igreja (plataforma **Supabase**). Isso significa que, quando você entra com celular e senha, o sistema confere sua identidade no servidor antes de liberar o painel — não é apenas uma “tela aberta”, é um acesso autenticado.

> **Como usar este manual**  
> Leia uma missão por vez. Não pule etapas: cada missão prepara a seguinte.  
> Itens em **negrito** são botões, menus ou áreas da tela que você deve tocar.

---

## Metodologia — As Missões

| Símbolo | Significado |
|---------|-------------|
| **Objetivo** | O que você vai aprender |
| **Caminho** | Onde clicar na interface |
| **Ação prática** | Passo a passo numerado |
| **Dica Pro** | Atalho ou cuidado que facilita o uso |

Ao concluir todas as missões obrigatórias, você saberá: entrar no app, concluir o cadastro, usar o painel, fazer check-in com QR Code e sair com segurança.

---

# Missão 1 — Primeiro acesso: Login com celular e senha

### Objetivo da Missão
Aprender a entrar no app usando seu **número de celular** e sua **senha de acesso de 4 dígitos**.

### Caminho
Tela inicial → **Boas-Vindas** → campos **Celular** e **Senha de acesso** → botão **Entrar** (ou ícone **WhatsApp** na primeira vez).

### Ação prática

1. Abra o aplicativo IBN no navegador (PWA) ou no celular.
2. Aguarde a tela de **Boas-Vindas** carregar (logo da igreja no topo).
3. No campo **Celular**, digite seu número com DDD — o app formata automaticamente: `(00) 00000-0000`.
4. Se for sua **primeira entrada** e ainda não tiver senha:
   - Toque no ícone verde do **WhatsApp** ao lado do campo de senha.
   - Siga as instruções na mensagem: o sistema gera uma senha temporária de 4 dígitos.
   - A mensagem pode ser copiada automaticamente para você colar ou memorizar.
5. No campo **Senha de acesso**, digite os **4 dígitos** (a senha fica oculta, como um PIN).
6. O app pode entrar sozinho ao completar o 4º dígito; se preferir, toque em **Entrar**.
7. Se o login for aceito, você será direcionado ao **Painel** ou ao **Cadastro**, conforme seu perfil no banco de dados.

### O que acontece nos bastidores
O app envia celular e senha para o servidor (**Supabase**), que valida através da função `verificar_login`. Só após essa confirmação sua sessão é gravada no aparelho.

### Dica Pro
Na **primeira entrada**, o texto abaixo do campo de senha explica se o WhatsApp abre no **seu celular** ou no **gestor** — isso depende da configuração da igreja (`psw_user` / `psw_mngr`). Leia o hint antes de tocar no ícone.

> **Se algo der errado**  
> - *"Número ou senha inválidos"* — confira os 4 dígitos; na primeira vez, gere novo código pelo WhatsApp.  
> - *"Código necessário"* — toque no WhatsApp antes de digitar a senha.  
> - *"Validação indisponível"* — problema técnico no servidor; avise a equipe de TI da igreja.

---

# Missão 2 — Primeiro cadastro: dados, LGPD e selfie

### Objetivo da Missão
Concluir seu cadastro inicial com nome, data de nascimento, aceite dos termos de privacidade (**LGPD**) e foto (**selfie**).

### Caminho
Após login (primeira vez) → tela **Cadastro** → formulário → termos LGPD → **Capturar Selfie** → **Confirmar Registro**.

### Ação prática

1. Na tela **Cadastro**, confira se seu **Telefone** aparece correto (campo bloqueado — veio do login).
2. Preencha **Nome Completo** (o app capitaliza as palavras automaticamente).
3. Preencha **Data Nascimento** no formato `dd/mm/aaaa`.
4. Role a caixa **Termos de Uso e Privacidade (LGPD)** **até o final**.
   - Enquanto não rolar tudo, verá: `↓ Role para ler tudo ↓`
   - Ao chegar ao fim: `✅ Termos lidos.`
5. Marque **Li e aceito** (só fica ativo depois do scroll completo e com nome/nascimento preenchidos).
   - Se marcar **Li e não concordo**, o app exibirá orientações sobre privacidade — o cadastro segue conforme a política da igreja.
6. Toque para abrir a **câmera** ou selecionar foto (na web, escolha um arquivo de imagem).
7. **Capture a selfie com boa iluminação**: rosto centralizado, fundo simples, sem óculos escuros ou chapéu que cubram o rosto.
8. Na tela **Confirmar Registro**, revise nome, data e foto.
9. Toque para **finalizar o cadastro**.
10. Ao ver **"Cadastro inicial concluído"**, você será levado a completar **Dados Cadastrais** ou aos termos LGPD, se ainda faltar algum passo.

### Dica Pro
A **trava de leitura LGPD** existe por lei e por respeito a você: o sistema só libera o aceite quando você realmente percorreu todo o texto. Não é bug — é proteção.

> **Permissão de câmera**  
> Se o celular pedir acesso à câmera, toque em **Permitir**. Sem isso, a selfie biométrica não pode ser registrada.

> **Após o cadastro**  
> Acesse **Dados Cadastrais** (no painel) e **altere a senha temporária** para uma senha pessoal de 4 dígitos que só você saiba.

---

# Missão 3 — Navegando o Painel (Dashboard)

### Objetivo da Missão
Conhecer o **Painel principal**: cabeçalho, cards deslizantes e rodapé de navegação.

### Caminho
Após login → **Índice do Aplicativo** (atalhos com etiquetas) **ou** **Painel** / **Dashboard** → deslize ou use **<** e **>** no rodapé.

### Ação prática

1. Observe o topo: **"Boas-Vindas, {seu nome}"** e o título do card atual.
   - Se o fundo do cabeçalho estiver **vermelho**, seus termos LGPD ainda precisam de atenção — vá em **Dados Cadastrais** ou **LGPD**.
2. O centro da tela mostra **um card por vez** (carrossel horizontal).
3. No rodapé, observe o indicador **1 / N** (posição atual no carrossel).
4. Para mudar de card:
   - **Deslize** o dedo para a esquerda ou direita no card, **ou**
   - Use os botões **‹** e **›** no rodapé (segurar o botão avança card a card automaticamente).
5. No **Índice**, toque na etiqueta do módulo desejado para abrir o card correspondente no Painel.
6. Cards que você pode encontrar (conforme permissão da igreja):
   - **Agenda da Família**
   - **Check In / QR Code**
   - **SALA(S)**
   - **Dízimos e Ofertas**
   - **Coração Aberto**
   - **Lista de Membros**
   - **Aniversariantes**
   - **Financeiro**
   - **Escalas**
   - **Dados Cadastrais / Gerenciar Família**
6. No rodapé, toque no botão central (**Menu**) para ir à tela de atalhos com lista de módulos (ícones coloridos por módulo).
7. Se você for da equipe e tiver permissão, verá o ícone de **engrenagem** (manutenção) — ignore neste treinamento se não for seu caso.

### Dica Pro
Nem todo card aparece para todo mundo: a igreja configura **permissões por perfil**. Se um módulo não aparecer, fale com o administrador — não é falha do seu aparelho.

> **Banner amarelo de ACL**  
> Se aparecer aviso de "controle de acesso indisponível", o app está em modo de proteção. Avise a equipe técnica; evite operações sensíveis até normalizar.

---

# Missão 4 — Check-in completo: audiência e QR Code

### Objetivo da Missão
Registrar sua família no evento (**audiência / pré-check-in**) e **apresentar o QR Code** no totem ou na entrada, no dia do culto ou evento.

### Caminho
**Painel** → card **Agenda da Família** → marcar audiência → (no dia do evento) card **Check In / QR Code** → totem da igreja.

### Ação prática — Parte A: Antes ou no dia (audiência)

1. No **Painel**, deslize até o card **Agenda da Família**.
2. Em **Trocar Evento**, selecione o culto ou evento desejado (chips horizontais).
3. Confira data, horário, local e vagas.
4. Na lista de **Audiência**, marque o checkbox de cada membro da família que participará.
   - Em eventos de **quórum**, apenas o membro da sessão ativa pode ser marcado.
5. Aguarde a confirmação visual — o sistema grava o **pré-check-in** no banco de dados.
6. Leia as mensagens de orientação na tela (em cinza ou vermelho se houver erro):
   - *"Marque a audiência abaixo para liberar o card de check-in com QR Code."*
   - *"O card com QR Code ficará disponível no dia do evento."*

### Ação prática — Parte B: No dia do evento (QR Code)

1. No **dia do evento**, volte ao **Painel** e localize o card de check-in (pode aparecer como **QR Code — Check-in Totem**, **QR Code — Check-in Quórum** ou **Check In — QR Code**).
2. Verifique:
   - **Nome do evento**
   - **Etiqueta** — código da sua família (ex.: código alfanumérico em destaque amarelo)
   - **QR Code** — quadrado branco com o padrão de barras
3. Aumente o brilho da tela do celular.
4. No totem da igreja (tablet/celular fixo na entrada), aponte o QR Code para a câmera do totem.
5. Aguarde a mensagem de confirmação no totem: *"Confirmação realizada com sucesso"*.
6. Se já tinha confirmado antes, verá aviso de que o check-in **já foi realizado** — isso é normal e evita duplicidade.

### Quem faz o quê (visão geral)

| Etapa | Quem executa | Onde |
|-------|--------------|------|
| Criar evento | Equipe (manutenção) | Painel administrativo |
| Marcar audiência | **Você (membro)** | Card Agenda da Família |
| Exibir QR | **Você (membro)** | Card Check-in |
| Ler QR e confirmar | Totem / equipe na entrada | Aparelho do totem |
| Entrada nas salas Kids/Teens | Equipe | Manutenção (não é no seu celular) |

### Dica Pro
O check-in no totem **só funciona** se você marcou a audiência antes. Se o totem disser *"Pré-check-in não encontrado"*, volte ao card **Agenda da Família** e marque os participantes.

> **Eventos de quórum**  
> Após confirmar no totem, a audiência pode **travar** — você não desmarca por engano. Isso protege a lista oficial de presença.

> **Sem código de família**  
> Se o QR não aparecer e houver aviso para vincular família, vá em **Dados Cadastrais** e confira seu código de família com a secretaria.

---

# Missão 5 — Gestão de saída: encerrar sessão com segurança

### Objetivo da Missão
Sair do aplicativo de forma segura, limpando os dados de login do aparelho — essencial em celulares compartilhados ou computadores públicos.

### Caminho
**Painel** → **Menu** (rodapé) → tela de atalhos → **Sair do aplicativo** (celular) ou **Encerrar sessão** (navegador web).

### Ação prática

1. No **Painel**, toque em **Menu** no rodapé central (entre os controles de navegação).
2. Você verá a tela de **atalhos** com botões para os módulos (Agenda, Ofertas, Financeiro, etc.).
3. Role até o rodapé desta tela.
4. Toque em:
   - **Sair do aplicativo** — no celular (Android pode fechar o app após sair), **ou**
   - **Encerrar sessão** — na versão web/PWA.
5. Aguarde o texto **"Encerrando…"** se aparecer.
6. Você retornará à tela de **Boas-Vindas** (login).
7. Na web, a URL pode incluir parâmetro de logout para **impedir login automático** — nesse caso, digite celular e senha novamente.

### Por que isso importa
Ao sair, o app remove do aparelho o **telefone** e o **identificador do perfil** salvos localmente. A próxima pessoa que pegar o celular **não entra na sua conta** sem saber sua senha de 4 dígitos — e a senha continua validada no **Supabase**.

### Dica Pro
Troque de aparelho? Saia no aparelho antigo e entre no novo com celular + senha. Se alterou permissões na igreja e algo “não aparece”, **saia e entre de novo** para atualizar a sessão.

> **Totem da igreja**  
> No aparelho do totem, use **Encerrar sessão** na tela de check-in ao final do culto — nunca deixe o totem logado como se fosse um membro comum.

> **Se der erro ao sair**  
> Mensagem: *"Não foi possível encerrar a sessão"* ou *"Não foi possível sair do aplicativo"*. Feche o navegador ou o app manualmente e, se possível, limpe os dados do site no navegador.

---

## Missões bônus (quando estiver confortável)

### Missão B1 — Trocar sua senha de acesso

**Caminho:** Painel → **Dados Cadastrais** (card ou atalho no Menu) → seção **Senha de acesso**.

1. Digite a senha **atual** (4 dígitos).
2. Digite a **nova** senha e **confirme**.
3. Salve e memorize — você usará nos próximos logins.

---

### Missão B2 — Gerenciar sua família

**Caminho:** Painel → **Gerenciar Família**.

1. Abra a seção **Adicionar membro** (recolhível).
2. Busque por **nome** ou informe telefone, nome, parentesco e data de nascimento.
3. Se a pessoa já estiver em **outra família**, confirme a **transferência** quando o app solicitar.
4. Salve — o app copia o **endereço completo** da sua família para o perfil do membro (quando possível).
5. Para membros já listados, use o **checkbox de aceite** na lista para reconhecer o vínculo; o endereço também é herdado ao aceitar.

---

### Missão B3 — Coração Aberto (pedido pastoral)

**Caminho:** Painel → **Coração Aberto** → formulário.

1. Escolha **Motivo** e **Situação**.
2. Indique para quem é o pedido e o destino (sigilo ou intercessão).
3. Escreva seu pedido e toque em **Enviar pedido**.

---

### Missão B4 — Escalas em equipe: vagas por domingo e ciclo em bloco *(staff / líder de escala)*

> **Quem pode fazer:** perfil com acesso à **Manutenção** e permissão nos cards de escala (`Tipos de Escala`, `Servos em Disponibilidade`, `Programação de Escalas`). Se você não vê a engrenagem no Painel, pule esta missão.

#### Objetivo da Missão
Configurar um tipo de escala com **várias vagas no mesmo domingo** (ex.: vigilância com 4 servos) e gerar a programação automaticamente no modo **equipe**.

#### Caminho
**Painel** → ícone **engrenagem** (Manutenção) → **Tipos de Escala** → **Servos em Disponibilidade** → **Programação de Escalas** → conferir no card **Escalas** do Painel.

#### Ação prática — Parte A: Configurar o tipo de escala

1. No **Painel**, toque no ícone de **engrenagem** para abrir a **Manutenção**.
2. Abra o card **Tipos de Escala**.
3. Cadastre um tipo novo **ou** edite um existente (ex.: `vigilancia_estacionamento` / **Vigilância Estacionamento**).
4. Em **Vagas por domingo**, informe quantos servos podem atuar na mesma data — use **4** neste exercício (aceita de 1 a 50).
5. Em **Modo do ciclo em bloco**, selecione **Equipe** (em vez de Individual).
   - **Individual:** cada servo em domingo distinto no ciclo automático.
   - **Equipe:** o ciclo preenche até N servos no **mesmo** domingo antes de avançar para o próximo.
6. Toque em **Cadastrar** ou **Salvar alterações** e aguarde a confirmação na tela.

#### Ação prática — Parte B: Preparar os servos

1. Na Manutenção, abra **Servos em Disponibilidade**.
2. Selecione o **mesmo tipo de escala** que você acabou de configurar.
3. Confira se há servos **ativos** com **ordem sequencial** definida (1, 2, 3, 4…).
   - Sem ordem, o ciclo em bloco **não gera** a prévia — ajuste a ordem antes de continuar.
4. Se faltar servo, cadastre e defina a ordem na lista.

#### Ação prática — Parte C: Gerar o ciclo em equipe

1. Abra **Programação de Escalas** na Manutenção.
2. Selecione o tipo de escala configurado (chip/radio no topo do card).
3. Toque em **Escala em bloco**.
4. Leia a **prévia** (título *Prévia — escala em bloco*): com modo **equipe** e 4 vagas, você deve ver **até 4 servos na mesma data** antes de passar ao domingo seguinte.
5. Confira a mensagem de resumo (quantidade de escalas, domingos e ordem sequencial).
6. Toque em **Gravar bloco** e confirme no diálogo para aplicar via `aplicar_ciclo_escala`.
7. Aguarde o toast de sucesso com a quantidade de escalas gravadas.

#### Ação prática — Parte D: Validar no Painel

1. Volte ao **Painel** (sair da Manutenção se necessário).
2. Deslize até o card **Escalas**.
3. Selecione o tipo de escala que você programou.
4. Verifique se **o mesmo domingo** lista **vários nomes** (até o limite de vagas configurado).
5. Toque no ícone **WhatsApp** ao lado de um servo, se houver telefone — confirme que o contato abre corretamente.

#### O que acontece nos bastidores
O app consulta `get_scale_cycle_context` (ocupação por data, vagas e modo) e monta a prévia em `gerarCicloCompleto`. Ao confirmar, grava tudo de uma vez em `escalas_log` pela RPC `aplicar_ciclo_escala` — se uma entrada falhar, **nenhuma** é salva (transação).

#### Dica Pro
Use **modo equipe** para vigilância, recepção ou estacionamento (vários no mesmo culto). Use **modo individual** para intercessão ou funções em que cada servo serve em domingos alternados. O **registro manual** na Programação de Escalas também respeita o limite de vagas — o mesmo servo **não** pode repetir na mesma data.

> **Se a prévia falhar**  
> - *"sem ordem_sequencial"* — defina a ordem em **Servos em Disponibilidade**.  
> - *"Calendário saturado"* — há muitas datas futuras já ocupadas; revise escalas existentes ou reduza servos no ciclo.  
> - *"excedem as N vaga(s)"* — o lote ultrapassou `vagas_por_servico`; gere de novo ou remova registros conflitantes.

---

## Checklist — Concluí o treinamento?

Marque mentalmente cada item:

- [ ] Entrei com celular e senha (ou gerei PIN pelo WhatsApp na primeira vez)
- [ ] Completei cadastro com LGPD (scroll até o fim) e selfie
- [ ] Naveguei pelos cards do Painel com deslize ou **<** / **>**
- [ ] Marquei audiência em um evento na **Agenda da Família**
- [ ] Localizei etiqueta + QR Code no dia do evento
- [ ] Entendi que o totem confirma o check-in após o pré-check-in
- [ ] Saí pelo **Menu** → **Sair do aplicativo** / **Encerrar sessão**

### Checklist extra — líder de escala *(opcional)*

- [ ] Configurei **vagas por domingo** e modo **equipe** em **Tipos de Escala**
- [ ] Servos ativos com **ordem sequencial** em **Servos em Disponibilidade**
- [ ] Gerei e confirmei o **ciclo em bloco** em **Programação de Escalas**
- [ ] Validei **vários servos no mesmo domingo** no card **Escalas** do Painel

---

## Glossário rápido

| Termo | Significado simples |
|-------|---------------------|
| **PIN / Senha de acesso** | 4 dígitos numéricos pessoais |
| **Pré-check-in / Audiência** | Marcar presença prevista antes do totem |
| **QR Code** | Código visual lido pela câmera do totem |
| **Totem** | Aparelho fixo na entrada para confirmar check-in |
| **LGPD** | Lei de proteção de dados; aceite registrado no seu perfil |
| **Supabase** | Banco de dados na nuvem onde seus dados são validados |
| **PWA** | Versão web do app, instalável no navegador |
| **Vagas por domingo** | Máximo de servos no mesmo domingo para um tipo de escala (`vagas_por_servico`) |
| **Ciclo em bloco** | Geração automática de várias datas de escala de uma vez (modo individual ou equipe) |

---

## Precisa de ajuda?

| Situação | O que fazer |
|----------|-------------|
| Esqueci minha senha | Gere nova pelo **WhatsApp** na tela de login ou peça à secretaria |
| QR não aparece | Confirme: audiência marcada? É o dia do evento? Código de família cadastrado? |
| Card não aparece no Painel | Permissão do perfil — fale com administrador |
| Erro técnico persistente | Anote a mensagem na tela e contate a equipe de TI da igreja |
| Ciclo em bloco não gera prévia | Verifique ordem sequencial dos servos e permissão ACL de escala |
| Domingo com mais servos que o permitido | Ajuste `vagas_por_servico` em **Tipos de Escala** ou remova escalas extras |

---

*Manual de treinamento — App IBN · Igreja Batista Norte*  
*Alinhado ao aplicativo, ao [`FUNCIONALIDADES.md`](FUNCIONALIDADES.md) e ao [`BLUEPRINT.md`](BLUEPRINT.md).*


---

# Parte 3 — Perguntas e Respostas (FAQ)

---

# Perguntas e Respostas (FAQ) — App IBN

Respostas às dúvidas mais comuns sobre o aplicativo da **Igreja Batista Norte**, organizadas **por tela** e **por assunto**.

**Documentação relacionada:** [`INDICE_DOCUMENTACAO.md`](INDICE_DOCUMENTACAO.md) · [`PACOTE_1_VISAO_GERAL.md`](PACOTE_1_VISAO_GERAL.md) · [`FUNCIONALIDADES.md`](FUNCIONALIDADES.md) · [`MANUAL_TREINAMENTO.md`](MANUAL_TREINAMENTO.md) · [`BLUEPRINT.md`](BLUEPRINT.md)

**Atualizado em:** 10/06/2026

---

## Índice

### Por tela
1. [Login](#1-login)
2. [Cadastro inicial](#2-cadastro-inicial)
3. [Painel / Dashboard](#3-painel--dashboard)
4. [Agenda da Família](#4-agenda-da-família)
5. [Check-in e QR Code](#5-check-in-e-qr-code)
6. [SALA(S) — Kids e Teens](#6-salas--kids-e-teens)
7. [Dízimos e Ofertas](#7-dízimos-e-ofertas)
8. [Lista de Membros e Mapa](#8-lista-de-membros-e-mapa)
9. [Aniversariantes](#9-aniversariantes)
10. [Financeiro (membro)](#10-financeiro-membro)
11. [Escalas e Estacionamento](#11-escalas-e-estacionamento)
12. [Dados Cadastrais](#12-dados-cadastrais)
13. [Gerenciar Família](#13-gerenciar-família)
14. [Coração Aberto e Meus Pedidos](#14-coração-aberto-e-meus-pedidos)
15. [Termos LGPD](#15-termos-lgpd)
16. [Menu, navegação e saída](#16-menu-navegação-e-saída)
17. [Totem de check-in](#17-totem-de-check-in)
18. [Manutenção (equipe)](#18-manutenção-equipe)

### Por assunto
- [Acesso e senha](#assunto-acesso-e-senha)
- [LGPD e privacidade](#assunto-lgpd-e-privacidade)
- [Check-in e eventos](#assunto-check-in-e-eventos)
- [Família e cadastro](#assunto-família-e-cadastro)
- [Permissões e perfis](#assunto-permissões-e-perfis)
- [Financeiro](#assunto-financeiro)
- [Pastoral](#assunto-pastoral)
- [Escalas](#assunto-escalas)
- [Mapa e endereço](#assunto-mapa-e-endereço)
- [Segurança e dados](#assunto-segurança-e-dados)
- [Problemas técnicos](#assunto-problemas-técnicos)
- [Totem e quiosque](#assunto-totem-e-quiosque)

---

# Por tela

## 1. Login

**O que preciso para entrar no app?**  
Seu **número de celular** (com DDD) e sua **senha de acesso de 4 dígitos** (PIN).

**É a primeira vez que uso o app. E a senha?**  
Na primeira entrada você ainda não tem senha definitiva. Toque no ícone do **WhatsApp** ao lado do campo de senha, receba o código temporário e digite os 4 dígitos. Depois altere a senha em **Dados Cadastrais**.

**Por que o WhatsApp não abre ou dá erro?**  
O envio depende da configuração da igreja (`psw_user` / `psw_mngr` em `app_parameters`). Pode abrir no seu celular ou no do gestor. Se falhar, confira o número digitado ou peça ajuda à secretaria.

**Posso entrar sem passar pelo WhatsApp?**  
Não na primeira vez. O app exibirá *"Código necessário"* se você tentar digitar senha sem ter solicitado o PIN temporário.

**O app entra sozinho ao digitar a senha?**  
Sim. Ao completar o 4º dígito, a validação pode ocorrer automaticamente. Você também pode tocar em **Entrar**.

**Aparece "Número ou senha inválidos". O que fazer?**  
Confira os 4 dígitos. Se esqueceu, gere novo código pelo WhatsApp. Se persistir, a secretaria pode verificar seu cadastro no sistema.

**Aparece "Validação indisponível".**  
Problema no servidor (RPC `verificar_login` não instalada ou indisponível). Avise a equipe técnica da igreja.

**Aparece "Não foi possível conectar ao servidor".**  
Verifique internet (Wi‑Fi ou dados móveis) e tente de novo.

**O que é o modo totem na tela de login?**  
Quando o celular configurado é o do **totem** (`cel_totem`), a tela muda para **Totem — Check-in**: só pede senha **9999**, sem cadastro de membro.

**Por que o app abre direto no totem sem pedir login?**  
Se esse aparelho já tinha sessão do totem salva, o app restaura automaticamente. Use **Encerrar sessão** ao final do culto.

**Para que servem Instagram e YouTube na tela de login?**  
Links para as redes sociais oficiais da igreja — não fazem parte do login.

**O app lembra meu celular depois que saio?**  
Após **Sair do aplicativo** / **Encerrar sessão**, a sessão é limpa. Na web, pode ser necessário digitar celular e senha novamente.

---

## 2. Cadastro inicial

**Quando sou levado à tela de Cadastro?**  
Após o primeiro login bem-sucedido, se seu perfil ainda não completou o cadastro inicial (nome, LGPD, selfie).

**Posso alterar o telefone no cadastro?**  
Não. O telefone vem do login e aparece bloqueado — é sua identidade no sistema.

**Por que não consigo marcar "Li e aceito" nos termos?**  
É preciso: (1) preencher nome e nascimento; (2) **rolar os termos LGPD até o final** (aparece `✅ Termos lidos.`).

**E se eu marcar "Li e não concordo"?**  
O app explica as implicações da recusa. O cadastro segue conforme a política da igreja; seu aceite fica registrado.

**A câmera não abre para a selfie.**  
Permita o uso da câmera nas configurações do celular. Na **versão web**, você pode escolher uma foto do dispositivo.

**Dicas para uma boa selfie?**  
Rosto centralizado, boa iluminação, sem obstruções (óculos escuros, boné).

**O que acontece após "Cadastro inicial concluído"?**  
Você é direcionado a completar **Dados Cadastrais** ou aceitar **LGPD**, conforme o que ainda faltar.

**Recebo código de família no cadastro?**  
Sim. O sistema reserva automaticamente um `family_id` / código de família para seu perfil.

---

## 3. Painel / Dashboard

**O que é o Índice do Aplicativo?**  
Tela com **etiquetas** (atalhos) para cada módulo. Toque na etiqueta para abrir o card correspondente no Painel.

**O que é o Painel?**  
Carrossel de cards com os módulos da igreja (eventos, ofertas, pastoral, etc.). Pode ser acessado pelo Índice ou pela navegação direta.

**Como passo de um card para outro?**  
Deslize o dedo horizontalmente **ou** use os botões **‹** e **›** no rodapé (segurar avança automaticamente). O rodapé mostra a posição atual (**1 / N**).

**Por que o topo está vermelho?**  
Seu **LGPD está pendente**. Complete os termos em **Dados Cadastrais** ou na tela **LGPD**.

**Por que não vejo alguns cards?**  
Cada card depende da sua **permissão de perfil** (ACL). A igreja define quem vê Financeiro, Escalas, etc. Fale com o administrador se achar que falta algo.

**O que é o banner de "controle de acesso indisponível"?**  
O servidor de permissões não respondeu corretamente. Em produção estrita, alguns recursos podem ficar bloqueados até a equipe TI corrigir.

**Para que serve o botão Menu no rodapé?**  
Abre a tela de **atalhos** com lista de módulos e o botão de **sair**.

**Para que serve a engrenagem?**  
Abre a **Manutenção** — só aparece se você tiver permissão de equipe/administrador.

**O que é a tela de atalhos (Menu)?**  
Lista rápida: Agenda, Salas, QR Totem, Ofertas, Pastoral, Membros, etc., sem deslizar o carrossel. Cada atalho tem **ícone colorido** por módulo.

---

## 4. Agenda da Família

**O que é "audiência" ou pré-check-in?**  
Marcar na lista quem da sua família participará do evento — **antes** de apresentar o QR no totem.

**Como escolho o evento?**  
No card **Agenda da Família**, use **Trocar Evento** (chips horizontais).

**Não aparece nenhum evento.**  
Pode não haver eventos publicados no momento, ou todos estão fora da janela visível. Tente **Atualizar** ou aguarde a equipe publicar.

**O que significa "vagas"?**  
Quantidade de inscritos em relação à **capacidade máxima** do evento.

**Marquei a audiência e nada mudou no QR.**  
O card de QR só aparece no **dia do evento** e após o pré-check-in, conforme o tipo de fluxo (totem, quórum, manual).

**Posso desmarcar a audiência depois?**  
Em eventos normais, sim. Em **quórum com check-in já confirmado no totem**, a audiência pode **travar** para proteger a lista oficial.

**Evento de quórum: só posso marcar uma pessoa?**  
Sim. Apenas o **membro da sessão ativa** pode ser marcado na audiência.

**Aparece erro em vermelho no card (preCheckinGateError).**  
Falha ao consultar o pré-check-in no servidor — não significa necessariamente que você não marcou; pode ser instabilidade. Tente novamente ou avise a equipe.

**O que é check-in automático?**  
Alguns eventos registram presença direto na audiência, sem QR — o app informa isso nos textos de orientação.

---

## 5. Check-in e QR Code

**Quando o card de QR Code aparece?**  
Geralmente no **dia do evento**, com audiência marcada, evento publicado e permissão de acesso. O título pode variar: *QR Code — Check-in Totem*, *Check-in Quórum*, etc.

**O que é a "etiqueta" amarela?**  
Seu **código de família** — identificador usado no totem junto com o QR.

**Como faço check-in no culto?**  
1) Marque audiência na Agenda; 2) No dia, abra o card QR; 3) Apresente o QR na câmera do **totem** da igreja.

**O totem diz "Pré-check-in não encontrado".**  
Volte à **Agenda da Família** e marque a audiência dos participantes antes de escanear.

**O totem diz que já foi confirmado.**  
Normal — evita check-in duplicado. Sua presença já está registrada.

**Posso fazer check-in sem totem?**  
Depende da configuração do evento (manual, automático). Em eventos com totem/quórum, o QR no totem é o passo de confirmação.

**Toquei no card QR e abriu uma lista de membros.**  
É o **CheckinModal** — seleção manual auxiliar. A confirmação oficial no culto é pelo **totem** + pré-check-in na Agenda.

**Não tenho código de família / QR vazio.**  
Vincule ou confira seu código em **Dados Cadastrais** ou com a secretaria.

**Badges IBN KIDS / IBN TEENS no QR?**  
Indicam que o evento tem salas Kids e/ou Teens — informativo no card.

---

## 6. SALA(S) — Kids e Teens

**Posso marcar entrada na sala pelo meu celular?**  
**Não.** No dashboard o card **SALA(S)** é **somente leitura** — você vê quem entrou, mas não marca.

**Quem aparece na lista do meu card SALA(S)?**  
Apenas **membros da sua família** inscritos no evento (Kids ou Teens). A equipe na manutenção vê todos os inscritos.

**Quem marca a entrada na sala Kids/Teens?**  
A **equipe** na **Manutenção → Sala(s) - Check In**.

**O que significa o ✓ na lista?**  
A criança/adolescente teve **entrada na sala confirmada** pela equipe.

**Contagem "3/5" nos chips das salas?**  
Inscritos com entrada confirmada / total de inscritos naquela sala (da **sua família**, no dashboard).

**Lista vazia no card SALA(S).**  
Pode ser que ninguém da sua família esteja inscrito no evento, ou que o sistema não identificou seu código de família — confira em **Dados Cadastrais**.

---

## 7. Dízimos e Ofertas

**O card some quando o evento não tem ofertas?**  
**Não.** O card **Dízimos e Ofertas** permanece **sempre** no carrossel (se seu perfil tiver permissão ACL). A flag `parm_ofertas` do evento não controla mais a visibilidade deste card.

**Onde vejo a chave PIX?**  
No card **Dízimos e Ofertas** do Painel.

**"Chave PIX indisponível".**  
A chave ainda não foi configurada em `app_parameters` ou falhou ao carregar. Toque em **Atualizar chave PIX** ou avise a tesouraria.

**Como copio a chave PIX?**  
Toque em **Copiar chave PIX**. Mensagem de sucesso aparece por alguns segundos.

**O PIX pelo app debita automaticamente?**  
Não. O app só **exibe e copia** a chave — o pagamento é feito no app do seu banco.

---

## 8. Lista de Membros e Mapa

**O que é a Lista de Membros?**  
Consulta de membros com busca por nome, código de família e atalho WhatsApp.

**Para que serve o botão Mapa?**  
Abre o **mapa de geolocalização** (versão web/PWA) com pins por endereço/CEP.

**O mapa não abre ou está vazio no celular nativo.**  
O mapa completo funciona na **versão web (PWA)**. No app nativo pode aparecer apenas orientação para usar o navegador.

**Por que meu pin não aparece no mapa?**  
CEP ou endereço podem estar incompletos em **Dados Cadastrais**, ou a geocodificação ainda não rodou. Toque em **Atualizar mapa**.

**Filtros: Visitantes vs Com papel?**  
Visitantes são perfis marcados como visitantes no ACL; "com papel" agrupa demais perfis cadastrados.

**Posso ver telefone de qualquer membro?**  
Somente o que seu perfil tem permissão de visualizar; contato via WhatsApp quando disponível.

**Ícone de usuários na tabela.**  
Abre modal com **membros daquela família**.

---

## 9. Aniversariantes

**De onde vêm os aniversariantes?**  
Datas de nascimento cadastradas nos perfis/membros.

**Como filtro por mês?**  
Use o **seletor de mês** (Picker) no topo do card.

**Lista vazia no mês.**  
Ninguém cadastrado faz aniversário naquele mês, ou faltam datas de nascimento.

**Ícone WhatsApp.**  
Abre conversa com o aniversariante, se houver telefone.

---

## 10. Financeiro (membro)

**Posso lançar despesas/receitas pelo app?**  
**Não** na tela **Financeiro** do membro — é **somente leitura**. Lançamentos são feitos pela equipe na **Manutenção**.

**Por que alguns meses têm "(só planejado)"?**  
Há orçamento **PLANEJADO** naquele mês, mas ainda sem movimento **REALIZADO**. O resultado REALIZADO pode aparecer vazio; use a seção **Orçamento**.

**O que é "saldo acumulado até o mês"?**  
Soma de todos os lançamentos REALIZADOS até o fim do mês selecionado — não é só o movimento daquele mês.

**O que é YTD no boletim?**  
Movimento **REALIZADO** acumulado no **ano civil** até o mês selecionado.

**Seção "Planejado × Realizado" bloqueada.**  
Não há lançamentos PLANEJADO para aquele mês.

**Aviso amarelo sobre comentários.**  
Alguns comentários de lançamentos não carregaram — os valores principais ainda podem estar corretos.

**Por que não vejo o mês atual?**  
O seletor do dashboard financeiro oculta o **mês corrente** — foco em meses já encerrados para consulta.

---

## 11. Escalas e Estacionamento

**O que vejo no card Escalas?**  
Tipos de escala da igreja (vigilância, estacionamento, intercessão, etc.) e quem serve em cada data. No mesmo domingo podem aparecer **vários servos** quando o tipo permite mais de uma vaga.

**Quantos servos podem servir no mesmo domingo?**  
O limite é configurado em **Manutenção → Tipos de Escala** (`vagas_por_servico`, de 1 a 50). O mesmo servo não pode ser escalado duas vezes na mesma data.

**Como contato um servo?**  
Ícone **WhatsApp** ao lado do nome, quando houver telefone.

**Estacionamento: como identifico um veículo?**  
Selecione escala de estacionamento → **Identificar veículo** → digite a **placa** → busca vincula ao proprietário cadastrado.

**Posso alterar a escala pelo app de membro?**  
Não. Alterações são na **Manutenção → Programação de Escalas** *(staff)*.

---

## 12. Dados Cadastrais

**Não consigo ver alguns campos.**  
Permissões de **coluna** (ACL) podem ocultar CPF, alertas médicos, etc., conforme seu papel.

**"Campo protegido" ao editar.**  
Você tem visualização mas não permissão de **alteração** naquele campo.

**Como troco minha senha de 4 dígitos?**  
Seção **Senha de acesso**: senha atual, nova e confirmação.

**CEP preencheu o endereço sozinho?**  
Sim — o app consulta o servidor (`sync_profile_address_from_cep`) e sugere logradouro, bairro, cidade.

**Como cadastro veículo?**  
Na seção **Veículos**: placa, marca, modelo, cor.

**Como vinculo minha família a outra?**  
Seção **Vincular à família**: busque pelo código e solicite vínculo (conforme regras da igreja).

**Cabeçalho pede "Complete seu cadastro".**  
Faltam campos obrigatórios do onboarding (CPF, e-mail, endereço, etc.).

**Posso trocar de telefone?**  
Sim, com fluxo dedicado que atualiza perfil e sessão — use com cuidado para não perder acesso.

---

## 13. Gerenciar Família

**Quem pode gerenciar família?**  
Perfis com permissão de tela **Gerenciar família** — em geral o responsável pela conta familiar.

**Qual a diferença entre membro em `members` e perfil em `profiles`?**  
Membro da família pode existir sem app próprio; perfil com telefone pode fazer login.

**Como adiciono alguém que já está em outra família?**  
Busque pelo **nome** ou informe os dados. Se a pessoa já pertence a outra família, o app pede **confirmação de transferência** para a sua família.

**O endereço é copiado ao aceitar ou transferir?**  
**Sim.** Ao confirmar transferência, aceitar membro pendente (checkbox) ou adicionar novo membro, o app copia o **endereço completo** do gestor (CEP, rua, número, complemento, bairro, cidade, estado) para o perfil do membro — desde que o gestor tenha endereço cadastrado e o membro tenha perfil identificável (telefone ajuda).

**Endereço não foi copiado.**  
O vínculo familiar pode ter sido feito mesmo assim. Verifique se **seu** perfil tem endereço completo e se o membro tem telefone. Se persistir, avise a equipe técnica (RPC `update_profile_field` / `profiles-sync-address-from-cep-rpc.sql`).

**O que é o checkbox de aceite do membro?**  
**Reconhecimento familiar** — confirma que aquele membro pertence à sua família no sistema. Ao marcar como aceito, o endereço da família também é herdado.

**Não consigo excluir um membro.**  
O **representante legal** da conta não pode ser removido.

**"Telefone já no grupo familiar".**  
Já existe membro/perfil com esse número na mesma família.

**Kids/Teens: bolinhas coloridas.**  
Indicam faixa etária conforme parâmetros da igreja (sala Kids ou Teens).

---

## 14. Coração Aberto e Meus Pedidos

**O que é Coração Aberto?**  
Canal para pedidos de **cuidado pastoral**, oração ou intercessão.

**Qual a diferença entre Sigilo pastoral e Intercessão?**  
**Sigilo:** acesso restrito à equipe pastoral. **Intercessão:** pode ser compartilhado com grupo de intercessão (conforme política da igreja).

**Como escolho Motivo e Situação?**  
Use os **chips** na tela (categorias carregadas do servidor). Em telas estreitas, Motivo e Situação aparecem empilhados.

**Posso pedir para outra pessoa?**  
Sim — selecione beneficiário **família** ou **terceiro** e preencha os dados.

**Onde vejo pedidos enviados?**  
**Meus pedidos** (`/pastoral-history`) — histórico com status.

**Lista vazia em Meus pedidos.**  
Você ainda não enviou pedidos ou a sessão não identificou seu perfil — faça login novamente.

**Quem responde ao pedido?**  
A equipe pastoral **fora do app** (telefone, encontro pessoal, etc.). O app registra e encaminha o pedido.

---

## 15. Termos LGPD

**Por que preciso rolar até o fim dos termos?**  
Requisito de **consentimento informado** — o sistema só libera o aceite após leitura completa.

**Posso mudar de ideia depois?**  
O aceite fica em `lgpd_accepted` no perfil. Para revisar, acesse **LGPD** ou **Dados Cadastrais**.

**Recusei os termos. Posso usar o app?**  
Depende da política da igreja; o app registra sua preferência. Alguns recursos podem ficar limitados.

---

## 16. Menu, navegação e saída

**Qual a diferença entre Menu e Sair?**  
No **Painel**, **Menu** leva aos atalhos. O **Sair** / **Encerrar sessão** fica na tela de atalhos (rodapé).

**Sair fecha o app no Android?**  
Pode encerrar o aplicativo após limpar a sessão — comportamento esperado.

**Troquei de celular. O que faço?**  
**Saia** no aparelho antigo; no novo, login com celular + senha.

**Mudaram minhas permissões e um card sumiu.**  
Saia e **entre de novo** para recarregar permissões do servidor.

---

## 17. Totem de check-in

**O totem é para membros usarem no culto?**  
Não. É um **aparelho fixo da igreja** operado na entrada para **escanear** o QR das famílias.

**Senha do totem.**  
**9999** (configuração padrão do modo totem).

**Nenhum evento no totem.**  
Pode não ser o dia do evento, evento não publicado, sem flag totem/quórum, ou colunas SQL não aplicadas — mensagens na tela orientam.

**Câmera do totem não funciona na web.**  
Totem web exige **HTTPS** (ou localhost em desenvolvimento). Permita câmera no navegador.

**Devo sair do totem após o culto?**  
**Sim.** Use **Encerrar sessão** para não deixar o quiosque logado.

---

## 18. Manutenção (equipe)

**Quem acessa a Manutenção?**  
Perfis com permissão `view` em `/maintenance-dashboard` — ícone engrenagem no Painel.

**"Sem permissão" ao tocar na engrenagem.**  
Seu papel não inclui manutenção. Solicite ao `super_admin`.

**Como crio evento com totem e quórum?**  
**Programação de Eventos** → novo/editar → toggles **Ativação de Totem** e **Requer Quorum** → **Publicado**.

**Como marco entrada na sala Kids?**  
**Sala(s) - Check In** → selecione evento → checkbox por inscrição.

**Como importo financeiro?**  
**Informações Financeiras** → CSV ou colar → substituir ou acrescentar.

**Como gero escala em lote?**  
**Programação de Escalas** → preview do ciclo → confirmar → grava via `aplicar_ciclo_escala`. Configure **vagas por domingo** e **modo do ciclo** (individual ou equipe) em **Tipos de Escala**.

**Controle de Acesso: quem configura?**  
Somente **`super_admin`** — papéis e grants por perfil.

---

# Por assunto

## Assunto: Acesso e senha

| Pergunta | Resposta |
|----------|----------|
| Esqueci minha senha | WhatsApp na tela de login (PIN temporário) ou secretaria |
| Quantos dígitos tem a senha? | **4** |
| Posso usar letras na senha? | Não — apenas números |
| Mesmo celular em dois aparelhos? | Sim, com mesmo login — evite sessões simultâneas em aparelhos compartilhados |
| Preciso de e-mail para entrar? | Não — login é **celular + PIN** |

---

## Assunto: LGPD e privacidade

| Pergunta | Resposta |
|----------|----------|
| Onde ficam meus dados? | Banco **Supabase** (nuvem), projeto da igreja |
| Quem vê meu CPF? | Perfis com permissão ACL de coluna; oculto para membros comuns |
| Selfie: para que serve? | Identificação no cadastro; armazenada no Storage Supabase |
| Posso excluir minha conta pelo app? | Não há fluxo automático de exclusão — contate a secretaria |
| Aceite LGPD é obrigatório? | Fortemente recomendado; recusa é registrada |

---

## Assunto: Check-in e eventos

| Pergunta | Resposta |
|----------|----------|
| Ordem correta do check-in | Audiência → QR no dia → scan no totem |
| Check-in automático | Marca na audiência já conta presença — sem QR |
| Quórum vs totem | Quórum exige confirmação no totem e trava lista; totem pode existir sem quórum |
| Evento rascunho | Membros **não veem** — precisa **Publicado** |
| Capacidade esgotada | Inscrição pode falhar ao marcar audiência — ver vagas no card |

---

## Assunto: Família e cadastro

| Pergunta | Resposta |
|----------|----------|
| O que é family_id? | Código único da família no sistema |
| Diferença family_id e codigo_membro | Podem coincidir; usados no QR e etiqueta |
| Criança sem celular | Cadastre em **Gerenciar Família** como membro |
| Membro com celular próprio | Cadastre telefone — pode gerar perfil/login próprio |

---

## Assunto: Permissões e perfis

| Pergunta | Resposta |
|----------|----------|
| O que é ACL? | Controle de acesso — define telas, cards e campos por papel |
| Papéis comuns | member, family_acceptor, lider, events_admin, pastoral, super_admin |
| Sou membro mas não vejo Financeiro | Grant não atribuído — admin adiciona em Controle de Acesso |
| Banner ACL indisponível | RPC `profile_has_access` ausente ou erro — equipe TI |

---

## Assunto: Financeiro

| Pergunta | Resposta |
|----------|----------|
| REALIZADO vs PLANEJADO | Realizado = o que aconteceu; Planejado = orçamento previsto |
| Membro edita lançamentos? | Não |
| Esvaziar mês (manutenção) | Pode apagar só REALIZADO, só PLANEJADO ou ambos — escopo explícito |

---

## Assunto: Pastoral

| Pergunta | Resposta |
|----------|----------|
| Pedido é anônimo? | Vinculado ao seu perfil; sigilo pastoral restringe quem lê no backend/equipe |
| Urgência / emergência? | O app **não** substitui emergência (SAMU, 190) — use canais adequados |
| Editar pedido enviado? | Não pelo app — contate pastoral se precisar complementar |

---

## Assunto: Escalas

| Pergunta | Resposta |
|----------|----------|
| Como sei minha próxima escala? | Card **Escalas** no Painel |
| Ciclo em bloco | Gera vários domingos de uma vez *(staff)* — modo **individual** (cada servo em domingo distinto) ou **equipe** (até N servos no mesmo domingo) |
| Vagas por domingo | Definidas em **Tipos de Escala** (`vagas_por_servico`, 1–50). O mesmo servo não repete na mesma data |
| Domingo já ocupado | Modo individual **pula** domingos com registro; modo equipe preenche vagas restantes até o limite |

---

## Assunto: Mapa e endereço

| Pergunta | Resposta |
|----------|----------|
| Mapa mostra endereço exato? | Aproximação por **CEP** — pins podem ser agrupados |
| Atualizei CEP e mapa antigo | Toque **Atualizar mapa**; cache local é renovado |
| Visitante no mapa | Perfil marcado como visitante no ACL |

---

## Assunto: Segurança e dados

| Pergunta | Resposta |
|----------|----------|
| Senha fica salva no celular? | Só sessão (telefone + id perfil) — **não** a senha em texto |
| Conexão segura? | HTTPS com Supabase |
| Compartilhar celular logado | **Sempre saia** ao terminar |
| Quem administra permissões? | `super_admin` na Manutenção |

---

## Assunto: Problemas técnicos

| Pergunta | Resposta |
|----------|----------|
| App lento | Verifique internet; feche abas no navegador (PWA) |
| Tela branca / erro | Atualize página; limpe cache do navegador |
| Versão web vs app nativo | Mapa completo e alguns recursos são **PWA** |
| Mensagem menciona "execute script SQL" | Configuração incompleta no Supabase — equipe TI |
| Build / deploy | Igreja publica pasta `dist/` após `npm run build:web` |

---

## Assunto: Totem e quiosque

| Pergunta | Resposta |
|----------|----------|
| Membro escaneia no próprio celular? | Não — membro **mostra** QR; **totem escaneia** |
| QR de outra família | Totem confirma só quem tem pré-check-in **daquela família** |
| Vários eventos no mesmo dia | Totem seleciona evento elegível automaticamente |
| lockPastEvents | Eventos passados são bloqueados automaticamente ao operar totem |

---

## Não encontrou sua dúvida?

1. Consulte o [`MANUAL_TREINAMENTO.md`](MANUAL_TREINAMENTO.md) (passo a passo prático).
2. Anote a **mensagem exata** na tela e o **módulo** onde ocorreu.
3. Contate a **secretaria** (cadastro, família, eventos) ou **equipe técnica** (erros de servidor, permissões, SQL).

---

*FAQ — App IBN · Igreja Batista Norte*


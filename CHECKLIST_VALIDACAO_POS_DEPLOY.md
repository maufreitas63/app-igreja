# Checklist de validação pós-deploy

Conferência em produção dos **pedidos** feitos ao app. Marque cada item após testar.

**Planilha Excel por papel:** [`pdfs/CHECKLIST_VALIDACAO_POR_PAPEL.xlsx`](pdfs/CHECKLIST_VALIDACAO_POR_PAPEL.xlsx) — combina este checklist com o mapa ACL para teste prático (uma aba por papel). Regenerar: `npm run build:validation-checklist-xlsx`.

---

## Deploy e atualização

**Pedido:** alterações demoravam para aparecer no ambiente de produção.

- [ ] Após novo deploy, a versão mais recente aparece ao recarregar a página (hard refresh ou aba anônima)

---

## LGPD e cadastro

**Pedido:** botões LGPD não respondiam (aceitar / recusar / confirmar).

- [ ] Em **Dados cadastrais → LGPD**, rolar os termos até o final habilita **Li e aceito** / **Li e não concordo**
- [ ] **Confirmar** grava e retorna sem erro
- [ ] No **cadastro de visitante**, o mesmo fluxo de leitura dos termos funciona

---

## Dashboard principal

**Pedido:** ao voltar do detalhe da escala, retornar ao card Escalas sem rolagem pelo carrossel.

- [ ] Dashboard → **Escalas** → abrir uma escala → **Voltar** volta direto ao card Escalas, sem animação entre cards

**Pedido:** ao selecionar uma escala, trocar de card sem animação.

- [ ] Ao tocar em uma escala, o carrossel pula direto ao card de detalhe

**Pedido:** após check-in no totem, destacar o card QR em azul piscina até o dia do evento passar.

- [ ] Evento com totem ativo, no dia de hoje: após confirmar check-in, card **QR Code — Totem** fica azul piscina
- [ ] No dia seguinte (ou fora do dia do evento), o destaque não aparece

**Pedido:** ao sair de telas abertas pelo dashboard, voltar ao card que originou a navegação.

- [ ] **Lista de Membros** → **Mapa Geral** → **Voltar** retorna ao card Lista de Membros
- [ ] **Gestão de Cadastros** → **Dados Cadastrais** ou **Gerenciar Família** → **Voltar** retorna ao card Gestão de Cadastros
- [ ] **Coração Aberto**, **Financeiro** e demais atalhos com `returnDashboardCard` restauram o card correto

**Pedido:** paletas de cores distintas por card do carrossel.

- [ ] Cada card do dashboard tem fundo/borda/acento visualmente diferenciados

**Pedido:** card Gestão de Cadastros com título e botões reposicionados.

- [ ] Título do card 6 exibe **Gestão de Cadastros** (não “Dados Cadastrais” como título do card)
- [ ] Botões **Dados Cadastrais** e **Gerenciar Família** menores e mais abaixo no card

**Pedido:** botões Visitantes e Mapa Geral na mesma linha no card Lista de Membros.

- [ ] **Visitantes** (ou **Membros**) e **Mapa Geral** ocupam metade da largura cada, na mesma linha

**Pedido:** ícone touch-app no botão Copiar chave PIX.

- [ ] Card **Dízimos e Ofertas** → botão **Copiar chave PIX** exibe ícone *touch-app*

**Pedido:** toasts longos sem truncar em uma linha.

- [ ] Mensagens de erro/aviso longas aparecem em até 3–6 linhas, legíveis no PWA

**Pedido:** ícone do app com a arte da marca d'água.

- [ ] Favicon e ícone instalável do PWA usam o logo da marca d'água (não o ícone padrão Expo)

---

## Manutenção — eventos

**Pedido:** cards do dashboard de manutenção sumiam (tela em branco após editor de evento).

- [ ] Navegar entre cards da manutenção; abrir e fechar editor de evento; cards continuam visíveis

**Pedido:** cancelar criação de evento não podia deixar tela vazia.

- [ ] **Novo evento** → **Cancelar** → carrossel e cards permanecem na tela

**Pedido:** botão **+7** em evento cadastrado para duplicar uma vez, sete dias depois, em rascunho.

- [ ] Em evento **já cadastrado**, botão **+7** abaixo de Publicado/Rascunho
- [ ] Confirmar cria **1 rascunho** para **+7 dias**; o evento original não muda

---

## Manutenção — controle de acesso

**Pedido:** painel de Controle de Acesso com scroll; papéis e colunas visíveis.

- [ ] **Controle de Acesso** rola corretamente; papéis e colunas legíveis, sem corte

**Pedido:** liberar **Card Financeiro** e **Relatórios financeiros** nos papéis.

- [ ] Em **Papéis → Telas**, aparecem **Card Financeiro (dashboard)** e **Relatórios financeiros (/financial)**
- [ ] É possível ligar/desligar **Ver** por papel em cada um, separadamente

**Pedido:** caixa de busca de recursos em Papéis com botão para limpar a pesquisa.

- [ ] Ao digitar na busca, aparece botão para limpar; ao tocar, a lista volta completa

**Pedido:** telas do produto principal e de manutenção identificáveis na lista de Papéis (marcadores e ordenação).

- [ ] Telas do produto com marcador azul; telas de manutenção com marcador amarelo; azuis listadas antes dos amarelos

---

## Manutenção — Acessos de Usuários

**Pedido:** card exclusivo do super administrador com histórico de logins e telas visitadas por sessão.

- [ ] Card **Acessos de Usuários** aparece por último no carrossel, só para **super_admin**
- [ ] Tabela lista nome, último acesso e total de logins; filtro por nome funciona
- [ ] Ícone de histórico abre balão com data/hora do login e telas visitadas (mais recente primeiro)
- [ ] **Limpar histórico** apaga logins e telas sem erro; toast confirma quantidade removida
- [ ] Supabase: `access-control-profile-access-insights.sql` + `profile-access-insights.sql` (ou patch); hotfix limpeza: `profile-access-insights-clear-fix.sql`

---

## Manutenção — escalas

**Pedido:** botão para limpar a busca em **Associar servos**.

- [ ] Em **Servos em Disponibilidade**, campo de busca com botão limpar quando há texto

**Pedido:** **Tipos de Escala** em duas seções — cadastro novo e lista de cadastradas (edição só na segunda).

- [ ] Seções **Novo tipo de escala** e **Escalas cadastradas** separadas
- [ ] Edição só na seção **Escalas cadastradas**

**Pedido:** as duas seções de Tipos de Escala começam fechadas; ao clicar, abre uma ou outra.

- [ ] Ambas as seções iniciam recolhidas
- [ ] Toque no cabeçalho abre a seção; a outra fecha; toque de novo recolhe
- [ ] Ao editar um tipo, **Escalas cadastradas** abre automaticamente

---

## Financeiro — relatórios (membros)

**Pedido:** seletor de mês em dropdown na tela Financeiro.

- [ ] Seção **Relatórios** com **Mês** em dropdown modal; trocar mês atualiza os relatórios
- [ ] Seção **Saldo bancário** exibe contas com saldo e linha **Saldo total**
- [ ] Atalho destacado **Relatório de Despesas (RD)** no topo do módulo Financeiro

**Pedido:** coluna Descrição larga o suficiente para **EXTRAORDINARIO** em uma linha.

- [ ] Em **Resultado do Mês**, **EXTRAORDINARIO** não quebra em duas linhas

**Pedido:** altura do card Financeiro igual ao card Agenda da Família.

- [ ] Card **Financeiro** no dashboard com a mesma altura do card **Agenda da Família**

**Pedido:** ao copiar chave PIX em Dízimos e Ofertas, mostrar toast em vez de mensagem fixa na tela.

- [ ] Card **Dízimos e Ofertas** → **Copiar chave PIX** exibe balão (toast) de confirmação

**Pedido:** subir o título “Dízimos e Ofertas” dentro do card.

- [ ] Título **Dízimos e Ofertas** visualmente mais alto no card (sem sobrepor outros elementos)

---

## Super admin — chave técnica ACL

**Pedido:** em perfil super admin, abaixo do nome da tela ativa no cabeçalho, exibir a chave técnica ACL (como em Papéis → Telas).

- [ ] Com perfil **super admin**, no **Dashboard**, ao trocar de card, aparece segunda linha com `dashboard.card.*` ou `scale_type.*` no roster
- [ ] Com perfil **super admin**, em **Manutenção**, aparece `maintenance.card.*` ou `/maintenance-dashboard` no menu
- [ ] Perfis que não são super admin **não** veem a linha técnica

---

## Financeiro — Relatório de Despesas (RD)

**Pedido:** data de hoje por padrão em cada linha do RD.

- [ ] Nova linha do RD já vem com a data de hoje; campo continua editável
- [ ] Valor digitado da direita para esquerda (`1` → R$ 0,01)
- [ ] **Submeter e Finalizar** grava RD e abre WhatsApp do tesoureiro
- [ ] **Excluir RD** remove pendente da lista (confirmação na web/PWA)

---

## Deploy — versão publicada

- [ ] `GET /build-info.json` retorna `commit` do deploy atual
- [ ] `/cadastro-familia/` carrega formulário público em produção

---

## Recepção Familiar

- [ ] Submissão do formulário público aparece em **Recepção Familiar**
- [ ] **Gravar selecionados** / **Rejeitar selecionados** funcionam em lote

---

## Mudança de Papéis

- [ ] Card visível para pastoral/super_admin
- [ ] Alterar visitante ↔ congregado ↔ membro reflete após novo login

---

## Manutenção — Informações Financeiras

**Pedido:** lista de RDs do mês de referência; desconciliar; accordion; título fixo nas seções; versão na carga; comentário só ao clicar.

- [ ] **Relatórios de Despesas** lista RDs do mês selecionado
- [ ] RD conciliado → **Remover vínculo** → volta para pendente
- [ ] Só uma seção aberta por vez (accordion); título da seção não desloca ao expandir
- [ ] Carga/limpeza em lote com seletor **REALIZADO / PLANEJADO**
- [ ] Editar lançamento: comentário vazio; teclado só ao tocar em “Toque para digitar…”

**Pedido:** RD conciliado em mês diferente da emissão deve aparecer no relatório do mês do lançamento.

- [ ] RD de junho vinculado a despesa de maio aparece ao filtrar **maio** em Informações Financeiras

**Pedido:** dropdown de mês na seção de RDs (não depender só do “Mês de referência” global).

- [ ] Seção de RDs com seletor de mês próprio

**Pedido:** ao vincular RD no lançamento, exibir descrições das despesas.

- [ ] **Adicionar** em lançamento → **Vincular RD** → cada RD pendente mostra descrição dos itens

---

## Controle de Acesso — aba Perfis

**Pedido:** dropdown com todos os usuários (substituir busca por texto).

- [ ] Aba **Perfis** exibe **Selecionar perfil** com lista completa de usuários

---

## Cadastro de Usuário — exclusão

**Pedido:** botão para excluir usuário e referências no Supabase.

- [ ] **Excluir usuário** remove perfil após confirmação (requer `scripts/delete-profile-complete-rpc.sql`)
- [ ] Não permite excluir a própria sessão nem o único `super_admin`

---

## Perfil, selfie e família

**Pedido:** selfie não atualizava no banco nem na tela.

- [ ] Nova selfie aparece na hora e persiste após sair e voltar
- [ ] Foto de membro em **Gerenciar família** grava corretamente

**Pedido:** tela branca ao abrir mapa na Lista de Membros.

- [ ] Mapa abre sem tela branca

**Pedido:** coluna **GPS** na Lista de Membros (após Zap) para copiar endereço completo em uma linha.

- [ ] Cabeçalho da lista: **Nome | Família | Zap | GPS**
- [ ] Ícone de mapa copia endereço com CEP (ex.: `Rua, 123, Bairro, Cidade, SP, 12345-678`)
- [ ] Toast: *Cole o conteúdo da área de transferência em seu aplicativo de navegação.*
- [ ] Ícone desabilitado quando o perfil não tem endereço/CEP suficiente
- [ ] Mesmo comportamento na lista de **Visitantes**
- [ ] **SQL em produção:** `scripts/access-control-map-pin-roles.sql` (RPCs com campos de endereço)

**Pedido:** membro adicionado deve aparecer na lista; busca por nome; data com barras; sem duplicata na família.

- [ ] Membro novo aparece na lista após salvar
- [ ] Busca por nome funciona
- [ ] Data de nascimento formata com `/` ao digitar
- [ ] Não permite o mesmo membro duas vezes na mesma família

---

## Mapa de geolocalização

**Pedido:** ao abrir detalhes de um pin, ícone de mapa ao lado do WhatsApp para copiar endereço para navegação.

- [ ] No card de detalhes do pin, ícone de mapa à esquerda do WhatsApp
- [ ] Toque copia endereço completo em uma linha (com CEP)
- [ ] Toast: *Cole o conteúdo da área de transferência em seu aplicativo de navegação.*
- [ ] Ícone desabilitado se não houver endereço/CEP para montar a linha

---

## Coração Aberto

**Pedido:** em **Meus pedidos**, borracha por pedido para excluir só os ainda não iniciados pelo Cuidado Pastoral.

- [ ] Ícone de borracha no topo do formulário continua limpando o rascunho (novo pedido)
- [ ] Em **Meus pedidos**, cada card tem borracha individual
- [ ] Pedido com status **Novo** (ou sem Acolher/Apoiar/Acompanhar) pode ser excluído após confirmação
- [ ] Pedido já iniciado pelo Cuidado Pastoral (Acolher, Apoiar, Acompanhar ou em andamento) → borracha bloqueada e mensagem explicativa
- [ ] **SQL em produção:** `scripts/pastoral-request-delete-rpc.sql`

---

## Login e interface

**Pedido:** login sem marca d'água; redes sociais só no passo 1; marca d'água mais discreta; altura alinhada ao dashboard.

- [ ] Tela de login/senha sem marca d'água
- [ ] Ícones de redes sociais só no passo 1 (telefone/CPF); passo 2 (senha) sem ícones
- [ ] Demais telas: marca d'água mais transparente (~9% de opacidade)
- [ ] Altura da marca d'água alinhada ao card do dashboard
- [ ] Marca d'água visível no **Índice** e nas abas do app (exceto login, cadastro e totem)

**Pedido:** carregamento do dashboard sem barras horizontais no centro dos cards.

- [ ] Ao carregar cards do dashboard, aparece indicador discreto (ou área vazia), sem skeleton de barras no meio do card

**Pedido:** ícones oficiais de Instagram e YouTube (formato squircle).

- [ ] Ícones de redes sociais no login/cadastro com formato squircle oficial

**Pedido:** logout do totem igual ao app principal (web volta para login com `signedOut=1`).

- [ ] Encerrar sessão no totem redireciona corretamente para a tela de login

---

## Navegação entre cards

**Pedido:** ir de Estacionamento para Acolhimento (e vice-versa) sem animação lenta do carrossel.

- [ ] Atalhos entre cards relacionados saltam direto, sem rolagem animada entre intermediários

---

## Registro

| Data | Validador | Observações |
|------|-----------|-------------|
| | | |

---

## SQLs pendentes em produção (conferir antes de validar)

| Script | Necessário para |
|--------|-----------------|
| `scripts/financial-module-access.sql` | ACL Card Financeiro e Relatórios em Papéis |
| `scripts/access-control-pastoral-role-grants.sql` | Equipe Pastoral com privilégios de Membro + Cuidado Pastoral |
| `scripts/access-control-remove-tstmax-scale-resources.sql` | Ocultar escalas TstMax em Papéis |
| `scripts/access-control-map-pin-roles.sql` | Coluna GPS na Lista de Membros (endereço na RPC) |
| `scripts/pastoral-request-delete-rpc.sql` | Excluir pedido pastoral em Meus pedidos |
| `scripts/expense-reports-schema.sql`, `expense-reports-rpc.sql` | RD (membro + manutenção) |
| `scripts/recepcao-cadastro-familiar.sql` | Recepção Familiar + formulário público |
| `scripts/access-control-pastoral-role-change.sql` | Mudança de Papéis |
| `scripts/delete-profile-complete-rpc.sql` | Excluir usuário no Cadastro de Usuário |

---

*Atualizado em 12/06/2026*

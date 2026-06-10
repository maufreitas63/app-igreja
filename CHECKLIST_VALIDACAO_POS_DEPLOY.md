# Checklist de validação pós-deploy

Conferência em produção dos **pedidos** feitos ao app. Marque cada item após testar.

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

**Pedido:** coluna Descrição larga o suficiente para **EXTRAORDINARIO** em uma linha.

- [ ] Em **Resultado do Mês**, **EXTRAORDINARIO** não quebra em duas linhas

**Pedido:** altura do card Financeiro igual ao card Agenda da Família.

- [ ] Card **Financeiro** no dashboard com a mesma altura do card **Agenda da Família**

---

## Financeiro — Relatório de Despesas (RD)

**Pedido:** data de hoje por padrão em cada linha do RD.

- [ ] Nova linha do RD já vem com a data de hoje; campo continua editável

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

---

## Perfil, selfie e família

**Pedido:** selfie não atualizava no banco nem na tela.

- [ ] Nova selfie aparece na hora e persiste após sair e voltar
- [ ] Foto de membro em **Gerenciar família** grava corretamente

**Pedido:** tela branca ao abrir mapa na Lista de Membros.

- [ ] Mapa abre sem tela branca

**Pedido:** membro adicionado deve aparecer na lista; busca por nome; data com barras; sem duplicata na família.

- [ ] Membro novo aparece na lista após salvar
- [ ] Busca por nome funciona
- [ ] Data de nascimento formata com `/` ao digitar
- [ ] Não permite o mesmo membro duas vezes na mesma família

---

## Login e interface

**Pedido:** login sem marca d'água; redes sociais só no passo 1; marca d'água mais discreta; altura alinhada ao dashboard.

- [ ] Tela de login/senha sem marca d'água
- [ ] Ícones de redes sociais só no passo 1 (telefone/CPF); passo 2 (senha) sem ícones
- [ ] Demais telas: marca d'água mais transparente
- [ ] Altura da marca d'água alinhada ao card do dashboard

---

## Registro

| Data | Validador | Observações |
|------|-----------|-------------|
| | | |

---

*Atualizado em 22/05/2026*

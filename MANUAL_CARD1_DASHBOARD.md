# Manual de Instrucoes - Card 1 do Dashboard

**Pacotes:** [`PACOTE_5_MANUAL_PAINEL.md`](PACOTE_5_MANUAL_PAINEL.md) (membro) · [`PACOTE_2_OPERACAO.md`](PACOTE_2_OPERACAO.md) (operação) · **Índice:** [`INDICE_DOCUMENTACAO.md`](INDICE_DOCUMENTACAO.md)

**Atualizado em:** 10/06/2026

## Objetivo

O Card 1 do dashboard foi desenvolvido para concentrar, em uma unica area, a selecao do evento ativo, a visualizacao de vagas e o registro da audiencia da familia.

Este card permite:

- visualizar o evento atualmente em evidencia;
- verificar data, horario e local do evento;
- identificar se o evento possui `IBN Kids` e/ou `IBN Teens`;
- acompanhar a ocupacao de vagas pelo indicador em formato de copo;
- trocar rapidamente entre eventos ativos;
- registrar ou remover individualmente os membros da familia no evento selecionado;
- marcar ou desmarcar todos os membros de uma vez.

## Estrutura do Card

O card esta dividido em tres blocos principais:

### 1. Evento Selecionado

Nesta area aparecem:

- nome do evento em destaque;
- data e horario formatados;
- local do evento;
- identificadores `IBN Kids` e `IBN Teens`, quando aplicavel.

Se nenhum evento estiver selecionado, o card exibira a mensagem:

`Selecione um evento.`

### 2. Vagas

Ao lado do evento selecionado existe um indicador visual em formato de copo.

Ele mostra:

- o numero de vagas restantes entre parenteses;
- a relacao `inscritos/total de vagas`;
- o preenchimento visual proporcional da ocupacao.

Interpretacao:

- quanto mais cheio o copo, maior a ocupacao do evento;
- o valor entre parenteses representa as vagas restantes;
- a linha inferior mostra quantos participantes ja estao registrados.

### 3. Trocar Evento

Esta faixa exibe os eventos ativos disponiveis.

Cada item pode mostrar:

- nome do evento;
- data/hora;
- indicadores coloridos quando houver `kids_room` ou `teens_room`.

Ao tocar em um evento desta lista:

1. ele passa a ser o evento em evidencia;
2. o bloco superior e atualizado;
3. o contador de vagas e recalculado;
4. a audiencia da familia passa a atuar sobre esse evento.

### 4. Audiencia

A parte inferior do card mostra a audiencia da familia vinculada ao usuario logado.

Nesta area:

- cada linha representa um membro da familia;
- o nome do membro aparece sem parentesco;
- cada item possui um checkbox para registrar ou remover a participacao;
- quando o membro ja estiver inscrito, o item indica `Registrado para o evento`.

No cabecalho da audiencia existe um checkbox geral para:

- marcar todos os membros;
- desmarcar todos os membros.

## Como Usar

### Registrar participantes

1. Abra o dashboard.
2. No Card 1, confira qual evento esta em evidencia.
3. Se necessario, use a secao `Trocar Evento` para selecionar outro evento.
4. Na secao `Audiencia`, toque no checkbox ao lado do nome do membro desejado.
5. Aguarde a confirmacao visual do registro.

Resultado esperado:

- o membro fica marcado;
- o texto `Registrado para o evento` aparece;
- o contador de vagas e atualizado.

### Remover participantes

1. Localize o membro ja marcado na audiencia.
2. Toque novamente no checkbox.

Resultado esperado:

- o membro deixa de ficar marcado;
- o registro e removido do evento;
- o contador de vagas e ajustado automaticamente.

### Registrar ou remover todos

1. No topo da secao `Audiencia`, use o checkbox geral.
2. Se todos estiverem desmarcados, a acao registra todos.
3. Se todos estiverem marcados, a acao remove todos.

## Regras de Funcionamento

### Eventos exibidos

O card apresenta apenas:

- eventos do dia atual;
- eventos futuros;
- eventos desbloqueados/ativos.

Eventos antigos permanecem no banco para historico, mas nao aparecem no Card 1.

### Indicadores `IBN Kids` e `IBN Teens`

Quando o evento possuir suporte a criancas ou adolescentes:

- `IBN Kids` aparece com destaque amarelo;
- `IBN Teens` aparece com destaque vermelho.

Esses indicadores aparecem:

- no bloco do evento selecionado;
- na lista de troca de eventos;
- no card de `Check In`, vinculado ao mesmo evento em evidencia.

### Atualizacao das vagas

Sempre que um membro e registrado ou removido:

- o total de inscritos e recalculado;
- o numero de vagas restantes e atualizado;
- o copo muda visualmente conforme a ocupacao.

## Navegacao no Dashboard

O dashboard nao depende mais de arraste lateral.

Para navegar entre os cards, utilize os botoes inferiores:

- `<` para voltar;
- `Sair` para encerrar a sessao;
- `>` para avancar.

## Integracao com o Card de Check In

O evento selecionado no Card 1 tambem alimenta o card de `Check In`.

No card de `Check In` sao refletidos:

- o nome do evento em evidencia;
- os badges `IBN Kids` e `IBN Teens`, quando existirem.

Isso garante que o evento selecionado no Card 1 seja o mesmo contexto visual do QR Code.

## Mensagens Possiveis

Durante o uso, algumas mensagens podem aparecer:

- `Erro ao carregar evento.`
- `Nenhum evento no momento.`
- `Selecione um evento para registrar participantes.`
- `Família não vinculada.`
- `Carregando participantes já registrados...`

## Resumo Operacional

Fluxo recomendado de uso:

1. Escolher o evento em `Trocar Evento`;
2. Confirmar nome, horario, local e indicadores do evento;
3. Conferir vagas disponiveis no copo;
4. Marcar ou desmarcar participantes da audiencia;
5. Avancar ao card de `Check In` quando necessario.


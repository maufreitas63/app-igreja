# Pacote 6 — Manual do Painel de Manutenção (uso pela equipe)

Documentação **autocontida** para quem gerencia o aplicativo: secretaria, líderes, pastoral, financeiro e TI.

**Atualizado em:** 10/06/2026

Conteúdo integrado: acesso via engrenagem, ACL, todos os cards de maintenance-dashboard, com resultado esperado e efeito no app dos membros.

---

# Manual completo

---

# Manual do Painel de Manutenção — Uso pela Equipe

**App IBN · Igreja Batista Norte**

Manual **autocontido** para quem **gerencia** o aplicativo: secretaria, líderes de escala, equipe pastoral, financeiro e administradores de TI. Cobre **acesso à manutenção, todos os cards do painel de manutenção** e o que cada ação produz no app dos membros.

**Público:** equipe com permissão de manutenção (não é manual do membro).  
**Formato:** passo a passo por card, com **resultado esperado** em cada ação.  
**Tempo estimado:** 60 a 90 minutos na primeira leitura completa.

**Pacote:** [`PACOTE_6_MANUAL_MANUTENCAO.md`](PACOTE_6_MANUAL_MANUTENCAO.md) · **Índice:** [`INDICE_DOCUMENTACAO.md`](INDICE_DOCUMENTACAO.md) · **Membros:** [`PACOTE_5_MANUAL_PAINEL.md`](PACOTE_5_MANUAL_PAINEL.md)

**Atualizado em:** 10/06/2026

---

## Como usar este manual

| Símbolo | Significado |
|---------|-------------|
| **Objetivo** | O que você vai conseguir fazer |
| **Caminho** | Onde tocar na tela |
| **Passo a passo** | Ações numeradas |
| **Resultado esperado** | O que você deve **ver** ou **confirmar** ao concluir — e o efeito no app dos membros |
| **Dica** | Atalho ou cuidado útil |
| **Se der erro** | Mensagens comuns e o que fazer |

Itens em **negrito** são botões, títulos ou áreas da interface.

> **Cards que não aparecem no seu perfil**  
> A igreja define permissões por papel. Escalas, pastoral, financeiro e telas de super administrador só aparecem para quem tem acesso. Sem engrenagem no Índice → peça liberação ao administrador.

> **Diferença do Pacote 5**  
> O [Pacote 5](PACOTE_5_MANUAL_PAINEL.md) ensina o **painel do membro**. Este manual ensina o **painel de manutenção** (fundo âmbar/escuro, ícone engrenagem).

---

# Parte 0 — Acesso e navegação na manutenção

## 0.1 Entrar na manutenção (engrenagem)

### Objetivo
Abrir o painel de manutenção a partir do app, com sua conta de equipe.

### Caminho
**Índice do Aplicativo** → rodapé → ícone **engrenagem** (Configurações) → **Manutenção**.

### Passo a passo

1. Faça login normalmente (celular + senha de 4 dígitos).
2. No **Índice**, localize a **engrenagem** ao lado de **Encerrar sessão** / **Sair do aplicativo**.
3. Toque na engrenagem.
4. Aguarde a checagem de permissão (indicador âmbar).

### Resultado esperado

- Tela de manutenção com cabeçalho **Boas-Vindas, {seu nome}** e badge **Manutenção**.
- Fundo em tons âmbar/ardósia (visual diferente do painel do membro).
- Card inicial **Módulos de manutenção** com atalhos para cada módulo.

### Se der erro

| Situação | O que fazer |
|----------|-------------|
| Não há engrenagem no Índice | Seu perfil não tem acesso à rota `/maintenance-dashboard` — fale com o **super administrador** |
| Alerta *Sem permissão* | Mesmo caso; peça papel com acesso à manutenção |
| *Redirecionando…* e volta ao painel | Tentativa de abrir manutenção sem permissão |

### Dica
O super administrador libera acesso em **Controle de Acesso** (Parte 11) ou via scripts SQL de ACL.

---

## 0.2 Navegar entre os módulos (carrossel âmbar)

### Objetivo
Alternar entre os cards de manutenção e voltar ao Índice ou ao menu interno.

### Caminho
Rodapé **‹** · **Menu** ou **Voltar** · **›** + contador **N / M** (âmbar).

### Ordem dos módulos (quando todos visíveis no seu perfil)

| # | Nome no painel | Função resumida |
|---|----------------|-----------------|
| 0 | **Manutenção** | Menu de atalhos |
| 1 | **Programação de Eventos** | Criar/editar cultos e eventos |
| 2 | **Cronograma de Eventos** | Visão em linha do tempo |
| 3 | **Sala(s) - Check In** | Entrada Kids/Teens |
| 4 | **Tipos de Escala** | Cadastro de tipos de serviço |
| 5 | **Servos em Disponibilidade** | Quem pode servir em cada escala |
| 6 | **Programação de Escalas** | Datas e ciclo em bloco |
| 7 | **Cuidado Pastoral** | Acompanhar pedidos do Coração Aberto |
| 8 | **Informações Financeiras** | CSV, lançamentos, RD |
| 9 | **Lista de Presença** | Documento de quórum |
| 10 | **Cadastro de Usuário** | *(super_admin)* |
| 11 | **Controle de Acesso** | *(super_admin)* |

### Passo a passo

1. No card **0**, toque no atalho desejado (ícone + nome).
2. Use **‹** e **›** para mudar de card (segurar avança automaticamente).
3. No card **0**, **Menu** → volta ao **Índice** do aplicativo.
4. Nos demais cards, **Voltar** → retorna ao card **0** (menu de módulos).
5. Leia o contador **1 / N** — **N** depende das permissões do seu perfil.

### Resultado esperado

- Badge do cabeçalho mostra o nome do módulo ativo (ex.: **Programação de Eventos**, **Novo evento**, **Editar evento**).
- Atalho selecionado no menu fica destacado.
- Ao salvar um evento, a lista e o cronograma refletem a alteração.

---

# Parte 1 — Programação de Eventos

### Objetivo
Publicar cultos e eventos para que os **membros** vejam na Agenda, marquem audiência, usem QR e salas.

### Caminho
**Programação de Eventos** → **Novo evento** ou toque em evento da lista.

### Passo a passo — criar evento

1. Toque em **Novo evento**.
2. Preencha:
   - **Nome do evento**
   - **Data e horário** (calendário **DD/MM/AAAA** + hora **HH:MM**)
   - **Local do evento**
   - **Capacidade (vagas)** *(obrigatório)*
   - **Salas e recursos**: marque **Kids** e/ou **Teens** se houver IBN Kids/Teens
   - **Ativação de Totem**: **Sim** / **Não**
   - **Requer Quorum**: **Sim** / **Não** (assembleia com lista formal de presença)
   - **Publicação**: ligado = **Publicado**; desligado = **Rascunho**
3. Toque em **Salvar** (rodapé fixo).

### Resultado esperado

- Toast **Evento criado** ou **Evento atualizado** — *Alterações gravadas com sucesso.*
- Na lista: badge **Publicado** (verde) ou **Rascunho** (laranja).
- **Publicado** → membros veem o evento no card **Agenda da Família** e podem marcar audiência.
- **Rascunho** → oculto para membros até publicar.
- Metadados na lista: data, local, vagas, selos **Kids** · **Teens** · **Totem** · **Quórum**.

### Passo a passo — replicar evento (+7 dias)

1. Abra um evento **já cadastrado** (edição).
2. Toque em **+7**.
3. Confirme **Criar cópia** no diálogo *Replicar evento (+7)*.

### Resultado esperado

- Toast **Evento replicado** — *1 rascunho criado para daqui a 7 dias.*
- Novo item na lista como **Rascunho**; evento original **não muda**.

### Passo a passo — excluir evento

1. Na edição, **Apagar evento** → confirme **Sim, apagar**.

### Resultado esperado

- Toast **Evento apagado**; item some da lista e do cronograma.
- Se houver inscrições vinculadas, pode falhar — leia a mensagem de erro.

### Passo a passo — conferir quórum no editor

1. Com **Requer Quorum = Sim**, role até **Registro de check-in (quórum)**.
2. Veja tabela com nome, contato e status (**Confirmado**, **Pré check-in**, **Inscrito**).

### Resultado esperado

- Visão operacional antes de gerar a **Lista de Presença** (Parte 9).

### Se der erro

| Toast / mensagem | Causa comum |
|------------------|-------------|
| *Informe o nome do evento* | Campo vazio |
| *Informe a capacidade (vagas)* | Vagas obrigatórias |
| *Não é possível publicar: a data … é anterior a hoje* | Evento no passado com publicação ligada |
| **Erro ao salvar** | Permissão RLS, vínculos com inscrições |

### Dica
No dia do culto, confira **data, local, vagas e salas** antes dos membros abrirem o app — evita confusão no card SALA(S) do membro.

---

# Parte 2 — Cronograma de Eventos

### Objetivo
Visualizar eventos no tempo e abrir a edição rapidamente.

### Caminho
**Cronograma de Eventos**.

### Passo a passo

1. Alterne **Por dia** ou **Por mês**.
2. Leia a legenda: **Publicado** vs **Rascunho**.
3. Toque numa linha de evento para abrir o editor (Parte 1).

### Resultado esperado

- Contagem *N evento(s) · M dia(s)/mês(es)*.
- Rascunhos em laranja; publicados visíveis aos membros.
- Vazio: **Nenhum evento ativo agendado** + orientação para cadastrar.

### Dica
Use antes do culto da semana para ver buracos na agenda e publicar rascunhos pendentes.

---

# Parte 3 — Sala(s) - Check In

### Objetivo
Registrar a **entrada física** de crianças e adolescentes nas salas — o que faz o **✓** aparecer no card SALA(S) do pai/mãe.

### Caminho
**Sala(s) - Check In** (após selecionar evento na Agenda do membro).

### Pré-requisito

- No **painel do membro**, alguém da equipe (ou o próprio gestor) deve ter selecionado o culto em **Agenda da Família** — este card lê o **evento ativo** desse contexto.

### Passo a passo

1. Abra **Sala(s) - Check In**.
2. Confira o bloco **Evento ativo (card 1 — Agenda)** — nome e data do culto.
3. Escolha **IBN KIDS** ou **IBN TEENS**.
4. Na lista de inscritos, toque no **checkbox** ao lado do nome para marcar entrada.
5. Se necessário, use **WhatsApp** ao lado do nome com entrada marcada.

### Resultado esperado

- Contador no chip atualiza: `marcados/total`.
- Checkbox com **✓** = entrada registrada.
- No app do responsável (Pacote 5, Parte 3): o mesmo nome mostra **✓** no card **SALA(S)**.
- Copo de **Vagas** reflete ocupação do evento.

### Se der erro ou aviso

| Mensagem | Significado |
|----------|-------------|
| *Nenhum evento ativo no dashboard…* | Selecione o evento na **Agenda da Família** (painel membro) primeiro |
| *…não possui salas Kids ou Teens ativas* | Edite o evento e ative **Kids**/**Teens** (Parte 1) |
| *Nenhum inscrito em IBN KIDS/TEENS* | Famílias ainda não marcaram audiência/inscrição |
| **Erro** ao marcar | Falha de rede ou permissão — tente de novo |

### Dica
Operação típica no **domingo**: uma pessoa mantém a Agenda com o culto selecionado; outra opera este card na recepção das salas.

---

# Parte 4 — Tipos de Escala

### Objetivo
Cadastrar **tipos de serviço** (vigilância, estacionamento, intercessão, etc.) com vagas por domingo e modo de ciclo.

### Caminho
**Tipos de Escala** *(requer permissão de card de escala)*.

### Passo a passo

1. Abra **Novo tipo de escala** (accordion).
2. Preencha **Código** (ex.: `vigilancia_estacionamento`), **Nome**, **Vagas por domingo** (1–50).
3. Escolha **Modo do ciclo em bloco**:
   - **Individual** — cada servo em domingo distinto no ciclo automático.
   - **Equipe** — até N servos no **mesmo** domingo antes de avançar.
4. Toque em **Cadastrar**.
5. Para editar: ícone **lápis** na lista **Escalas cadastradas** → **Salvar alterações**.
6. Para inativar/excluir: ícone **lixeira** → confirme (remove servos e registros vinculados em cascata).

### Resultado esperado

- Linha na lista: `{código} · {N} vaga(s) · individual|equipe`.
- Toast **Tipos de Escala** com confirmação.
- Tipo aparece nos chips dos cards **Servos** e **Programação de Escalas**.
- Membros veem o nome no card **Escalas** do painel.

### Se der erro

- *Informe o código da escala* / *Informe o nome da escala* — campos obrigatórios.

---

# Parte 5 — Servos em Disponibilidade

### Objetivo
Associar **pessoas** (perfis) a cada tipo de escala, na ordem em que entrarão no ciclo.

### Caminho
**Servos em Disponibilidade** → título interno **Servos das escalas**.

### Passo a passo

1. Selecione o **tipo de escala** no chip horizontal.
2. Em **Associar servos**, digite **Nome completo** (mínimo 2 letras).
3. Toque no resultado da busca para associar.
4. Em **Já associados**, confira a **ordem** (1, 2, 3…) — importante para o ciclo em bloco.
5. Para remover: **lixeira** → confirme **Remover**.

### Resultado esperado

- Nome na lista **Já associados** com número de ordem.
- Toast **Servos** confirmando cadastro.
- Servos passam a aparecer no card **Escalas** do membro nas datas programadas (Parte 6).

### Se der erro

| Mensagem | Causa |
|----------|-------|
| *Cadastre tipos de escala no card Tipos de Escala* | Nenhum tipo criado (Parte 4) |
| *Este servo já está cadastrado neste tipo* | Duplicata |
| *Nenhum perfil com esse nome* | Nome não encontrado — verifique cadastro em **Dados Cadastrais** |

### Dica
Sem **ordem sequencial** definida, o **Escala em bloco** (Parte 6) não gera prévia válida.

---

# Parte 6 — Programação de Escalas

### Objetivo
Definir **quem serve em qual domingo** — manualmente ou em bloco — para o membro ver no card **Escalas**.

### Caminho
**Programação de Escalas** → título interno **Manutenção de escalas**.

### Passo a passo — escala individual

1. Selecione o tipo de escala no chip.
2. Toque em **Nova escala**.
3. Escolha **Servo** e **Data do serviço** (`DD/MM/AA`).
4. **Salvar escala**.

### Resultado esperado

- Toast **Escala** com sucesso.
- Linha no **Histórico** com data e nome.
- No painel do membro: card **Escalas** → tipo → nome na data correspondente.

### Passo a passo — escala em bloco (ciclo automático)

1. Com tipo configurado (**Equipe** ou **Individual**, vagas e servos ordenados — Partes 4 e 5).
2. Toque em **Escala em bloco**.
3. Leia a **Prévia — escala em bloco** (datas, ordem, quantidade).
4. **Gravar bloco** → confirme no diálogo.

### Resultado esperado

- Toast **Escala em bloco** — *N escala(s) gravada(s)*.
- Prévia mostra, no modo **Equipe**, **vários servos na mesma data** até o limite de vagas.
- Membro responde: *“Quem está escalado neste domingo?”* — nomes listados no card **Escalas**.

### Passo a passo — excluir escala

1. No **Histórico**, toque na **lixeira** da linha.
2. Confirme **Excluir escala**.

### Resultado esperado

- Toast **Escala removida**; data some do histórico e do painel do membro.

### Se der erro

- *Selecione um servo* / *Informe uma data válida* — formulário incompleto.
- *Nenhum tipo de escala ativo* — cadastre em Parte 4.

---

# Parte 7 — Cuidado Pastoral

### Objetivo
Receber e **acompanhar pedidos** enviados pelo card **Coração Aberto** dos membros — eles veem o status em **Meus pedidos**.

### Caminho
**Cuidado Pastoral** *(requer permissão `maintenance.card.pastoral_care`)*.

### Passo a passo

1. Em **Quem enviou o pedido**, escolha o solicitante no seletor.
2. Se houver vários pedidos, use o **chip de data/hora**.
3. Leia **Motivo**, **Situação**, **Descrição**, **Pedido para**, **Encaminhado para**.
4. Em **Acompanhamento**, avance **um estágio por vez**:
   - **Acolher** (primeiro)
   - **Apoiar** (após Acolher)
   - **Acompanhar** (após Apoiar)
5. Use **WhatsApp** se houver telefone no perfil.

### Resultado esperado

- Estágio tocado fica destacado em **azul piscina**; estágios futuros permanecem bloqueados até a vez deles.
- Estágios já concluídos permanecem destacados.
- No app do membro (Pacote 5): **Meus pedidos** mostra status **Acolher**, **Apoiar** ou **Acompanhar** — confirma que o pedido **está sendo acompanhado**.
- Loader rosa breve durante gravação; toast **Cuidado pastoral** em sucesso.

### Se der erro

- Toast com mensagem da API — verifique scripts `pastoral-maintenance-rpc.sql` em produção.
- *Nenhum pedido pastoral cadastrado* — nenhum envio ainda pelo Coração Aberto.

### Dica
Não pule estágios — o sistema só libera o próximo após o anterior.

---

# Parte 8 — Informações Financeiras

### Objetivo
Importar movimentação, comentar lançamentos, anexar comprovantes e conciliar **Relatórios de Despesas (RD)**.

### Caminho
**Informações Financeiras** *(requer permissão financeira de manutenção)*.

### Passo a passo — importar CSV do mês

1. Em **Mês de referência**, escolha o **Mês** e a **versão** (ex.: REALIZADO).
2. Abra **Carga em lote**.
3. Cole o CSV na área de texto (**Colar** / **Limpar**).
4. Leia a prévia: *N linha(s) válida(s) · M com erro*.
5. Escolha **Limpar versão antes** ou **Só acrescentar**.
6. **Importar para {mês}** → confirme no diálogo se for substituir.

### Resultado esperado

- Toast **Financeiro** com quantidade importada.
- Resumo: *N realizado(s) · R$ … · M planejado(s)*.
- Membros com permissão veem totais no card **Financeiro** (somente leitura).

### Passo a passo — comentário e comprovante

1. Em **Lançamentos · {mês}**, toque **Adicionar** ou **Editar** comentário.
2. No modal: digite **Comentário / observação**.
3. **Anexar Comprovante** → **Colar da Área de Transferência** ou **Selecionar da Galeria**.
4. **Salvar**.

### Resultado esperado

- Linha mostra *Comentário: …* e *Comprovante anexado*.
- Toast **Comprovante** ou **Financeiro** confirmando.

### Passo a passo — conciliar RD

1. Em **Relatórios de Despesas · {mês}**, localize RD **Pendente**.
2. Vincule ao lançamento (quando disponível na UI).
3. Status passa a **Conciliado**.

### Resultado esperado

- Toast *RD vinculado ao lançamento*; membro que enviou RD vê andamento no fluxo de reembolso.

### Passo a passo — esvaziar mês (destrutivo)

1. **Esvaziar {versão} · {mês}** → confirme ciente da exclusão.

### Resultado esperado

- Lançamentos daquela versão/mês removidos; use com cautela.

### Se der erro

- Clipboard vazia ao colar comprovante.
- Erro de importação CSV — revise formato e colunas.

---

# Parte 9 — Lista de Presença (Quórum)

### Objetivo
Gerar o **documento formal** de presença para assembleias com **Requer Quorum = Sim**.

### Caminho
**Lista de Presença** — após configurar quórum no evento (Parte 1).

### Passo a passo

1. Em **Programação de Eventos**, crie/edite evento com **Requer Quorum = Sim** e publique.
2. Membros fazem check-in (Agenda + QR/totem — Pacote 5).
3. Abra **Lista de Presença**.
4. Selecione o evento no chip horizontal.
5. Role o documento **Lista de Presença – Assembleia Geral**.

### Resultado esperado

- Cabeçalho com **Data**, **Horário**, **Local** e texto estatutário.
- Tabela **#**, **Nome**, **Hora do check-in** preenchida conforme confirmações.
- Atualização automática a cada ~15 s enquanto a tela está aberta.
- Vazio: *Nenhum check-in registrado para este evento até o momento.*

### Se der erro

- *Nenhum evento com Requer Quorum = Sim* — ative a flag no evento.
- *Registro de quórum indisponível no Supabase* — execute scripts SQL de quórum em produção.

---

# Parte 10 — Cadastro de Usuário *(super_admin)*

### Objetivo
Localizar perfil de membro e **corrigir CEP/endereço** quando a secretaria precisa ajustar cadastro.

### Caminho
**Cadastro de Usuário** — visível apenas para **super_admin**.

### Passo a passo

1. Em **Buscar usuário**, digite **Nome** (mín. 2 letras).
2. Toque no resultado.
3. Leia **Dados pessoais** (somente leitura): nome, telefone, e-mail, CPF, nascimento.
4. Edite **CEP**, **Número**, **Complemento** — a prévia **Endereço que será gravado** atualiza via CEP.
5. **Salvar CEP e endereço**.

### Resultado esperado

- Toast **Cadastro de usuário** — *Endereço atualizado com sucesso.*
- Mensagem verde: *CEP e endereço gravados em profiles…*
- Mapa e endereço do membro refletem a alteração.

### Dica
Não é cadastro completo de novo usuário — para primeiro acesso do membro, use o fluxo WhatsApp + Cadastro (Pacote 5).

---

# Parte 11 — Controle de Acesso *(super_admin)*

### Objetivo
Definir **quem vê e edita** cada tela, card e coluna — incluindo manutenção e painel do membro.

### Caminho
**Controle de Acesso** — apenas **super_admin**.

### Aba Perfis — passo a passo

1. **Buscar perfil** por nome, telefone ou código (mín. 2 caracteres).
2. Toque no perfil.
3. Em **Papéis do perfil**, marque/desmarque papéis (ex.: membro, lider, pastoral).
4. Em **Liderança por tipo de escala**, ative tipos que o perfil pode gerenciar *(requer papel lider)*.
5. Aguarde toast **Papéis do perfil** ou **Liderança de escala**.

### Resultado esperado

- Perfil sem papéis → tratado como **visitante** (*Sem papéis atribuídos…*).
- Membro ganha cards no painel conforme papel.
- Líder ganha acesso aos cards de escala na manutenção.

### Aba Papéis — passo a passo

1. Selecione um **papel** no chip.
2. Filtre **Telas**, **Tabelas** ou **Colunas**.
3. Use a busca: *Buscar recurso (ex.: relatórios financeiros, /financial)*.
4. Alterne **Ver** e **Editar** por recurso.
   - Telas do **produto principal** = marcador azul.
   - Telas de **manutenção** = marcador âmbar.

### Resultado esperado

- **Editar** só habilita se **Ver** estiver ligado.
- Após salvar, usuário precisa **sair e entrar** no app para ver novos cards.
- Engrenagem aparece quando há `view` em `/maintenance-dashboard`.

### Se der erro

- *Apenas perfis com o papel super_admin podem gerenciar permissões.*

### Dica
Scripts SQL em `scripts/` complementam recursos novos (financeiro, pastoral, mapa, escalas) — rode em produção após deploy.

---

# Rotinas recomendadas (resumo operacional)

## No dia do culto

| Ordem | Ação | Resultado para a igreja |
|-------|------|-------------------------|
| 1 | Conferir evento **Publicado** (Parte 1) | Membros veem culto na Agenda |
| 2 | Selecionar evento na **Agenda** (painel membro) | Salas e QR usam o culto certo |
| 3 | Operar **Sala(s) - Check In** (Parte 3) | Pais veem **✓** no card SALA(S) |
| 4 | Totem na entrada (Pacote 5) | Check-in confirmado; quórum alimentado |

## Semanal

- Cadastrar cultos da semana (**+7** para replicar domingo anterior).
- Programar **Escalas** (Partes 4–6) para o domingo.
- Revisar **Cuidado Pastoral** (Parte 7).

## Mensal

- **Informações Financeiras** — importar extrato (Parte 8).
- **Controle de Acesso** — conferir novos voluntários (Parte 11).

---

# Apêndice — Scripts SQL frequentes (produção)

| Necessidade | Script (pasta `scripts/`) |
|-------------|---------------------------|
| ACL financeiro | `financial-module-access.sql` |
| Pastoral — equipe | `access-control-pastoral-role-grants.sql` |
| Excluir pedido (membro) | `pastoral-request-delete-rpc.sql` |
| Pastoral — manutenção | `pastoral-maintenance-rpc.sql` |
| Escalas — tipos/servos | `escalas-tipos-maintenance-rpc.sql`, `escalas-volunteers-rpc.sql` |
| Mapa / GPS membros | `access-control-map-pin-roles.sql` |
| Quórum | scripts de quórum citados na UI da Lista de Presença |

---

# Encerramento — Sair da manutenção

### Objetivo
Voltar ao Índice ou encerrar sessão com segurança.

### Caminho
Card **Manutenção** → **Menu** → Índice → **Encerrar sessão**; ou use **Voltar** entre cards.

### Resultado esperado

- **Menu** no card 0 → Índice do aplicativo.
- **Encerrar sessão** → tela de login; dados locais limpos.

---

## Resumo — o que a equipe deve conseguir após este manual

| Necessidade da igreja | Onde fazer |
|------------------------|------------|
| Membros veem culto e vagas | Parte 1 — evento **Publicado** + vagas |
| Pai vê filho aceito na sala | Parte 3 — checkbox entrada → **✓** no app do membro |
| Lista oficial de assembleia | Parte 1 (Quórum) + Parte 9 |
| Quem serve no domingo | Partes 4–6 — escalas |
| Pedido pastoral acompanhado | Parte 7 — Acolher → Apoiar → Acompanhar |
| Finanças do mês atualizadas | Parte 8 — importação CSV |
| Novo líder com acesso | Parte 11 — papéis e permissões |

---

*App IBN · Igreja Batista Norte · Manual de Manutenção v2026-06-10*


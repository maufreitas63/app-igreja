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

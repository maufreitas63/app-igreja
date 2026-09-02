# Pacote 5 — Manual do Painel (uso pelo membro)

Documentação **autocontida** para primeiro acesso e uso diário do painel do membro.

**Atualizado em:** 23/06/2026

Conteúdo integrado: login, cadastro, LGPD (reconhecimento **opcional** via `LGPD_Ativo`), navegação, todos os cards do dashboard (sem manutenção), com ilustrações anotadas em **largura integral (100%)** e resultado esperado em cada ação.

---

# Manual completo

---

# Manual do Painel — Uso pelo Membro

**App IBN · Igreja Batista Norte**

Manual **autocontido** para quem usa o aplicativo pela primeira vez ou no dia a dia. Cobre **login, cadastro, painel e todos os cards do membro** — sem o painel de manutenção (engrenagem).

**Público:** membros, famílias e voluntários no celular ou PWA (navegador).  
**Formato:** passo a passo por card, com **resultado esperado** em cada ação.  
**Tempo estimado:** 45 a 60 minutos na primeira leitura completa.

**Pacote:** [`PACOTE_5_MANUAL_PAINEL.md`](PACOTE_5_MANUAL_PAINEL.md) · **Índice:** [`INDICE_DOCUMENTACAO.md`](INDICE_DOCUMENTACAO.md)

**Atualizado em:** 03/07/2026

---

## Como usar este manual

| Símbolo | Significado |
|---------|-------------|
| **Objetivo** | O que você vai conseguir fazer |
| **Caminho** | Onde tocar na tela |
| **Passo a passo** | Ações numeradas |
| **Resultado esperado** | O que você deve **ver** ou **confirmar** ao concluir |
| **Dica** | Atalho ou cuidado útil |
| **Ilustração** | Captura da tela com **marcadores numerados** (①②③…); tabela **Ref.** explica cada ponto |
| **Se der erro** | Mensagens comuns e o que fazer |

Itens em **negrito** são botões, títulos ou áreas da interface.

> **Cards que não aparecem**  
> A igreja define o que cada perfil pode ver. Se um card não estiver no seu painel, fale com a secretaria — não é defeito do aparelho.

---

# Parte 0 — Primeiro contato com o app

## 0.1 Entrar pela primeira vez (celular e código)

### Objetivo
Acessar o app com seu **celular** e **código de 4 dígitos** (senha temporária na primeira vez).

### Caminho
Tela **Boas-vindas** → **1. Seu celular** → **Continuar** → **Receber código no WhatsApp** → **2. Código de acesso** → entrar automaticamente ou **Acessar**.

### Ilustração — Boas-vindas

![Boas-vindas — captura anotada](docs/manual-painel/screens/00-login.png)

| Ref. | Elemento indicado na imagem |
|:----:|------------------------------|
| ① | Campo **Seu celular** — exemplo `(11) 98765-4321` |
| ② | Botão **Continuar** após DDD + número válidos |
| ③ | Campo **Código de acesso** (4 dígitos, oculto) |
| ④ | **Receber código no WhatsApp** na primeira vez |



### Passo a passo

1. Abra o app IBN (link da igreja no navegador ou atalho instalado).
2. Digite seu celular com DDD — o app formata: `(00) 00000-0000`.
3. Toque em **Continuar**.
4. Na **primeira vez**, toque em **Receber código no WhatsApp**.
   - Leia o texto abaixo do campo: o código pode ir para **você** ou para o **Ministério de Acolhimento**, conforme a política da igreja.
5. Abra o WhatsApp, copie ou memorize os **4 dígitos**.
6. Digite o código no campo **2. Código de acesso** (oculto, como PIN).
7. Ao completar o 4º dígito, o app pode entrar sozinho; ou toque em **Acessar**.

### Resultado esperado

- Login aceito → você vai para **Cadastro** (primeira vez), **Termos LGPD** (se pendente e módulo ativo) ou **Painel / Índice do Aplicativo**.
- Na tela de boas-vindas, o passo **2 Código** fica ativo após o celular válido.

### Dica
Depois do primeiro acesso, troque o código temporário por uma senha pessoal em **Perfil & Identidade → Dados Cadastrais → Senha de acesso**.

### Se der erro

| Mensagem | O que fazer |
|----------|-------------|
| *Senha incorreta* / *Número ou senha inválidos* | Confira os 4 dígitos. Se **esqueceu** a senha, use **Esqueci minha senha** no passo 2 (e-mail + pergunta de segurança). Na **primeira vez**, use **Receber código no WhatsApp** |
| *Código necessário* | Toque em **Receber código no WhatsApp** antes de digitar |
| *Digite o celular completo…* | Informe 11 dígitos com DDD |

### Esqueci minha senha (já cadastrado)

Use quando você **já tem cadastro** e não lembra o PIN pessoal — **não** confundir com a primeira entrada (código temporário pelo WhatsApp).

### Caminho
**Boas-vindas** → passo **1. Seu celular** → **Continuar** → passo **2. Sua senha** → **Esqueci minha senha**.

### Passo a passo

1. Informe o celular e toque **Continuar**.
2. No passo 2, toque **Esqueci minha senha** (o botão **não** aparece no passo 1).
3. Confirme ou cadastre o **e-mail** vinculado ao perfil.
4. Responda a **pergunta de segurança** (ou cadastre pergunta e resposta na primeira recuperação).
5. Verifique o **e-mail** (incluindo spam) e digite o novo PIN de 4 dígitos no login.

### Resultado esperado

- Banner no login confirmando envio ao e-mail mascarado.
- Novo PIN válido para entrar; depois troque por senha pessoal em **Dados Cadastrais → Senha de acesso**, se desejar.

---

## 0.2 Concluir cadastro (nome, nascimento, LGPD, selfie)

### Objetivo
Finalizar seu cadastro inicial para usar o painel com segurança.

> **Parâmetro global `LGPD_Ativo`** (manutenção → Controle de Acesso): com valor **`sim`**, o fluxo abaixo vale integralmente. Com **`nao`**, use a seção **0.2b** — cadastro simplificado sem termos, selfie nem tela `/lgpd`.

### Caminho
Tela **Cadastro** → preencher dados → ler **Termos LGPD** → **Li e aceito** → **Tirar Selfie Biométrica** → **Confirmar Registro**.

### Ilustração — Cadastro inicial

![Cadastro inicial — captura anotada](docs/manual-painel/screens/01-cadastro.png)

| Ref. | Elemento indicado na imagem |
|:----:|------------------------------|
| ① | **Nome completo** do membro |
| ② | **Data de nascimento** `dd/mm/aaaa` |
| ③ | Caixa rolável dos **Termos LGPD** |
| ④ | Marcação **Li e aceito** |
| ⑤ | **Tirar Selfie Biométrica** antes de confirmar |



### Passo a passo

1. Confira o **Telefone** (veio do login, não editável).
2. Preencha **Nome completo** e **Data Nascimento** (`dd/mm/aaaa`).
3. Informe o **CEP da residência** (8 dígitos).
4. Role a caixa **Termos de Uso e Privacidade (LGPD)** **até o final**.
   - Enquanto rola: `↓ Role para ler tudo ↓`
   - No fim: `✅ Termos lidos.`
5. Marque **Li e aceito** (ou **Li e não concordo**, conforme sua decisão).
6. Toque em **Tirar Selfie Biométrica** — permita a câmera se o celular pedir.
7. Revise a foto → **Confirmar Registro**.
8. Aguarde a mensagem de sucesso do cadastro.

### Resultado esperado

- Alerta *Cadastro inicial concluído* e redirecionamento para **Dados Cadastrais** (completar perfil) ou **Painel**.
- Selfie salva no seu perfil; termos LGPD registrados no sistema.

### Dica
Rosto centralizado, boa luz, sem óculos escuros — facilita identificação nos eventos.

### Se der erro

- *Role os termos…* → leia o LGPD até o fim antes de aceitar.
- Câmera bloqueada → liberar permissão nas configurações do celular/navegador.

### Texto integral — Termos de Uso e Privacidade (LGPD)

Texto exibido na caixa rolável da tela **Cadastro** (e na tela **Termos de Uso e Privacidade**). O nome da entidade vem do parâmetro **`Nome_Entidade`**; o prefixo curto (ex.: **IBN** em **IBN KIDS**) vem de **`Parm_entidade`** em `app_parameters`. Quando não configurados, usa-se **Igreja Batista Norte (IBN)**.

> A Igreja Batista Norte (IBN) respeita a privacidade de seus membros e visitantes, comprometendo-se a coletar e tratar os dados estritamente necessários para gestão administrativa, controle de segurança, atividades eclesiásticas e para a divulgação de eventos e ações da igreja em mídias sociais e outros veículos oficiais de comunicação, sempre em estrita observância à Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018).

---

## 0.2b Cadastro simplificado (quando `LGPD_Ativo = nao`)

### Objetivo
Permitir primeiro acesso **sem** termos LGPD, selfie biométrica nem redirecionamento para `/lgpd` — usado quando a igreja desliga o módulo de privacidade na manutenção.

### Caminho (LGPD desligado)
Tela **Cadastro** → **Nome completo** · **Data Nascimento** · **CEP** → **Continuar** → **Índice do Aplicativo**.

### Ilustração — Cadastro simplificado (LGPD inativo)

![Cadastro simplificado (LGPD inativo) — captura anotada](docs/manual-painel/screens/01c-cadastro-sem-lgpd.png)

| Ref. | Elemento indicado na imagem |
|:----:|------------------------------|
| ① | **Nome completo** do membro |
| ② | **Data de nascimento** `dd/mm/aaaa` |
| ③ | **CEP da residência** (8 dígitos) |
| ④ | **Continuar** — envia ao Índice quando `LGPD_Ativo = nao` (sem termos nem selfie) |



### Passo a passo

1. Confira o **Telefone** (veio do login).
2. Preencha **Nome completo**, **Data Nascimento** e **CEP da residência**.
3. Toque **Continuar** (não há caixa de termos nem botão de selfie).
4. O app leva você direto ao **Índice do Aplicativo** — cabeçalho **sem** alerta vermelho de LGPD pendente.

### Resultado esperado

- Perfil criado com `lgpd_accepted = null` (módulo inativo).
- Login seguinte também vai ao **Índice**, sem passar por `/lgpd`.

### Dica
Somente **super_admin** altera `LGPD_Ativo` em **Manutenção → Controle de Acesso** (interruptor **LGPD Ativo / Inativo**). Requer script `scripts/salvar-app-parameter-admin.sql` no Supabase.

---

## 0.3 Aceitar termos LGPD (se ainda pendente)

### Objetivo
Regularizar privacidade quando o cabeçalho do painel estiver **vermelho** *(somente com `LGPD_Ativo = sim`)*.

### Caminho
**Dados Cadastrais** → botão **LGPD** — ou tela dedicada **Termos de Uso e Privacidade**.

### Ilustração — Termos LGPD

![Termos LGPD — captura anotada](docs/manual-painel/screens/01b-lgpd.png)

| Ref. | Elemento indicado na imagem |
|:----:|------------------------------|
| ① | Caixa rolável dos **Termos LGPD** até o fim |
| ② | Marcação **Li e aceito** ou **Li e não concordo** |
| ③ | Botão **Confirmar** / **Concluir** |



### Passo a passo

1. Abra **LGPD**.
2. Role todo o texto.
3. Marque **Li e aceito** ou **Li e não concordo**.
4. Toque em **Confirmar** ou **Concluir**.

### Resultado esperado

- Preferência salva; cabeçalho **Boas-Vindas** volta ao estilo normal (sem fundo vermelho de alerta).
- Toast ou alerta confirmando o registro.

---

## 0.4 Conhecer o Índice e o Painel (carrossel)

### Objetivo
Saber onde estão os módulos e como alternar entre cards.

### Caminho
**Índice do Aplicativo** (atalhos) ↔ **Painel** (carrossel) — rodapé **‹** · **Menu** · **›**.

### Ilustração — Índice e Painel

![Índice e Painel — captura anotada](docs/manual-painel/screens/02-indice-painel.png)

| Ref. | Elemento indicado na imagem |
|:----:|------------------------------|
| ① | Atalhos do **Índice** abrem o card correspondente |
| ② | Área do **card ativo** no carrossel do Painel |
| ③ | Contador **3 / 8** — posição no carrossel |
| ④ | Rodapé **‹ Menu ›** para navegar e voltar ao Índice |



### Passo a passo

1. No **Índice**, leia *Selecione a tela que deseja abrir*.
2. Toque em uma etiqueta (ex.: **Painel de Eventos**, **Dízimos e Ofertas**) — o app abre o **card correspondente** no Painel.
3. No **Painel**, o topo mostra **Boas-Vindas, {seu nome}** e o nome do card ativo.
4. Use **‹** e **›** no rodapé para mudar de card (ou deslize, se disponível).
5. O contador **1 / N** indica sua posição no carrossel.
6. Toque em **Menu** no centro do rodapé para voltar ao **Índice**.
7. No **Índice**, o rodapé exibe **Encerrar sessão** (web) ou **Sair do aplicativo** (celular); o botão **Menu** no **Painel** ocupa a largura central entre **‹** e **›**. Perfis com permissão de manutenção veem o ícone **Configurações** (engrenagem) **alinhado à direita** do rodapé, na borda do card.
8. Toque em **Encerrar sessão** / **Sair do aplicativo** para sair com segurança.

### Resultado esperado

- Cada atalho do Índice abre o card certo sem precisar passar card por card.
- **Menu** sempre retorna ao Índice; **Voltar** em telas internas retorna ao **card que você abriu** (ex.: Mapa → Lista de Membros).

### Dica
Alguns atalhos ficam **desabilitados** com explicação em cinza — ex.: QR só no dia do evento, Sala(s) sem evento ativo.

---

# Parte 1 — Card Agenda da Família

### Objetivo
Escolher o culto/evento, **ver vagas disponíveis** e **inscrever sua família** (audiência / pré-check-in).

### Caminho
**Início** → toque no culto em Próximos Eventos (abre a Agenda da Família). O carrossel antigo do Painel não é o caminho publicado.

### Ilustração — Agenda da Família

![Agenda da Família — captura anotada](docs/manual-painel/screens/03-agenda-familia.png)

| Ref. | Elemento indicado na imagem |
|:----:|------------------------------|
| ① | Bloco **Evento selecionado** com selos Kids/Teens |
| ② | **Vagas** — número entre parênteses = restantes |
| ③ | **Trocar evento** — lista de cultos publicados |
| ④ | Checkbox de **Audiência** por familiar |



### Estrutura do card

| Área | O que mostra |
|------|----------------|
| **Evento Selecionado** | Nome, data, horário, local; selos **IBN Kids** / **IBN Teens** se houver |
| **Vagas** | Copo visual + número entre parênteses (restantes) + `inscritos/máximo` |
| **Trocar Evento** | Lista de eventos ativos (hoje e futuros) |
| **Audiência** | Integrantes do núcleo familiar (membros **e congregados**) com checkbox; dependentes com reconhecimento pendente ou aceito (`accepted` ≠ `false`) |

### Passo a passo — ver vagas e inscrever

1. No **Início**, toque no culto desejado (Agenda da Família).
2. Se precisar, em **Trocar Evento**, toque em outro culto publicado.
3. No bloco **Evento Selecionado**, confira data, horário e local.
4. Olhe o **copo de vagas**:
   - Número entre parênteses = **vagas ainda disponíveis**.
   - Linha inferior = quantos já estão inscritos no total do evento.
   - Copo mais cheio = evento mais lotado.
5. Na seção **Audiência**, marque o checkbox de cada familiar que participará.
6. Para marcar todos de uma vez, use o checkbox alto à esquerda da lista.
7. No modal **Compromisso enviado para minha agenda**, toque em **Adicionar** para abrir o Google Agenda e gravar o arquivo `.ics` (Apple Calendar / Outlook). O horário é o da igreja (não adianta nem atrasa o culto).

### Resultado esperado

- Membro marcado → texto **Registrado para o evento** ao lado do nome.
- Copo e contador de vagas **atualizam** após cada marcação ou desmarcação.
- O culto pode aparecer na agenda do celular (Google / Apple / Outlook) depois de **Adicionar**.
- Se o evento tiver **check-in automático**, a presença GPS só confirma no raio do templo (cerca de 30 m, três leituras).
- Selos **IBN Kids** / **IBN Teens** indicam que há salas para crianças/adolescentes naquele evento.

### Passo a passo — remover inscrição

1. Toque de novo no checkbox do membro já registrado.

### Resultado esperado

- Checkbox desmarcado; texto *Registrado para o evento* some; vagas recalculadas.

### Se der erro ou aviso

| Situação | Significado |
|----------|-------------|
| *Nenhum evento no momento* | Não há culto publicado para hoje/futuro próximo |
| *Selecione um evento* | Escolha um item em **Trocar Evento** primeiro |
| *Família não vinculada* | Peça código de família na secretaria e complete em **Dados Cadastrais** |
| Evento de **quórum** | Só o membro da sessão ativa pode ser marcado; após check-in no totem, pode travar |

---

# Parte 2 — Card Check-in / QR Code

### Objetivo
Apresentar o **QR Code da família** na entrada ou no totem, no **dia do evento**.

### Caminho
Painel → card **QR Code — Check-in Totem** / **Check In — QR Code** (visível conforme evento e audiência).

### Ilustração — QR Check-in

![QR Check-in — captura anotada](docs/manual-painel/screens/04-qr-checkin.png)

| Ref. | Elemento indicado na imagem |
|:----:|------------------------------|
| ① | Nome do **evento do dia** |
| ② | **Etiqueta** da família (ex.: `FAM-2048`) |
| ③ | **QR Code** para apresentar no totem |



### Pré-requisitos

1. Ter marcado a **audiência** no card Agenda (Parte 1).
2. Estar no **dia do evento** (para a maioria dos modos de check-in).

### Passo a passo

1. No dia do culto, abra o card de QR no Painel ou pelo atalho **QR Code** no Índice.
2. Confira o **nome do evento** (mesmo contexto da Agenda).
3. Localize a **Etiqueta** — código da sua família em destaque.
4. Apresente o **QR Code** (fundo branco) na câmera do **totem** da igreja.
5. Aumente o brilho da tela do celular.

### Resultado esperado

- No totem: *Confirmação realizada com sucesso*.
- No painel: card de QR pode ficar com destaque **azul piscina** após confirmação (até o fim do dia do evento).
- Se já confirmou antes: aviso de que o check-in **já foi realizado** (evita duplicidade).

### Se der erro

| Situação | O que fazer |
|----------|-------------|
| Card QR não aparece no Índice | Marque audiência; confirme que é o dia do evento |
| *Pré-check-in não encontrado* (totem) | Volte à Agenda e marque os participantes |
| Sem etiqueta de família | Complete vínculo familiar em **Perfil & Identidade** |

---

# Parte 2b — Check-in por proximidade (geofence)

### Objetivo
Confirmar presença **automaticamente** ao chegar ao templo, sem passar pelo totem.

### Pré-requisitos

1. Evento com **check-in por proximidade** habilitado pela equipe.
2. **Audiência** marcada na Agenda (Parte 1).
3. Local do evento com **coordenadas** cadastradas nos locais favoritos da igreja.
4. Permissão de **localização** concedida ao navegador/PWA.
5. Estar dentro da **janela de tempo** (desde N horas antes do culto até o fim do dia do evento).

### Passo a passo

1. No dia do culto, abra o dashboard com o evento selecionado.
2. Aceite a permissão de GPS quando solicitado.
3. Aproxime-se do templo — o app exibe progresso de detecção (leituras GPS estáveis).
4. Ao confirmar, aparece toast **Check-in confirmado** com os nomes dos participantes.

### Resultado esperado

- Banner de status indica *detectando*, *sincronizando* ou *confirmado*.
- Não é necessário abrir o card QR se o geofence concluir com sucesso.
- Sem internet no momento: o app enfileira e sincroniza quando a rede voltar.

### Se der erro

| Situação | O que fazer |
|----------|-------------|
| *Local sem coordenadas* | Equipe deve cadastrar lat/lng no local favorito |
| GPS negado | Libere localização nas configurações do navegador |
| Fora do raio | Aproxime-se do templo ou use QR no totem |
| Sem audiência | Marque participantes na Agenda primeiro |

---

# Parte 3 — Card SALA(S) — IBN Kids / IBN Teens

### Objetivo
**Acompanhar se seu filho foi aceito/entrou** na sala Kids ou Teens — somente membros **da sua família**.

### Caminho
Painel → **SALA(S)** (ou atalho **Sala(s)** no Índice, dentro de Painel de Eventos).

### Ilustração — SALA(S) Kids/Teens

![SALA(S) Kids/Teens — captura anotada](docs/manual-painel/screens/05-salas-kids-teens.png)

| Ref. | Elemento indicado na imagem |
|:----:|------------------------------|
| ① | Chip **IBN KIDS** com contador `confirmados/total` |
| ② | Chip **IBN TEENS** (alternar sala) |
| ③ | **✓** = entrada confirmada pela equipe da sala |



### Passo a passo

1. Selecione o evento na **Agenda da Família** primeiro (mesmo culto em evidência).
2. Abra o card **SALA(S)**.
3. Se o evento tiver as duas salas, alterne os chips **IBN KIDS** e **IBN TEENS**.
4. Leia a lista de nomes da sua família inscritos naquela sala.
5. Procure o símbolo **✓** ao lado do nome.

### Resultado esperado

- **✓** ao lado do nome = criança/adolescente **aceito/entrada registrada** pela equipe da sala (check-in feito na operação da igreja).
- Contador no chip: `confirmados/total` da sua família naquela sala.
- Sem inscritos: *Nenhum membro da sua família inscrito em IBN KIDS/TEENS.*

### Dica
Este card é **somente leitura** para o membro. A entrada física na sala é confirmada pela equipe — o ✓ aparece depois que eles registram.

### Se não aparecer seu filho

- Confirme audiência na Agenda e idade/parametrização Kids/Teens do evento.
- Fale com a equipe da sala se o culto já começou e o ✓ ainda não apareceu.

---

# Parte 4 — Card Dízimos e Ofertas

### Objetivo
Ver dados do recebedor e **copiar a chave PIX** para ofertar pelo app do banco.

### Caminho
Painel → **Dízimos e Ofertas**.

### Ilustração — Dízimos e Ofertas

![Dízimos e Ofertas — captura anotada](docs/manual-painel/screens/06-dizimos-ofertas.png)

| Ref. | Elemento indicado na imagem |
|:----:|------------------------------|
| ① | Dados do **recebedor** (nome e CNPJ da igreja) |
| ② | **Chave PIX** exibida para cópia |
| ③ | Botão **Copiar chave PIX** |



### Passo a passo

1. Abra o card e aguarde carregar **Dados do recebedor** (Igreja Batista Norte, CNPJ, instituição).
2. Leia a **Chave PIX** exibida.
3. Toque em **Copiar chave PIX** (ícone de toque).

### Resultado esperado

- Toast **Chave PIX copiada** com orientação para colar no app do banco.
- Você cola no banco e conclui a transferência **fora** do app IBN (o app não debita automaticamente).

### Se der erro

- **Chave PIX indisponível** → toque em **Atualizar chave PIX** ou avise a secretaria.

---

# Parte 5 — Card Coração Aberto

### Objetivo
Enviar um **pedido pastoral** e **acompanhar o status** até saber que está sendo cuidado.

### Caminho
Painel → **Coração Aberto** → formulário; ícone de histórico → **Meus pedidos**.

### Ilustração — Coração Aberto

![Coração Aberto — captura anotada](docs/manual-painel/screens/07-coracao-aberto.png)

| Ref. | Elemento indicado na imagem |
|:----:|------------------------------|
| ① | Seleção de **Motivo** e **Situação** |
| ② | Opção **Para mim** / **Familiar** / encaminhamento |
| ③ | Campo de texto **Seu pedido** |
| ④ | Atalho **Meus pedidos** (histórico) |



### Passo a passo — novo pedido

1. Toque no card (*Toque aqui para iniciar um atendimento personalizado*).
2. Escolha **Motivo** e **Situação** (listas na tela).
3. Indique **Este pedido é para**: **Para mim** / **Familiar** / **Terceiros**.
4. Escolha **Encaminhar para**: **Sigilo pastoral** ou **Intercessão**.
5. Escreva seu pedido em **Seu pedido**.
6. Toque em **Enviar pedido**.

### Resultado esperado (envio)

- Mensagem *Pedido enviado! Estaremos orando por você.*
- Pedido aparece em **Meus pedidos** com status inicial **Novo** ou **Pendente**.

### Passo a passo — acompanhar pedido

1. No formulário, toque no ícone de **histórico** ou abra **Meus pedidos**.
2. Localize seu pedido na lista (data, motivo, situação).
3. Leia o **status** no cartão:

| Status que você pode ver | Significado para você |
|--------------------------|------------------------|
| **Novo** / **Pendente** | Pedido recebido, aguardando equipe |
| **Acolher** | Equipe pastoral iniciou o primeiro cuidado |
| **Apoiar** | Acompanhamento em andamento (segunda etapa) |
| **Acompanhar** | Acompanhamento contínuo (terceira etapa) |
| **Em andamento** / **Aberto** | Pedido ativo na equipe |
| **Encerrado** | Ciclo de cuidado concluído |

### Resultado esperado (acompanhamento)

- Quando a equipe avança o cuidado, o status muda para **Acolher**, depois **Apoiar**, depois **Acompanhar** — isso confirma que **seu pedido está sendo acompanhado**.
- Você não precisa atualizar a tela: ao reabrir **Meus pedidos**, vê o status atual.

### Excluir pedido (se permitido)

- Ícone de borracha no pedido → só quando ainda **Novo** e não iniciado pelo Cuidado Pastoral.
- Se já houver **Acolher/Apoiar/Acompanhar**, a exclusão é bloqueada com mensagem explicativa.

---

# Parte 6 — Card Lista de Membros

### Objetivo
Buscar **membros** ou **visitantes** da igreja, ver integrantes do mesmo núcleo familiar, contatar por WhatsApp, abrir localização individual (GPS) e consultar o **Mapa Geral**.

### Caminho
Painel → **Lista de Membros**.

### Ilustração — Lista de Membros

![Lista de Membros — captura anotada](docs/manual-painel/screens/08-lista-membros.png)

| Ref. | Elemento indicado na imagem |
|:----:|------------------------------|
| ① | Botão **Visitantes** — alterna para lista de visitantes |
| ② | Botão **Mapa Geral** (PWA/web) |
| ③ | Campo **Procurar membro** (*Digite o nome...*) |
| ④ | Ícone **users** na coluna **Família** — abre modal familiar |
| ⑤ | Ícone **WhatsApp** na coluna **Zap** |
| ⑥ | Ícone **map** na coluna **GPS** |



### Estrutura do card

| Área | O que mostra / faz |
|------|---------------------|
| **Visitantes** | Alterna para **LISTA DE VISITANTES** (mesma linha que **Mapa Geral**) |
| **Mapa Geral** | Abre tela de geolocalização com todos os pins permitidos ao seu perfil |
| Resumo | Texto *N membro(s) em ordem alfabética* ou *X de Y* ao filtrar |
| **Procurar membro** | Campo com placeholder *Digite o nome...* e botão limpar (×) |
| Cabeçalho da tabela | Colunas **Nome** · **Família** · **Zap** · **GPS** |
| Coluna **Família** | Ícone **users** (rosa) — abre modal **Membros da família** |
| Coluna **Zap** | Ícone **WhatsApp** (verde quando há telefone) |
| Coluna **GPS** | Ícone **map** (azul quando há CEP/endereço) |

### Passo a passo — lista de membros

1. Com o card em modo **Membros**, leia o resumo no topo (*N membro(s) em ordem alfabética*).
2. Digite em **Procurar membro** para filtrar por nome; use o × para limpar.
3. Na tabela, para cada linha:
   - Toque no ícone **users** (**Família**) para abrir o modal familiar.
   - Toque no **WhatsApp** para abrir conversa (se houver telefone).
   - Toque no **GPS** para focar esse membro no mapa (quando houver endereço).
4. Toque em **Visitantes** para ver a lista de visitantes (título **LISTA DE VISITANTES**, busca **Procurar visitante**).
5. Toque em **Membros** (quando estiver em visitantes) para voltar à lista de membros.
6. Toque em **Mapa Geral** para abrir a tela de mapa completa.

### Resultado esperado — lista principal

- Botões **Visitantes** e **Mapa Geral** visíveis na mesma linha, abaixo do título **Lista de Membros**.
- Tabela preenchida em ordem alfabética; ícones desabilitados (cinza) quando faltam telefone ou endereço.

### Caminho (visitantes)
Lista de Membros → toque **Visitantes**.

### Ilustração — Lista de Visitantes

![Lista de Visitantes — captura anotada](docs/manual-painel/screens/08c-lista-visitantes.png)

| Ref. | Elemento indicado na imagem |
|:----:|------------------------------|
| ① | Título **LISTA DE VISITANTES** |
| ② | Botão **Membros** — volta à lista de membros |
| ③ | Campo **Procurar visitante** |
| ④ | Tabela **Nome · Família · Zap · GPS** |



### Passo a passo — visitantes

1. Toque **Visitantes**.
2. Confira o título **LISTA DE VISITANTES** e o resumo *N visitante(s)...*.
3. Use **Procurar visitante** para filtrar.
4. Toque **Membros** para retornar à lista de membros.

### Resultado esperado (visitantes)

- Mesma estrutura de tabela (**Nome**, **Família**, **Zap**, **GPS**), com dados apenas de visitantes.
- Botão **Membros** (ícone **users**) substitui **Visitantes** na linha de ações.

### Caminho (modal familiar)
Lista de Membros → coluna **Família** → ícone **users** na linha desejada.

### Ilustração — Membros da família (modal)

![Membros da família (modal) — captura anotada](docs/manual-painel/screens/08b-lista-membros-familia.png)

| Ref. | Elemento indicado na imagem |
|:----:|------------------------------|
| ① | Título **Membros da família** |
| ② | Subtítulo **Família {código}** (ex.: IBN0103) |
| ③ | Lista de integrantes com **nome** e **parentesco** |
| ④ | Ícone **WhatsApp** por integrante (quando há telefone) |
| ⑤ | Botão **Fechar** |



### Passo a passo — modal Membros da família

1. Toque o ícone **users** na coluna **Família** de um membro.
2. Leia o título **Membros da família** e o subtítulo **Família {código}** (ex.: **Família IBN0103**).
3. Role a lista de integrantes: nome, **parentesco** (quando cadastrado) e **WhatsApp** por linha.
4. Toque **Fechar** ou fora do cartão para encerrar.

### Resultado esperado (modal familiar)

- Lista todos os integrantes reconhecidos no mesmo `family_id` (fonte canônica: tabela `members`, sincronizada com perfis).
- Mensagem *Nenhum membro reconhecido nesta família* quando o núcleo está vazio para seu perfil.
- Erro em vermelho quando falta permissão ACL ou RPC no Supabase — use **Atualizar lista** no card se a lista principal falhar.

### Caminho (mapa)
Lista de Membros → **Mapa Geral**.

### Ilustração — Mapa Geral

![Mapa Geral — captura anotada](docs/manual-painel/screens/08d-mapa-geral.png)

| Ref. | Elemento indicado na imagem |
|:----:|------------------------------|
| ① | Filtros **Todos** · **Com papel** · **Visitantes** |
| ② | Mapa com **pins** de endereços |
| ③ | Botão **Voltar** ao card Lista de Membros |



### Passo a passo — Mapa Geral (PWA)

1. Toque **Mapa Geral**.
2. Use os filtros **Todos**, **Com papel** e **Visitantes** no topo.
3. Toque em um **pin** no mapa:
   - Com permissão de **detalhe do pin** (`pastoral` / `super_admin`): painel com nome, telefone e endereço; copie o endereço para navegação externa.
   - Sem essa permissão: o mapa permanece visível, mas o app **não abre a localização de outros usuários** — mensagem orientativa ao tocar no pin.
4. Toque **Voltar** → retorna ao card **Lista de Membros**.

### Resultado esperado (mapa)

- Pins coloridos por tipo (membro vs visitante).
- Contadores de quantos endereços estão no mapa conforme o filtro ativo.
- Membros e congregados comuns **veem o mapa geral**; **detalhe de pin alheio** só para perfis autorizados pelo ACL.

### Se der erro

| Situação | O que fazer |
|----------|-------------|
| Lista vazia ou erro ao carregar | Toque **Atualizar lista**; confirme permissão do card com a secretaria |
| Modal familiar vazio | Verifique se a família tem integrantes em `members`; TI deve aplicar `scripts/members-list-family-sync.sql` |
| **Mapa Geral** não abre | Seu papel pode não ter grant em `screen:/mapa-geolocalizacao` |
| Toque no pin sem abrir detalhe | Normal para `member`/`congregado` — detalhe exige `screen:/mapa-geolocalizacao/detalhe-pin` |
| WhatsApp cinza | Telefone não cadastrado para aquele membro |
| GPS cinza | CEP/endereço ausente no perfil |

---

# Parte 7 — Card Aniversariantes

### Objetivo
Ver quem faz aniversário no mês e parabenizar pelo WhatsApp.

### Caminho
Painel → **Aniversariantes**.

### Ilustração — Aniversariantes

![Aniversariantes — captura anotada](docs/manual-painel/screens/09-aniversariantes.png)

| Ref. | Elemento indicado na imagem |
|:----:|------------------------------|
| ① | Seletor **Mês** |
| ② | Lista **DD/MM** + nome |
| ③ | Ícone **WhatsApp** para parabenizar |



### Passo a passo

1. Toque em **Selecionar Mês** (padrão: mês atual).
2. Role a lista com data **DD/MM** e nome.
3. Toque no **WhatsApp** ao lado de quem deseja cumprimentar.

### Resultado esperado

- Texto *N aniversariante(s) em {mês}.*
- Lista vazia: *Nenhum aniversariante encontrado em {mês}.*

---

# Parte 8 — Card Financeiro

### Objetivo
Consultar **relatórios financeiros da igreja** (somente leitura) e solicitar reembolso de despesas, se disponível no seu perfil.

### Caminho
Painel → **Financeiro** → *Toque para abrir o módulo financeiro.*

### Ilustração — Financeiro

![Financeiro — captura anotada](docs/manual-painel/screens/10-financeiro.png)

| Ref. | Elemento indicado na imagem |
|:----:|------------------------------|
| ① | Dropdown **Selecionar mês** |
| ② | Atalho **Relatório de Despesas (RD)** |
| ③ | Seções colapsáveis (**Saldo bancário**, etc.) |



### Passo a passo

1. Abra o módulo **Financeiro**.
2. Escolha o **mês** em **Selecionar mês**.
3. No topo, use o atalho destacado **Relatório de Despesas (RD)** ou role até **Relatórios**.
4. Expanda as seções (uma por vez):
   - **Resultado do mês**

### Ilustração — Financeiro — Resultado do mês

![Financeiro — Resultado do mês — captura anotada](docs/manual-painel/screens/10a-fin-resultado.png)

| Ref. | Elemento indicado na imagem |
|:----:|------------------------------|
| ① | Seção **Resultado do mês** expandida |
| ② | Tabela de **Receitas** do período |
| ③ | Tabela de **Despesas** do período |



### Resultado esperado

- Tabelas e totais do mês selecionado — **sem editar** valores (consulta).
- Mês sem orçamento: aviso *Sem orçamento planejado para este mês* na seção planejado × realizado.
- **Saldo bancário** mostra contas com movimento (Sicredi, Mercado Pago, etc.) e **Saldo total**.

---

# Parte 8b — Relatório de Despesas (RD)

### Objetivo
Solicitar **reembolso de despesas** da igreja com comprovantes e chave PIX.

### Caminho
Painel → **Financeiro** → atalho **Relatório de Despesas (RD)** — ou rota `/expense-report`.

### Ilustração — Relatório de Despesas (RD)

![Relatório de Despesas (RD) — captura anotada](docs/manual-painel/screens/11-relatorio-despesas.png)

| Ref. | Elemento indicado na imagem |
|:----:|------------------------------|
| ① | **Chave PIX** do solicitante |
| ② | Botão **Novo RD** |
| ③ | Lista **Meus relatórios** |
| ④ | Status **Pendente** / **Conciliado** |



### Passo a passo

1. Toque **Novo RD**.

### Ilustração — Formulário de RD

![Formulário de RD — captura anotada](docs/manual-painel/screens/11b-rd-formulario.png)

| Ref. | Elemento indicado na imagem |
|:----:|------------------------------|
| ① | Campo **Chave PIX** |
| ② | **Descrição** da despesa |
| ③ | Anexo de **comprovante** |
| ④ | **Submeter e Finalizar** |



### Resultado esperado

- Toast confirma submissão; tesoureiro recebe mensagem com número do RD e valor.
- Status **Pendente** até a tesouraria conciliar na manutenção; depois **Conciliado**.

### Se der erro

- Configure `Tesoureiro_contato` em `app_parameters` se o WhatsApp não abrir.
- RPC ausente — equipe executa `scripts/expense-reports-schema.sql` e `expense-reports-rpc.sql`.

---

# Parte 9 — Card Escalas

### Objetivo
Saber **quem está escalado** para servir na igreja (vigilância, acolhimento, intercessão, etc.) e contatar servos.

### Caminho
Painel → **Escalas** → **Selecionar Escala** → lista ou card de detalhe.

### Ilustração — Escalas

![Escalas — captura anotada](docs/manual-painel/screens/12-escalas.png)

| Ref. | Elemento indicado na imagem |
|:----:|------------------------------|
| ① | **Selecionar Escala** (tipo de serviço) |
| ② | Tabela **Nome · Data · Zap** |
| ③ | **Identificar veículo** (escala estacionamento) |



### Passo a passo

1. Abra **Escalas**.
2. Em **Selecionar Escala**, toque no tipo desejado (ex.: estacionamento, intercessão).
3. O painel avança para o card de **servos daquela escala** (ou tabela Nome / Data / Zap).
4. Confira **nomes e datas** — são os servos programados para os próximos domingos/datas.
5. Toque no **WhatsApp** ao lado de um servo para contato.
6. Use **Voltar** para retornar à lista de tipos de escala.

### Resultado esperado

- Lista com servos e datas futuras da escala escolhida.
- Para escala de **estacionamento**: botão **Identificar veículo** leva ao card Estacionamento (Parte 11).
- Você consegue responder: *“Quem está de escala hoje nesta função?”* — procure a **data de hoje** na tabela.

### Dica
Se você mesmo é servo, sua escala também aparece aqui — útil para confirmar o dia de serviço.

---

# Parte 10 — Card Servos em escala *(quando visível)*

### Objetivo
Ver detalhe rápido da escala já selecionada no card Escalas.

### Caminho
Aparece automaticamente no carrossel após escolher uma escala com servos cadastrados.

### Ilustração — Servos em escala (detalhe)

![Servos em escala (detalhe) — captura anotada](docs/manual-painel/screens/12-escalas.png)

| Ref. | Elemento indicado na imagem |
|:----:|------------------------------|
| ① | **Selecionar Escala** (tipo de serviço) |
| ② | Tabela **Nome · Data · Zap** |
| ③ | **Identificar veículo** (escala estacionamento) |



### Resultado esperado

- Mesmos nomes e contatos do detalhe aberto em Escalas, em card dedicado no carrossel.
- Some do carrossel se não houver escala selecionada ou servos.

---

# Parte 11 — Card Estacionamento *(quando visível)*

### Objetivo
Identificar o **proprietário de um veículo** pela placa (equipe de acolhimento no estacionamento).

### Caminho
Escalas → escala de estacionamento → **Identificar veículo** — ou card **Estacionamento** se ativo no seu perfil.

### Ilustração — Estacionamento

![Estacionamento — captura anotada](docs/manual-painel/screens/13-estacionamento.png)

| Ref. | Elemento indicado na imagem |
|:----:|------------------------------|
| ① | Campo **Número da placa** |
| ② | Botão **Buscar** |
| ③ | Dados do **proprietário** e veículo |



### Passo a passo

1. Digite a **Número da placa** e busque.
2. Leia **Proprietário**, **Marca**, **Modelo**, **Cor**, **Telefone**.
3. Toque no **WhatsApp** para falar com o dono, ou **Nova busca**.

### Resultado esperado

- Dados do veículo e dono exibidos; placa não encontrada → *Nenhum veículo encontrado…*
- **Voltar** retorna à escala de estacionamento.

---

# Parte 12 — Perfil & Identidade (seu círculo familiar e chamado)

### Objetivo
Manter **seus dados**, **cadastrar integrantes da sua família**, avançar na **Trilha de Discipulado** (incluindo o **Perfil Ministerial** na lição 5.1) e escolher a **paleta de cores** do app.

### Caminho
Painel ou Índice → **Perfil & Identidade** → **Dados Cadastrais**, **Gerenciar Família**, **Trilha de Discipulado** ou seletor de **Paleta de cores**.


## 12.1 Dados Cadastrais

### Passo a passo

1. Toque em **Dados Cadastrais**.

### Ilustração — Dados Cadastrais

![Dados Cadastrais — captura anotada](docs/manual-painel/screens/15-dados-cadastrais.png)

| Ref. | Elemento indicado na imagem |
|:----:|------------------------------|
| ① | Seção **Dados Pessoais** (expandida) |
| ② | Campo **Nome** e demais dados pessoais |
| ③ | Seção **Contato** |
| ④ | Seção **Endereço** |



### Resultado esperado

- Campos salvos com confirmação na tela.
- Código de família visível — necessário para QR, audiência e Salas.
- LGPD regularizado → cabeçalho sem alerta vermelho.

---

## 12.2 Gerenciar Família — incluir integrantes no seu círculo

### Objetivo
Adicionar cônjuge, filhos e outros parentes ao **mesmo código de família** para que participem de audiência, QR, Salas, etc.

### Caminho
**Perfil & Identidade** → **Gerenciar Família**.


### Passo a passo

1. Anote **Família Atual: {código}** no topo.
2. Toque em **Adicionar integrante** (ou use busca por nome/telefone se a pessoa já existe no sistema).
3. Preencha **Nome completo**, **Telefone**, **Nascimento**, **Grau de parentesco** (Cônjuge, Filho(a), etc.).
4. Toque em **ADICIONAR INTEGRANTE**.
5. Na lista **Integrantes Cadastrados**, marque o **checkbox de aceite** (✓) ao lado de quem você confirma como membro do seu núcleo.
6. Para editar, toque no ícone de lápis; para remover, use **EXCLUIR INTEGRANTE** (com confirmação).

### Resultado esperado

- Novo integrante aparece na lista **Integrantes Cadastrados**.
- Com checkbox ✓ (aceite), o membro:
  - Aparece na **Audiência** do card Agenda.
  - Pode constar no **QR Code** da família.
  - Aparece no card **SALA(S)** quando inscrito em Kids/Teens.
- Indicadores **KIDS/TEENS** (bolinhas) por idade na lista.
- Se a pessoa estava em outra família, o app pede **confirmação de transferência** — ao aceitar, ela entra no seu círculo.

### Dica
O representante legal da família não pode ser excluído — proteção do cadastro principal.

### Se der erro

- Duplicata (mesmo nome/telefone na família) → mensagem impedindo segundo cadastro igual.
- Sem código de família → solicite à secretaria antes de adicionar integrantes.

---

## 12.3 Trilha de Discipulado e Perfil Ministerial

### Objetivo
Avançar nos **5 passos** da Trilha (3 lições por passo), conquistar **selos coloridos** e, na lição **5.1 — Descobrindo meus Dons**, responder o questionário de **50 perguntas** (10 etapas de 5) para ver o **perfil ministerial predominante**.

### Caminho
**Perfil & Identidade** → **Trilha de Discipulado**.

### Os 5 passos e as cores dos selos

| Passo | Tema | Cor do selo |
|:-----:|------|-------------|
| 1 | Boas-Vindas e Identidade da Igreja | Azul céu / turquesa |
| 2 | O Fundamento da Fé | Verde esmeralda |
| 3 | O Passo da Fé (Batismo) | Azul royal / profundo |
| 4 | Comunhão e Pertença | Laranja / âmbar |
| 5 | Servindo com Propósito | Dourado / bronze |

Ao concluir **100% da Trilha**, você recebe o **selo dourado final** e a liderança é avisada para certificado ou reconhecimento público.

### Passo a passo — Trilha

1. Toque em **Trilha de Discipulado**.
2. Veja **Minhas Conquistas / Selos**: selos desbloqueados nas cores acima; futuros em cinza.
3. Abra a próxima lição disponível (as anteriores precisam estar concluídas).
4. Leia o conteúdo; se houver vídeo, use **Assistir vídeo** (opcional — não bloqueia a conclusão).
5. Se a lição pedir reflexão, escreva pelo menos 3 caracteres.
6. Toque em **Concluir lição** (o botão fica fixo no rodapé do modal).
7. Ao fechar um passo inteiro, celebramos o selo daquele passo.

### Passo a passo — Perfil Ministerial (lição 5.1)

1. Na lição **Descobrindo meus Dons**, toque em **Perfil Ministerial**.
2. Leia a introdução e toque em **Começar questionário**.
3. Em cada etapa, responda as 5 perguntas e avance com **Próxima etapa**.
4. Na última etapa, toque em **Finalizar**.
5. Volte à lição e toque em **Concluir lição** (o app exige o questionário preenchido).
6. Se desejar, use **Refazer questionário** no resultado.

### Resultado esperado

- Progresso sequencial, selos coloridos na galeria e celebração ao concluir cada passo.
- Na 5.1: perfil predominante entre **Pregação**, **Discipulado**, **Pastoral**, **Evangelismo**, **Liderança** ou **Louvor**.
- Ao fechar a trilha: selo dourado + notificação pastoral para certificado.
- Ao **refazer** o questionário e finalizar de novo, o resultado anterior é **substituído**.

### Se der erro

- «Lição não encontrada nesta igreja» — confirme a **igreja ativa** na sessão e reabra a Trilha.
- Mensagem pedindo scripts SQL — a equipe TI deve executar os scripts `discipleship-trail-*.sql` e `ministerial-profile-questionnaire*.sql`.

---

## 12.4 Selfie biométrica

### Objetivo
Registrar ou atualizar a foto de rosto usada na identificação do membro.

### Caminho
**Perfil & Identidade** → **Dados Cadastrais** → seção de selfie.

### Passo a passo

1. Abra **Dados Cadastrais**.
2. Atualize **selfie** com **Tirar Selfie** ou **Atualizar Selfie**.

### Ilustração — Selfie biométrica

![Selfie biométrica — captura anotada](docs/manual-painel/screens/17-selfie-biometrica.png)

| Ref. | Elemento indicado na imagem |
|:----:|------------------------------|
| ① | Botão **Tirar Selfie** / **Atualizar Selfie** |
| ② | Área de pré-visualização da foto |
| ③ | Atalho **LGPD** (se pendente) |
| ④ | Resumo do membro (**Maurício de Freitas**) |



### Resultado esperado

- Selfie exibida no perfil; botão **LGPD** visível apenas com módulo ativo e pendência.

---

# Encerramento — Sair com segurança

### Objetivo
Encerrar a sessão no aparelho (essencial em celular compartilhado).

### Caminho
**Índice** → rodapé → **Encerrar sessão** (web) ou **Sair do aplicativo** (celular).

### Resultado esperado

- Volta à tela **Boas-vindas**; próximo uso exige celular e senha novamente.
- Dados de login removidos do aparelho.

---

## Resumo — o que você deve conseguir após este manual

| Necessidade | Onde ver no app |
|-------------|-----------------|
| Vagas do culto | Agenda → copo **Vagas** + número entre parênteses |
| Filho aceito na sala | SALA(S) → **✓** ao lado do nome |
| Pedido pastoral acompanhado | Coração Aberto → **Meus pedidos** → status **Acolher / Apoiar / Acompanhar** |
| Quem está de escala hoje | Escalas → tipo → data de hoje na lista |
| Incluir família no meu círculo | Perfil & Identidade → **Gerenciar Família** → adicionar + checkbox ✓ |
| Descobrir perfil ministerial | Perfil & Identidade → **Trilha de Discipulado** → 5.1 **Descobrindo meus Dons** → questionário |
| Ver selos da Trilha | Perfil & Identidade → **Trilha de Discipulado** → **Minhas Conquistas / Selos** |
| Ofertar via PIX | Dízimos e Ofertas → **Copiar chave PIX** |
| Check-in no culto | Agenda (audiência) + QR no dia do evento |

---

*App IBN · Igreja Batista Norte · Manual do Painel v2026-07-30*


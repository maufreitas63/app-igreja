<div class="cover">

<p class="cover-kicker">Documento comercial institucional</p>

# Análise de Telas e Menus da Plataforma Digital da Igreja

<p class="cover-sub">
Leitura comercial de cada tela e menu do aplicativo, com o valor que entrega na jornada da família, a conexão com os demais módulos e a visão simultânea de quem usa e de quem administra.
</p>

<p class="cover-meta">
<strong>Solução:</strong> ecossistema app-igreja (PWA + mobile)<br>
<strong>Público:</strong> liderança, secretaria, pastoral, tesouraria e operação<br>
<strong>Base:</strong> código-fonte, rotas Expo Router, menu lateral, Índice, Painel e Manutenção<br>
<strong>Data:</strong> 28 de agosto de 2026<br>
<strong>Revisão:</strong> atualização comercial desde 26 de agosto — células, contribuições, escalas, menu do membro e leitura financeira
</p>

</div>

## 1. Apresentação institucional

A plataforma concentra, em um único aplicativo, o que a igreja precisa para receber pessoas, cuidar de famílias, conduzir cultos e prestar contas com transparência. O membro encontra autonomia no celular. A equipe encontra controle, trilha de auditoria e eficiência operacional — sem duplicar planilhas e grupos de WhatsApp como sistema oficial.

Há três camadas visíveis:

1. **Entrada e confiança** — login, cadastro, LGPD, escolha da igreja e encerramento seguro da sessão.
2. **Vida da família** — Índice, Painel, Perfil, eventos, ofertas, pastoral, células, campanhas, voluntariado, financeiro de leitura e escalas.
3. **Operação e governança** — totem, salas, manutenção, papéis, relatórios, instâncias e assinatura.

Cada tela abaixo segue o mesmo roteiro: título, valor comercial, propósito técnico e as duas perspectivas (usuário final e administração).

## 2. Mapa da jornada

| Momento | Telas-chave | Resultado para a igreja |
|---|---|---|
| Chegar | Login, cadastro, recuperar senha, selecionar igreja, LGPD | Identidade única, sem fila de senha improvisada |
| Orientar-se | Índice, menu lateral, Painel, caixa de avisos | Atalhos claros; o que a pessoa pode ver já vem filtrado por papel |
| Participar | Agenda, QR, salas, totem | Presença confirmada, crianças localizadas, culto fluindo |
| Cuidar | Pastoral, agenda pastoral, aniversariantes, membros, mapa, células | Cuidado pastoral, célula com datas reais e vínculo sem exposição indevida |
| Contribuir | Eu quero… / Contribuir, Dízimos e Ofertas, campanhas | PIX Copia e Cola com o valor; campanha identificada sem misturar com o dízimo |
| Servir | Escalas, troca pontual, mural de vagas, estacionamento | Escala visível, substituição combinada e dons reconhecidos |
| Governar | Manutenção, ACL, papéis, transferência, igrejas, billing | Controle institucional com rastreio |

---

# Parte A — Acesso e onboarding

<div class="screen">

## Login

<p class="route">Rota <code>/</code> · tela pública</p>

### Descrição comercial

É a porta da casa digital. A igreja deixa de depender de “manda o link no grupo” e passa a reconhecer cada pessoa pelo celular e por uma senha de quatro dígitos. Primeira entrada e recuperação seguem e-mail — canal auditável, sem misturar WhatsApp com autenticação. No totem, o aparelho do culto entra com fluxo próprio, para o quiosque nunca se parecer com o celular de um membro.

### Propósito e conexões

Valida telefone + PIN no servidor (`verificar_login`), restaura sessão, oferece biometria no aparelho nativo (atalho, sem substituir o PIN) e encaminha conforme o estado do perfil: Índice, cadastro incompleto, LGPD pendente ou totem. Liga-se a `/register`, `/forgot-password`, `/selecionar-igreja`, LGPD e `cel_totem`.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Entrada rápida, com o próprio celular. Quem já cadastrou biometria desbloqueia o app sem redigitar a senha toda vez, mas continua podendo usar o PIN.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Sessão rastreável, PIN no servidor, totem isolado e primeiro acesso controlado por e-mail. Reduz senha compartilhada e aparelho “logado como outra pessoa”.
</div>
</div>
</div>

<div class="screen">

## Cadastro inicial

<p class="route">Rota <code>/register</code></p>

### Descrição comercial

Transforma o visitante em pessoa conhecida pela igreja: nome, nascimento, telefone e endereço. Quando a igreja ativa LGPD, o cadastro inclui selfie e aceite dos termos — base jurídica e visual para a carteirinha e o totem. Quando desativa, o fluxo fica enxuto, sem fricção desnecessária.

### Propósito e conexões

Completa o perfil após o primeiro PIN. Reserva código de família, sincroniza endereço por CEP e, com `LGPD_Ativo = sim`, exige selfie e termos. Conecta-se a `/lgpd`, Dados Cadastrais e Recepção Familiar.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
A pessoa se apresenta uma vez e passa a existir na comunidade digital, sem preencher papel na porta.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Cadastro padronizado, família já identificada e opção institucional de exigir ou não LGPD/selfie.
</div>
</div>
</div>

<div class="screen">

## Recuperação de senha

<p class="route">Rota <code>/forgot-password</code></p>

### Descrição comercial

Evita o “perdi a senha, me coloca de novo”. A pessoa responde a pergunta de segurança e recebe um novo PIN no e-mail. A igreja não improvisa reset por conversa paralela.

### Propósito e conexões

Abre-se no passo 2 do login. Gera PIN temporário por e-mail e devolve ao fluxo de autenticação. WhatsApp permanece fora da autenticação.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Recupera o acesso sozinha, no mesmo canal em que recebeu o primeiro PIN.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Menos atendimento de TI na porta do culto e trilha de envio por e-mail.
</div>
</div>
</div>

<div class="screen">

## Selecionar igreja

<p class="route">Rota <code>/selecionar-igreja</code></p>

### Descrição comercial

A plataforma atende mais de uma instância. Esta tela deixa explícito em qual igreja a pessoa está entrando — logo, nome e identidade visual corretos — sem misturar dados de congregações distintas.

### Propósito e conexões

Resolve o `tenant_id` da sessão, carrega branding e parâmetros da instância (prefixo familiar, PIX, totem). Alimenta Índice, ofertas, carteirinha e billing.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Vê a própria igreja, com a marca que reconhece, e não um app genérico.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Isolamento por igreja: membros, finanças e eventos não vazam entre instâncias.
</div>
</div>
</div>

<div class="screen">

## Termos LGPD

<p class="route">Rota <code>/lgpd</code></p>

### Descrição comercial

É o momento em que a igreja demonstra respeito ao dado pessoal. A pessoa lê, rola até o fim e registra aceite ou recusa. Não é um checkbox escondido: é um rito de confiança.

### Propósito e conexões

Trava a rolagem antes do aceite, grava o registro no banco e libera ou bloqueia o restante do app conforme `LGPD_Ativo`. Integra-se ao cadastro, ao alerta vermelho no Painel e ao Controle de Acesso.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Sabe o que a igreja faz com seus dados e decide com clareza.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Comprova aceite, reduz risco jurídico e pode desligar a exigência quando a política da igreja for outra.
</div>
</div>
</div>

<div class="screen">

## Sessão encerrada

<p class="route">Rota <code>/sessao-encerrada</code></p>

### Descrição comercial

Fecha o ciclo com dignidade: a pessoa saiu, o aparelho não ficou “aberto”. Em celular emprestado ou totem, isso é proteção pastoral e operacional.

### Propósito e conexões

Recebe o logout (`clearUserSession`), limpa perfil e token e devolve ao login. Disparada por Encerrar sessão / Sair do aplicativo.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Confirmação clara de que saiu. Na próxima abertura, começa do login.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Aparelho compartilhado não permanece autenticado. Histórico de acesso registra a saída.
</div>
</div>
</div>

<div class="screen">

## Cadastro familiar público

<p class="route">Rota pública <code>/cadastro-familia/</code> (Vite standalone)</p>

### Descrição comercial

Permite que uma família se apresente antes mesmo de ter login — útil em campanhas, recepção e primeiros cultos. A secretaria depois decide gravar ou rejeitar o pedido, em lote.

### Propósito e conexões

Formulário sem autenticação; a fila entra em **Recepção Familiar** na manutenção. Evita cadastro improvisado em papel.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
A família se cadastra pelo link, no próprio ritmo, sem depender de alguém “lançar no sistema”.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Fila única de acolhimento, com aceite ou recusa institucional — não um amontoado de prints.
</div>
</div>
</div>

---

# Parte B — Navegação principal

<div class="screen">

## Índice do Aplicativo

<p class="route">Rota <code>/(tabs)</code> · tela inicial autenticada</p>

### Descrição comercial

É o “saguão”. Depois do login, a pessoa vê atalhos para a vida da igreja e, no rodapé, o convite **Eu quero…**. O primeiro item é **Contribuir** — subtítulo *Dízimos, Ofertas, Campanhas ou Projetos.* — e se abre em duas opções: **Dízimos e Ofertas** (*Informe o valor, com centavos, e copie o Pix.*) e **Campanhas e Projetos** (*Informe o valor e copie o Pix já identificado.*). Ao lado, **Fazer um pedido de Oração**. Sem caçar item no menu. A faixa de avisos e próximos eventos concentra comunicados, lembretes pastorais, trocas de escala e marcos de campanha. O recorte da tela acompanha o aparelho: as margens laterais crescem com a largura, alinhadas ao chrome superior, para o conteúdo não “flutuar” nem estourar no celular ou no monitor.

### Propósito e conexões

Distribui etiquetas na altura da tela (`indexShortcutHints`). Cada toque abre o Painel no card correspondente (`dashboardCard`). **Eu quero… → Contribuir** reúne Dízimos e Ofertas e Campanhas e Projetos; o pedido de oração abre o Coração Aberto. Rodapé de sessão: Encerrar sessão. Engrenagem de manutenção à direita, só com permissão. Marca d’água da instância. A caixa de avisos recarrega em tempo real e não repete o mesmo recado já visto. **Fechar** em telas de conteúdo devolve ao Índice; só Encerrar sessão limpa o aparelho.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Encontra o que precisa em um toque, com linguagem de igreja. Contribui ou pede oração sem sair do saguão. Vê o recado do culto e o próximo evento sem procurar.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Atalhos respeitam ACL. Quem não deve ver Financeiro ou Membros simplesmente não recebe o botão. Dízimo e campanha não disputam espaço no menu do membro: nascem do mesmo “Contribuir”.
</div>
</div>
</div>

<div class="screen">

## Menu lateral

<p class="route">Componente <code>AppDrawer</code> · ícone de três linhas</p>

### Descrição comercial

É o corredor interno da plataforma, separado com clareza. Na parte de cima, só a vida do membro: Início, Perfil, Dados cadastrais, Família, Reembolsos, Financeiro, Coração Aberto, Trilha de Discipulado, Minha Célula, Escalas, Mural de Oportunidades, Sugestões e Redes Sociais. Dízimos e Campanhas não aparecem aqui: já estão em **Eu quero… → Contribuir**. A engrenagem concentra a gestão em cinco grupos que começam recolhidos — Operação e Segurança, Gestão de Pessoas, Culto e Eventos, Finanças e Inteligência, Governança e TI. O título abre a lista. Quem não tem o papel nem vê o item — e a URL administrativa não entrega a ferramenta ao membro comum.

### Propósito e conexões

Itens em `lib/appDrawerMenu.ts`, filtrados por papel, com redirecionamento fail-closed. Navega para rotas próprias ou para o carrossel da Manutenção. Configurações em `AppDrawerSettings`, nos cinco grupos acima.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Um menu estável, curto, com o que aquela pessoa realmente vive na igreja. Contribuição não compete com Perfil e Célula na mesma lista.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
A equipe entra nos módulos pela engrenagem, já agrupados. O membro comum não “descobre” a manutenção digitando o endereço da tela.
</div>
</div>
</div>

<div class="screen">

## Painel (carrossel de cards)

<p class="route">Rota <code>/(tabs)/dashboard</code></p>

### Descrição comercial

É o “culto operacional” no bolso: um card por vez, deslizando, com o mesmo recorte visual da igreja. A família agenda presença, gera QR, vê salas, contribui, pede oração, encontra irmãos, consulta aniversários, lê o financeiro, confere a escala, encontra a célula, acompanha campanhas e vê vagas alinhadas ao próprio perfil ministerial — sem abrir dez aplicativos.

### Propósito e conexões

Carrossel com ACL `dashboard.card.*`. Inclui células (`small_group`), campanhas (`campaign_card`) e mural (`opportunity_mural_card`). No modo da família, o card preenche a coluna útil da tela (título, textos e botões na mesma largura). Rodapé `‹` `›` e Menu. Telas filhas devolvem ao card de origem via `returnDashboardCard`. Paletas em `dashboardCardThemes`.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Experiência contínua, com saudação pelo nome e retorno exatamente ao card de onde saiu.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Módulos ligados ou desligados por papel e por regra de evento (QR só no dia, estacionamento só se ativo).
</div>
</div>
</div>

<div class="screen">

## Encerrar sessão (diálogo)

<p class="route">Índice / totem · <code>confirmExitApplication</code></p>

### Descrição comercial

O botão de saída não é um “voltar” qualquer. Pede confirmação — “Deseja encerrar sua sessão?” — para não deslogar por toque acidental e para lembrar que sair limpa o aparelho.

### Propósito e conexões

Intercepta voltar do navegador no Índice (`AppBackHandler`). Distingue Encerrar sessão (web) de Sair do aplicativo (PWA instalado / nativo). O **Fechar** de Ofertas, Pastoral, Célula e demais conteúdos devolve ao Índice — não dispara este diálogo.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Sai quando quer, com aviso claro. Não perde a sessão ao apenas fechar uma tela de conteúdo.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Logout consciente em aparelhos do templo e em navegadores compartilhados.
</div>
</div>
</div>

---

# Parte C — Módulos da vida da família

<div class="screen">

## Agenda da Família

<p class="route">Card do Painel · painel <code>FamilyAgendaModal</code></p>

### Descrição comercial

É o “vamos no culto?” digital. A família escolhe o evento, vê vagas e marca quem vai — cônjuge, filhos, congregados do núcleo. Esse pré-check-in é o passaporte para QR, geofence e salas infantis.

### Propósito e conexões

Lista eventos ativos, capacidade e inscrição por membro (`FamilyRegistrationList`). Conecta-se a Check-in, Totem, SALA(S) e Programação de Eventos. Fechar retorna ao Índice/Painel.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
A família decide juntas, no sofá, quem estará presente — sem fila na portaria.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Audiência previsível, capacidade respeitada e base para presença, kids e ofertas do culto.
</div>
</div>
</div>

<div class="screen">

## Check-in / QR Code

<p class="route">Card do Painel · carteirinha também em <code>/perfil</code></p>

### Descrição comercial

No dia do evento, a família apresenta um QR. No totem, a leitura confirma presença. Não é um QR genérico da igreja: é o código daquela família (ex.: `IBN0001`), o mesmo texto abaixo do código na carteirinha. Quem já fez o pré-check-in e entra na área do templo pode ser confirmado automaticamente por geolocalização.

### Propósito e conexões

Visível no dia do evento, após audiência quando o culto exige. Geofence retoma a confirmação depois do pré-check-in. Quórum trava após um check-in. O payload do QR é só o código familiar, sem dados pessoais.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Chega, mostra o celular, entra. Sem papel, sem “qual o seu nome mesmo?”.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Presença objetiva, sem duplo check-in, com trilha para lista de presença e salas.
</div>
</div>
</div>

<div class="screen">

## SALA(S) — Kids e Teens

<p class="route">Card do Painel (família) · Manutenção (equipe)</p>

### Descrição comercial

Pais precisam saber se a criança já entrou na sala. O card do membro mostra só a própria família. A equipe, na manutenção, vê todas as inscrições e marca a entrada.

### Propósito e conexões

Inscrição nasce na Agenda quando o evento tem Kids/Teens. Check-in de sala é staff. WhatsApp do responsável após entrada.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Tranquilidade: o pai vê o status da criança da sua casa, e só dela.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Controle de entrada, contato imediato com o responsável e visão completa do andar infantil.
</div>
</div>
</div>

<div class="screen">

## Dízimos e Ofertas

<p class="route">Rota <code>/ofertas</code> · card do Painel · atalho <code>Eu quero… → Contribuir</code></p>

### Descrição comercial

A contribuição deixa de ser um constrangimento de “como eu pago?”. Em **Dízimos e Ofertas**, a pessoa vê os dados do recebedor e a chave, informa o valor **com centavos** — a máscara preenche da direita para a esquerda, como no banco (1 vira R$ 0,01) — e toca em **Copiar chave PIX**. O app gera o **Pix Copia e Cola** já com o montante; basta colar no banco. O botão **Limpar**, na mesma linha do valor, zera o digitado sem perder a chave. Em **Campanhas e Projetos**, o valor é em reais inteiros; os **centavos de identificação** entram sozinhos. A tela mostra o QR e o botão **Copiar Chave Pix**. Mesmo gesto de contribuir, destinos distintos — e o Fechar volta ao Índice, sem encerrar a sessão.

### Propósito e conexões

Carrega dados da instância (`loadOfferingsRecipientBundle`). Independente da flag de ofertas do evento. O Pix Copia e Cola é aceito pelo aplicativo do banco (payload no padrão EMV). Fechar volta ao Índice.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Digita R$ 150,00 (ou R$ 0,50), toca em copiar, cola no banco. Não pede chave no corredor e não precisa “lembrar os centavos”.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Chave oficial única, atualizável. O extrato chega com o valor que a pessoa digitou, sem grupo paralelo de PIX.
</div>
</div>
</div>

<div class="screen">

## Coração Aberto (pedido pastoral)

<p class="route">Rota <code>/pastoral</code></p>

### Descrição comercial

É o confessionário digital com dignidade: motivo, situação, para quem é o pedido e se vai para sigilo pastoral ou intercessão. A pessoa é ouvida sem precisar interceptar o pastor no pátio. Na mesma jornada, agenda um horário de atendimento quando a pastoral abre vagas.

### Propósito e conexões

Categorias no banco; envio vinculado ao perfil da sessão. Histórico em `/pastoral-history`. Equipe trata em **Cuidado Pastoral**. Horários em `pastoral_slots`. Fechar → Índice.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Pede oração com privacidade, escolhendo o grau de sigilo, e marca o atendimento sem ligar para a secretaria.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Fila pastoral organizada, com motivo, destino e agenda — em vez de recados perdidos.
</div>
</div>
</div>

<div class="screen">

## Meus pedidos pastorais

<p class="route">Rota <code>/pastoral-history</code></p>

### Descrição comercial

Devolve à pessoa a memória do cuidado: o que pediu, o status, o acompanhamento. Cuidado pastoral deixa de ser um envio sem eco.

### Propósito e conexões

Lista pedidos do perfil logado, com pull-to-refresh. Espelha o painel staff de Cuidado Pastoral.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Acompanha o próprio pedido sem ligar para a secretaria.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Transparência de status reduz retrabalho e “será que chegou?”.
</div>
</div>
</div>

<div class="screen">

## Agenda de atendimento pastoral

<p class="route">Painel pastoral · <code>PastoralSchedulePanel</code></p>

### Descrição comercial

A pastoral abre janelas de atendimento; o membro escolhe tipo, pastor e horário. Lembretes chegam cerca de duas horas antes — para os dois lados da mesa.

### Propósito e conexões

Slots isolados por igreja, ACL e avisos (`pastoral_slot_notices`). Gestão na manutenção. Integra-se ao Coração Aberto.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Marca o horário como marca uma consulta: vê o que está livre e recebe o aviso.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Agenda pastoral sem planilha, com isolamento por igreja e lembrete automático.
</div>
</div>
</div>

<div class="screen">

## Lista de Membros

<p class="route">Rota <code>/membros</code> · card do Painel</p>

### Descrição comercial

A comunidade se enxerga: nome, família, WhatsApp, GPS. Alterna membros e visitantes. O ícone da família abre o núcleo. O mapa geral posiciona a igreja no território — com detalhe de endereço só para quem pastoralmente deve vê-lo.

### Propósito e conexões

Busca, modal de família, WhatsApp e `/mapa-geolocalizacao`. ACL no detalhe do pin.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Encontra o irmão, manda um Zap, percebe-se parte de um corpo.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Visão de membros vs visitantes, com proteção de endereço no mapa.
</div>
</div>
</div>

<div class="screen">

## Aniversariantes

<p class="route">Rota <code>/aniversariantes</code></p>

### Descrição comercial

A igreja não esquece o aniversário. Filtro por mês e WhatsApp na hora — cuidado simples que constrói vínculo.

### Propósito e conexões

Lê perfis com data de nascimento; atalho de mensagem. Sem dados extras além do necessário para cumprimentar.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
A comunidade lembra da data; a pessoa se sente vista.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Pastoral e recepção têm lista mensal pronta, sem planilha paralela.
</div>
</div>
</div>

<div class="screen">

## Financeiro (leitura)

<p class="route">Rota <code>/financial</code></p>

### Descrição comercial

Presta contas com linguagem de boletim, não de ERP: resultado do mês, comparativo, 12 meses, planejado × realizado e saldo bancário. O resumo de **ENTRADAS** e **SAÍDAS** usa a mesma paleta da competência em destaque, para o olho não “trocar de relatório” no meio da leitura. A confiança na tesouraria cresce quando o membro lê o mesmo número que a diretoria.

### Propósito e conexões

Hub do card Financeiro. RD em `/expense-report`. Carga e conciliação na manutenção. ACL `dashboard.card.financial`. Campanhas têm tela e Pix próprios — não entram no bloco ordinário do boletim.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Entende para onde foi a oferta, em linguagem clara, mês a mês.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Uma fonte da verdade. Versões REALIZADO e PLANEJADO coexistem sem misturar. Campanhas não distorcem o ordinário.
</div>
</div>
</div>

<div class="screen">

## Relatório de Despesas (RD)

<p class="route">Rota <code>/expense-report</code></p>

### Descrição comercial

Quem gastou pela igreja registra itens, comprovantes e PIX de reembolso, submete e avisa o tesoureiro no WhatsApp. Acaba o envelope de notinhas.

### Propósito e conexões

Membro cria, lista e exclui pendentes. Tesouraria concilia na manutenção. Contato em `Tesoureiro_contato`. Acesso exige sessão.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Pede reembolso com comprovante, sem perder o papel na bolsa.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Fila de RD, vínculo ao lançamento e rastreio do mês de emissão vs conciliação.
</div>
</div>
</div>

<div class="screen">

## Escalas

<p class="route">Rota <code>/escalas</code></p>

### Descrição comercial

O servo vê quando serve e com quem. A igreja deixa de anunciar escala só no grupo, onde a mensagem some. **Solicitar troca** aparece na entrada de Escalas e no Painel, nas datas em que a pessoa está escalada — inclusive intercessão e estacionamento. O pedido reconhece nome composto. Quando o tipo de escala permite, o servo escolhe o substituto da mesma equipe; o WhatsApp já sai com ministério, data e motivo.

### Propósito e conexões

Leitura dos tipos, datas e WhatsApp. Troca via `scale_swap_requests` (pedido, aceite, recusa, desfazer se o substituto ainda está na linha). Manutenção gera ciclo em bloco (`aplicar_ciclo_escala`). Estacionamento cruza placa.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Sabe o domingo em que está de pé, fala com o parceiro e, se precisar, combina a troca no próprio app — sem redigitar o contexto no Zap.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Ciclo justo, vagas por domingo e trocas rastreadas — sem escala “presa” em pedido pendente. A lista de substitutos reconhece o servo mesmo com nome composto.
</div>
</div>
</div>

<div class="screen">

## Servos em escala e Estacionamento

<p class="route">Cards condicionais do Painel</p>

### Descrição comercial

No dia, a lista de quem está servindo e o estacionamento por placa aceleram a operação: achar o dono do carro, chamar o servo, destravar o pátio.

### Propósito e conexões

Aparecem quando há escala/painel ativos. Placa + WhatsApp. Tipos e voluntários na manutenção.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Quem serve se reconhece; quem estacionou é encontrado com respeito.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Operação de culto com nomes e placas, não com grito no microfone.
</div>
</div>
</div>

<div class="screen">

## Pequeno grupo (célula)

<p class="route">Card do Painel <code>small_group</code> · menu <code>Minha Célula</code></p>

### Descrição comercial

A célula deixa de viver só no WhatsApp. Quem ainda não tem grupo vê os **anfitriões mais próximos da residência**, da menor para a maior distância: nome, grupo, bairro, dia e horário da reunião, quantos já estão inscritos e, dentro de cada card, **Quero participar deste grupo**. Sem CEP no perfil, o app pede o cadastro para calcular a distância. Quem já pertence à célula vê as **datas reais** das reuniões (não um único “toda quarta”), líder, anfitrião e endereço oficial — sem atalho para Maps ou Waze. A linha de participantes (ex.: *3 participantes*) abre o modal **Participantes**, só com os nomes completos e um **Fechar**. Em seguida: **Roteiro da Semana**, **Avisar Ausência** (WhatsApp do líder) e, se não for anfitrião nem líder, **Quero sair deste grupo**. O título **Pequeno Grupo** aparece uma vez, no corpo da tela. Título, cards e botões acompanham a largura do aparelho.

### Propósito e conexões

Card do dashboard e item **Minha Célula** no menu. Distância a partir do CEP do perfil. Inscrição e saída pedem confirmação no celular e no navegador. Roteiro lido no modal; gestão em **Gestão de Pequenos Grupos**.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Encontra a célula perto de casa, entra com um toque, vê quem mais participa, lê o estudo e avisa se faltar — tudo no mesmo recorte da carteirinha.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
A rede cresce por proximidade, não por recado no grupo. Presença, visitantes e relatório continuam na gestão.
</div>
</div>
</div>

<div class="screen">

## Campanhas e projetos

<p class="route">Card do Painel <code>campaign_card</code> · atalho <code>Eu quero… → Contribuir</code></p>

### Descrição comercial

A campanha de construção, missão ou projeto especial ganha meta, progresso, capa e PIX — sem misturar com o dízimo do mês. O membro acompanha o termômetro e contribui pelo mesmo **Contribuir** da tela inicial, ou pelo **Contribuir Agora** no card. Informa o valor em reais inteiros; os **centavos de identificação** combinados com a tesouraria entram sozinhos. A tela mostra o QR e o Pix Copia e Cola já identificado, para o depósito aparecer no extrato como daquela campanha.

### Propósito e conexões

Campanhas ativas no card; gestão na manutenção. Conciliação isolada da receita ordinária — o boletim de leitura não mistura os dois fluxos. Avisos de marco na caixa da home. Se houver uma campanha só, o atalho abre direto nela; se houver várias, a pessoa escolhe. Sem campanha ativa, o app avisa com clareza.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Vê a meta, o quanto já entrou e copia o Pix já identificado — sem perguntar “é o PIX da obra ou o do dízimo?”.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Projeto com meta financeira, doadores únicos e conciliação que não contamina o boletim ordinário.
</div>
</div>
</div>

<div class="screen">

## Mural de Oportunidades

<p class="route">Card do Painel <code>opportunity_mural_card</code></p>

### Descrição comercial

Depois da Lição 5.1 (Perfil Ministerial), a igreja convida a servir no ministério certo — sem expor o perfil dos outros no mural do membro. A liderança busca quem casa com a vaga e convida; o membro manifesta interesse e fala com o líder no WhatsApp.

### Propósito e conexões

Match com `ministerial_resultados`. Mural do membro não lista dons alheios. Gestão em **Mural de Voluntários**. Aviso pode ser só para quem tem o perfil compatível.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Vê vagas alinhadas aos próprios dons e diz “tenho interesse” sem se candidatar a tudo.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Busca ativa privada, interesse reabrível após recusa e convite pela liderança — sem vitrine de perfis.
</div>
</div>
</div>

---

# Parte D — Identidade, família e discipulado

<div class="screen">

## Perfil & Identidade

<p class="route">Rota <code>/perfil</code> · card <code>grouped_manage</code></p>

### Descrição comercial

É a identidade digital da pessoa na igreja: dados cadastrais, família, trilha de discipulado e carteirinha. Um único lugar para “quem eu sou aqui”.

### Propósito e conexões

`PerfilClassPanel` abre Dados Cadastrais, Gerenciar Família, Trilha e Carteirinha Digital, conforme ACL. Paleta de cores no rodapé do card.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Atualiza a própria vida na igreja sem pedir à secretaria para “mudar o telefone”.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Campos visíveis/editáveis por papel. Onboarding incompleto é visível e corrigível.
</div>
</div>
</div>

<div class="screen">

## Dados cadastrais

<p class="route">Rota <code>/manage-profile</code></p>

### Descrição comercial

Nome, documentos, endereço em seções que abrem só se a pessoa precisar — como o acordeão de Endereço. Senha de quatro dígitos e biometria (no celular) ficam aqui, com o PIN sempre como base.

### Propósito e conexões

Seções recolhíveis (`ProfileClass`). CEP sincroniza endereço. ACL por coluna. Selfie e veículos. Vínculo à família.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Edita o que é seu, sem uma ficha infinita na cara. Endereço completo só aparece quando ela abre a caixa.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Cadastro vivo, CEP consistente, CPF/PIN protegidos por ACL.
</div>
</div>
</div>

<div class="screen">

## Gerenciar família

<p class="route">Rota <code>/manage-members</code></p>

### Descrição comercial

O núcleo familiar deixa de ser “mais ou menos aquelas pessoas”. Inclui, reconhece, transfere e protege o representante legal. Endereço do gestor pode herdar para o membro aceito.

### Propósito e conexões

CRUD em `members`, busca por telefone/nome, RPC de aceite. Indicadores Kids/Teens. Liga-se à Agenda e ao QR familiar.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
A família se vê completa no app — filhos, cônjuge, parentesco.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Um código familiar, sem duplicata e com rastreio de transferência entre núcleos.
</div>
</div>
</div>

<div class="screen">

## Carteirinha Digital

<p class="route">Dentro de <code>/perfil</code> · <code>DigitalIDCard</code></p>

### Descrição comercial

Duas páginas: quem a pessoa é (foto 30% maior, nome, nascimento, telefone, e-mail, endereço em caixa recolhida) e o QR de check-in. O grupo familiar não aparece na frente — o código vive no QR (`IBN0001`), para o totem, não para exposição social.

### Propósito e conexões

Dados do perfil da sessão. QR = código familiar normalizado. Página 2: status Membro/Congregado e data de entrada no app.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Uma identidade digna para apresentar no culto, com foto grande e dados pessoais sob controle.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Check-in familiar padronizado; QR sem vazamento de telefone, endereço ou token.
</div>
</div>
</div>

<div class="screen">

## Trilha de Discipulado

<p class="route">Rota <code>/trilha-discipulado</code></p>

### Descrição comercial

A igreja acompanha formação, não só frequência. Cinco passos, três lições cada, selos coloridos e, na 5.1, o Perfil Ministerial (50 perguntas). A pessoa vê conquista; a pastoral vê quem parou no caminho. O resultado da 5.1 alimenta o mural de vagas.

### Propósito e conexões

Progresso no servidor (`upsert_my_discipleship_lesson_progress`). Alertas e certificado. Manutenção: Temas, Reconhecimentos, Reset. Match com o Mural de Oportunidades.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Caminha com clareza, coleciona selos e descobre dons no momento certo.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Conteúdo da trilha editável, alertas pastorais e reset responsável — sem planilha de progresso.
</div>
</div>
</div>

---

# Parte E — Comunidade, documentos e comunicação

<div class="screen">

## Mapa de geolocalização

<p class="route">Rota <code>/mapa-geolocalizacao</code></p>

### Descrição comercial

Mostra a igreja no território: pins por CEP, filtros (todos, com papel, visitantes). O detalhe do endereço de outra pessoa só abre para quem a política de acesso autoriza.

### Propósito e conexões

Leaflet no PWA, geocodificação e cache. Recurso ACL `/mapa-geolocalizacao/detalhe-pin`. Nativo informa uso via PWA.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Vê a dispersão da comunidade, sem expor a casa de ninguém indevidamente.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Pastoral e super administrador enxergam o detalhe; demais veem o mapa. CEPs inválidos são auditáveis.
</div>
</div>
</div>

<div class="screen">

## Administrativo

<p class="route">Rota <code>/administrativo</code></p>

### Descrição comercial

Documentos constitutivos e atas à mão: a igreja transparente para quem deve ler o institucional, sem mandar PDF por e-mail a cada pergunta.

### Propósito e conexões

Lista atas, abre PDF no visualizador do app (`AssemblyMinutesPdfModal`). Fechar permanece na jornada autenticada.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Consulta a vida jurídica da igreja quando precisa, no próprio celular.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Repositório único de atas, com publicação controlada.
</div>
</div>
</div>

<div class="screen">

## Redes sociais

<p class="route">Rota <code>/redes-sociais</code></p>

### Descrição comercial

Instagram, YouTube e demais canais oficiais da instância — a voz da igreja em um lugar, não em cartaz desatualizado. Também pode ser usada no culto, como atalho público aos canais.

### Propósito e conexões

Lê cadastro da igreja (`/igrejas`). Login também pode exibir atalhos no passo do celular.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Encontra o canal certo, o oficial, em um toque.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
URLs centralizadas por instância; troca uma vez, vale no app inteiro.
</div>
</div>
</div>

<div class="screen">

## Avisos e Manutenção de Avisos

<p class="route">Rota <code>/avisos</code> · painel <code>event_orchestration</code></p>

### Descrição comercial

O recado do culto chega a quem está no app, no tempo certo, sem depender só do projetor. O orquestrador escolhe o público: todos, líderes de célula ou só quem tem o perfil compatível com uma vaga.

### Propósito e conexões

Leitura pública via RPC filtrada (`listar_event_avisos_publicados`). Gestão no orquestrador, com sessão amarrada ao ator. Avisos restritos não vazam no acesso direto à tabela.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Não perde o comunicado se chegou depois do anúncio ao vivo. Vagas e células não aparecem para quem não é o público.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Comunicado versionado, por audiência e instância, com dono editorial.
</div>
</div>
</div>

<div class="screen">

## Autorização de imagem e voz

<p class="route">Rotas <code>/autorizacao-midia</code> e <code>/autorizacao-midia-confirmar</code></p>

### Descrição comercial

Transmissões e fotos de culto exigem consentimento. Esta tela registra a autorização — e o link de confirmação por e-mail fecha o ciclo mesmo fora da sessão plena.

### Propósito e conexões

Menu de configurações. Confirmação por token de e-mail permanece aberta; demais acessos exigem sessão. Relaciona-se a LGPD e ao cadastro.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Decide sobre o próprio rosto e a própria voz na mídia da igreja.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Base de consentimento para equipe de mídia, auditável.
</div>
</div>
</div>

<div class="screen">

## Sugestões e melhorias

<p class="route">Rota <code>/suggestions-improvements</code></p>

### Descrição comercial

A igreja escuta. O membro envia ideia ou problema; a equipe lê o catálogo na manutenção e no relatório dedicado.

### Propósito e conexões

Formulário autenticado; painel staff e relatório analítico.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Fala com a liderança sem precisar de um “amigo que conhece o pastor”.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Backlog visível, priorizável, sem recados perdidos no WhatsApp da secretaria.
</div>
</div>
</div>

---

# Parte F — Operação no templo

<div class="screen">

## Totem de check-in

<p class="route">Rota <code>/totem-checkin</code></p>

### Descrição comercial

O aparelho da portaria existe para um gesto só: ler o QR da família e confirmar quem já estava na audiência. Não é um computador de secretaria. Encerrar sessão no totem é rotina de fim de culto.

### Propósito e conexões

Câmera, lookup por código familiar, RPC de confirmação, cooldown anti-duplo (limpo ao sair da tela). Login dedicado (`cel_totem` + PIN 9999).

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Apresenta a carteirinha, ouve o “confirmado”, segue para o templo.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Fila rápida, presença oficial, aparelho que não vaza sessão de membro.
</div>
</div>
</div>

<div class="screen">

## Configuração de salas

<p class="route">Rota <code>/configuracao-salas</code></p>

### Descrição comercial

Define como Kids e Teens existem nesta igreja: rótulos, habilitação, operação. Sem isso, o card SALA(S) seria um enfeite.

### Propósito e conexões

Engrenagem do menu. Alimenta eventos (`enabled_room_keys`) e o monitor de salas.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Vê nomes de sala que a igreja realmente usa (Infantil, Jovens, etc.).
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Parametriza a operação infantil por instância, sem código novo a cada igreja.
</div>
</div>
</div>

---

# Parte G — Administração e manutenção

Os itens abaixo aparecem no menu após a linha divisória e no carrossel `/maintenance-dashboard`, conforme o papel.

<div class="screen">

## Programação de Eventos

<p class="route">Painel <code>events</code></p>

### Descrição comercial

O calendário oficial: criar, publicar, capacidade, totem, quórum, geofence, salas, ofertas. O culto deixa de ser um post e vira um objeto de operação. O seletor de datas (mês, dia, OK) é o mesmo da **Gestão de Pequenos Grupos** — a liderança não aprende dois calendários.

### Propósito e conexões

CRUD em `events`. Dispara Agenda, QR, salas, presença e avisos. Locais favoritos alimentam geofence.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Só vê eventos publicados, com data e vaga reais.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Um editor para o culto inteiro: portaria, kids, ofertas e presença.
</div>
</div>
</div>

<div class="screen">

## Cronograma de Eventos (Gantt)

<p class="route">Painel <code>events_gantt</code></p>

### Descrição comercial

Visão no tempo — dia e mês — para a liderança enxergar sobrecarga e vazios. Toque edita o evento.

### Propósito e conexões

Leitura temporal da mesma base de Programação de Eventos.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Indireta: a programação fica mais coerente na Agenda.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Planejamento visual, menos choque de horários e de equipes.
</div>
</div>
</div>

<div class="screen">

## Sala(s) — Check-in (manutenção)

<p class="route">Painel <code>sala_servidor</code></p>

### Descrição comercial

A equipe do andar marca entrada de cada criança inscrita. É o crachá digital da sala.

### Propósito e conexões

Lista todas as inscrições do evento (sem filtro de família). WhatsApp do responsável.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
O status no card da família atualiza quando a equipe confirma a entrada.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Controle tático no culto, com contato imediato.
</div>
</div>
</div>

<div class="screen">

## Tipos de escala, Servos e Programação de Escalas

<p class="route">Painéis <code>scale_types</code>, <code>scale_volunteers</code>, <code>scales</code></p>

### Descrição comercial

Três peças de um único relógio: o tipo (louvor, recepção, som), quem está disponível e o ciclo gerado. A igreja para de “combinar no privado”. O tipo pode autorizar troca autônoma entre servos.

### Propósito e conexões

Vagas por domingo, modo individual/equipe, preview transacional `aplicar_ciclo_escala`. Alimenta o card Escalas do membro e o fluxo de troca pontual.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Recebe uma escala previsível e justa, com possibilidade de substituição combinada.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Geração em bloco, ordem sequencial, alerta ao remover servo com datas futuras e força de troca pela liderança quando preciso.
</div>
</div>
</div>

<div class="screen">

## Cuidado Pastoral (equipe)

<p class="route">Painel <code>pastoral_care</code></p>

### Descrição comercial

A fila sagrada: pedidos do Coração Aberto chegam aqui para o pastor e a intercessão tratarem com método, sem perder sigilo. A agenda de horários da pastoral também se opera daqui.

### Propósito e conexões

Gestão dos envios de `/pastoral`. Status visível em Meus pedidos. Slots de atendimento por igreja.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Sabe que o pedido não caiu no vazio e que o horário marcado vale.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Distribuição de cuidado, priorização, registro ministerial e agenda.
</div>
</div>
</div>

<div class="screen">

## Gestão de Pequenos Grupos

<p class="route">Painel <code>small_groups_management</code> · engrenagem</p>

### Descrição comercial

A célula deixa de ser “toda quarta às 19h30” congelada no cadastro. Quem tem acesso abre o **mesmo calendário da Programação de Eventos** (título *Datas das reuniões*), toca nos dias de interesse e define **horário próprio para cada data** (HH:MM). A busca de anfitrião, líder e participante filtra de verdade por nome ou celular — não devolve uma lista alfabética incompleta. O celular do visitante usa a máscara da igreja, `(11) 98765-4321`, e o nome vai para a fila de Recepção Familiar. O **Roteiro da semana** pode ser escrito na hora (título, conteúdo e link ou PDF opcional) e publicado com **Publicar roteiro**; os temas da Trilha continuam só como atalho opcional. A **Chamada** escolhe a data no calendário e lista o **nome completo** de cada participante com caixa de seleção de presença. **Excluir grupo** pede confirmação: apaga o cadastro da célula, a lista e as chamadas; anfitrião e líder **permanecem** na igreja. Relatório espiritual (oração e notas pastorais) segue para o cuidado pastoral com **Enviar ao cuidado pastoral**.

### Propósito e conexões

Tabelas `small_groups`, reuniões (`small_group_meetings`), membros e presença. Card **Minha Célula** do membro. Visitante vai para a fila de Recepção Familiar. Relatório espiritual (oração e notas pastorais) segue para o cuidado pastoral. Avisos podem ir só a líderes de célula.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Vê as datas em que a célula realmente se reúne, quem mais participa e o estudo daquela semana.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Rede de células com calendário vivo, chamada objetiva, busca que encontra a pessoa e exclusão que não apaga o irmão do rol da igreja.
</div>
</div>
</div>

<div class="screen">

## Gestão de Campanhas

<p class="route">Painel <code>campaigns_management</code></p>

### Descrição comercial

A tesouraria e a liderança abrem campanha com meta, prazo, capa e **centavos simbólicos de referência** (ex.: 60 vira 0,60 no Pix). O Pix Copia e Cola do membro recebe esse sufixo sozinho; o depósito é reconhecido e fica fora da receita ordinária. O painel mostra desempenho: percentual da meta, doadores únicos, velocidade por dia e os centavos em uso.

### Propósito e conexões

`campaign_projects`, conciliação em `financials` isolada do ordinário. Card do dashboard e atalho **Eu quero… → Contribuir**. O boletim financeiro de leitura não mistura campanha com dízimo.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Acompanha o projeto da igreja com números oficiais.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Campanha com meta, progresso e conciliação auditável, sem misturar com dízimo.
</div>
</div>
</div>

<div class="screen">

## Mural de Voluntários (manutenção)

<p class="route">Painel <code>volunteer_mural</code></p>

### Descrição comercial

A liderança cadastra a vaga, os dons exigidos e o líder de contato. A busca ativa lista pessoas compatíveis — para convite, não para exposição pública.

### Propósito e conexões

`volunteer_opportunities`. Match com a Lição 5.1. Interesse pendente/aceito/recusado. Aviso de vaga pode ir só a quem casa.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Recebe convite pertinente; o mural comum não mostra o perfil dos outros.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Recrutamento ministerial com critério, WhatsApp do líder e lista sem duplicata.
</div>
</div>
</div>

<div class="screen">

## Temas, Reconhecimentos e Reset da Trilha

<p class="route">Painéis <code>discipleship_*</code> · engrenagem</p>

### Descrição comercial

A trilha é conteúdo vivo. Temas se editam, reconhecimentos alertam a pastoral, o reset existe para recomeçar com critério — não para apagar formação por acidente.

### Propósito e conexões

Alimenta `/trilha-discipulado` e o Perfil Ministerial. Grants específicos.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Estuda o material atual da igreja, com selos que significam algo.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Currículo discipulador sob governança, com alertas e reset auditável.
</div>
</div>
</div>

<div class="screen">

## Informações Financeiras (manutenção)

<p class="route">Painel <code>financials</code></p>

### Descrição comercial

A tesouraria importa CSV, escolhe REALIZADO ou PLANEJADO, esvazia mês com escopo e concilia RD. O boletim que o membro lê nasce daqui.

### Propósito e conexões

Carga, accordion de seções, RD do mês, desconciliação. Alimenta `/financial`.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Números confiáveis no card Financeiro.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Operação de tesouraria com versão orçamentária explícita e rastro de RD.
</div>
</div>
</div>

<div class="screen">

## Modelo preditivo

<p class="route">Painel <code>predictive_insights</code></p>

### Descrição comercial

Projeta receita ordinária (dízimos e ofertas) com base no realizado. A diretoria planeja com evidência, não só com esperança.

### Propósito e conexões

Modelo em `financialPredictiveModel`. Exige histórico mínimo de meses positivos.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Indireta: orçamento da igreja mais responsável.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Insight quantitativo para conselho e tesouraria.
</div>
</div>
</div>

<div class="screen">

## Relatórios

<p class="route">Painel <code>relatorios</code></p>

### Descrição comercial

Olhares analíticos: membros ativos/inativos, necessidades pastorais, saúde infantil (LGPD), quórum, estacionamento, sugestões, inscritos por evento. Sem relatório de faixa etária — decisão consciente de privacidade.

### Propósito e conexões

Catálogo da manutenção. Papéis pastoral/super administrador conforme o relatório.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Benefício indireto: decisões da igreja baseadas em fato, com menos exposição etária.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Painel de gestão sem exportar a igreja inteira para uma planilha solta.
</div>
</div>
</div>

<div class="screen">

## Lista de Presença (quórum)

<p class="route">Painel <code>quorum_presence</code></p>

### Descrição comercial

Quando o evento exige quórum, esta é a ata viva: quem confirmou no totem, a que horas, pronta para impressão.

### Propósito e conexões

Atualiza após check-in. Flag `requer_quorum` no evento.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
O check-in da família conta de verdade para a assembleia.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Documento de presença, não lista de WhatsApp.
</div>
</div>
</div>

<div class="screen">

## Cadastro de Usuário

<p class="route">Painel <code>profile_cadastro</code> · super administrador</p>

### Descrição comercial

Correção cirúrgica: buscar pessoa, ajustar CEP/endereço, em último caso excluir perfil. Poder alto, uso raro, responsabilidade máxima.

### Propósito e conexões

Busca em `profiles`. Exclusão completa restrita. Complementa Mudança de Papéis.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Erros de cadastro se resolvem sem a pessoa “criar outra conta”.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Higiene cadastral com trilha, não edição clandestina no banco.
</div>
</div>
</div>

<div class="screen">

## Recepção Familiar

<p class="route">Painel <code>family_reception</code></p>

### Descrição comercial

A porta de entrada institucional da fila pública `/cadastro-familia/`. Gravar ou rejeitar em lote é acolher com processo.

### Propósito e conexões

Fila do formulário standalone. Gera família/perfil oficiais.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
O cadastro feito no link vira gente de verdade na igreja.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Acolhimento com aceite formal, sem planilha de “pendentes da recepção”.
</div>
</div>
</div>

<div class="screen">

## Controle de Acesso

<p class="route">Painel <code>access_control</code></p>

### Descrição comercial

O coração da governança: papéis, grants, visão por papel ou por recurso. O Gestor de Controle de Acesso não vê o Super Administrador — escudo explícito. LGPD da instância liga/desliga aqui.

### Propósito e conexões

RPCs SECURITY DEFINER amarradas à sessão do ator, matriz de grants, `assert_gestor_super_admin_shield`. Afeta todas as telas.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Vê só o que lhe cabe — e isso é cuidado, não restrição vazia.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
ACL auditável, fail-closed, sem o gestor enxergar o super administrador.
</div>
</div>
</div>

<div class="screen">

## Mudança de Papéis

<p class="route">Painel <code>mudanca_papeis</code></p>

### Descrição comercial

Visitante, congregado, membro: a caminhada eclesial vira dado oficial, com contagem de ativos e herança familiar.

### Propósito e conexões

Pastoral e super administrador. Integra-se à Lista de Membros, carteirinha (status) e limites de billing.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
O reconhecimento da igreja (membro/congregado) aparece na carteirinha.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Métricas de membresia reais, não estimativa de lista de presença.
</div>
</div>
</div>

<div class="screen">

## Transferência de Membro

<p class="route">Painel <code>transferencia_igreja</code></p>

### Descrição comercial

Quando a família muda de congregação no mesmo ecossistema, o cadastro não se duplica. A igreja de destino solicita; a origem aprova; o vínculo e o grupo familiar seguem para a nova casa.

### Propósito e conexões

Mesmo `profiles.id`; telefone e CPF permanecem únicos. Pedido pastoral na origem. Isolamento por `igrejas` / `profile_igreja_vinculos`.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Continua a mesma pessoa na plataforma, agora na igreja nova, sem recadastrar a vida inteira.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Transferência formal entre instâncias, sem clone de perfil e sem perder o histórico da família.
</div>
</div>
</div>

<div class="screen">

## Acessos de Usuários

<p class="route">Painel <code>profile_access_insights</code></p>

### Descrição comercial

Quem entrou, quando, quais telas. Transparência de uso para a liderança responsável — recortada à igreja da sessão. Limpeza global só no super administrador.

### Propósito e conexões

Histórico de sessão. Gestor não vê registros do Super Administrador. Estatísticas não atravessam igrejas.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Indireta: a igreja cuida do acesso sem vigiar a vida privada além do necessário.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Auditoria de login e navegação, com recorte de segurança entre papéis e instâncias.
</div>
</div>
</div>

<div class="screen">

## Instâncias (Igrejas)

<p class="route">Rota <code>/igrejas</code> · super administrador</p>

### Descrição comercial

O ecossistema multi-igreja: logo, redes, CNPJ de ofertas, código da entidade. Cada casa tem cara e PIX próprios.

### Propósito e conexões

Tenancy, branding, prefixo familiar (`Parm_entidade`), ofertas. Engrenagem do menu.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Vive a identidade da sua congregação.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Operar várias igrejas sem misturar cadastro, marca e tesouraria.
</div>
</div>
</div>

<div class="screen">

## Assinaturas (Billing)

<p class="route">Rota <code>/billing</code></p>

### Descrição comercial

A sustentabilidade da plataforma: planos com **cobrança trimestral**, limite de membros e checkout Stripe em modo teste/produção conforme ambiente. A igreja escolhe o plano com números de ativos à vista. A tela exige sessão.

### Propósito e conexões

`BillingClass`, Functions Stripe, `assert_tenant_can_add_member`. Isolamento por `tenant_id`. Gate de acesso na rota.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Indireta: o app da igreja permanece disponível e dimensionado.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Contrato SaaS visível, com teto de membresia alinhado ao plano e ciclo trimestral no Stripe.
</div>
</div>
</div>

<div class="screen">

## Orquestrador (admin)

<p class="route">Rota <code>/admin/orquestrador</code></p>

### Descrição comercial

Console avançado de orquestração de eventos e avisos para operação de alto volume — o “mesa de controle” quando o culto é complexo.

### Propósito e conexões

Complementa Manutenção de Avisos e Programação de Eventos. RPCs de gravação exigem que o ator seja a sessão autenticada.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Recebe a programação certa, no tempo certo.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Coordenação central de fluxos de evento sem editar registro por registro na pressa.
</div>
</div>
</div>

---

# Parte H — Síntese comercial

A plataforma não é um conjunto de telas soltas. É uma **jornada**:

1. A pessoa **entra com identidade** (login, PIN, opcionalmente biometria).
2. **Reconhece a própria igreja** (instância, marca, PIX).
3. **Participa com a família** (agenda, QR só com código familiar, salas).
4. **Cuidado e serviço** (pastoral, células com datas reais, escalas com troca, mural, RD, ofertas e campanhas pelo mesmo Contribuir).
5. A equipe **governa** (ACL, papéis, transferência, relatórios, tesouraria).

O valor para o membro é autonomia e dignidade. O valor para a administração é controle com rastreio, menos WhatsApp como sistema e um único lugar em que o culto, a família e a prestação de contas se encontram.

Este documento descreve o produto como ele está no código em **28 de agosto de 2026**. Telas condicionais (QR, estacionamento, servos, manutenção) aparecem somente quando o papel, o evento e os parâmetros da instância autorizam — e isso, em si, já é parte da proposta comercial: **cada pessoa vê a igreja que lhe cabe viver**.

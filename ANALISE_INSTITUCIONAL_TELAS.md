<div class="cover">

<p class="cover-kicker">Documento comercial institucional</p>

# Análise de Telas e Menus da Plataforma Digital da Igreja

<p class="cover-sub">
Leitura comercial de cada tela e menu do aplicativo, com o valor que entrega na jornada da família, a conexão com os demais módulos, a visão simultânea de quem usa e de quem administra, e o significado de cada botão, texto interativo e resultado exibido.
</p>

<p class="cover-meta">
<strong>Solução:</strong> ecossistema app-igreja (PWA + mobile)<br>
<strong>Público:</strong> liderança, secretaria, pastoral, tesouraria e operação<br>
<strong>Base:</strong> código-fonte, rotas Expo Router, menu lateral, Índice, Painel e Manutenção<br>
<strong>Data:</strong> 25 de agosto de 2026
</p>

</div>

## 1. Apresentação institucional

A plataforma concentra, em um único aplicativo, o que a igreja precisa para receber pessoas, cuidar de famílias, conduzir cultos e prestar contas com transparência. O membro encontra autonomia no celular. A equipe encontra controle, trilha de auditoria e eficiência operacional — sem duplicar planilhas e grupos de WhatsApp como sistema oficial.

Há três camadas visíveis:

1. **Entrada e confiança** — login, cadastro, LGPD, escolha da igreja e encerramento seguro da sessão.
2. **Vida da família** — Índice, Painel, Perfil, eventos, ofertas, pastoral, financeiro de leitura e escalas.
3. **Operação e governança** — totem, salas, manutenção, papéis, relatórios, instâncias e assinatura.

Cada tela abaixo segue o mesmo roteiro: título, valor comercial, propósito técnico, **controles interativos** (botões, campos, abas e selos), **o que os resultados representam** e as duas perspectivas (usuário final e administração). Onde a tela usa o padrão visual da plataforma, o título centralizado em azul-escuro (informativo de tela) identifica o módulo — o mesmo recurso visto em Administrativo, Sugestões e Melhorias, Programação de Eventos, Cronograma, Lista de Presença e Transferência de Membro.

## 2. Mapa da jornada

| Momento | Telas-chave | Resultado para a igreja |
|---|---|---|
| Chegar | Login, cadastro, recuperar senha, selecionar igreja, LGPD | Identidade única, sem fila de senha improvisada |
| Orientar-se | Índice, menu lateral, Painel | Atalhos claros; o que a pessoa pode ver já vem filtrado por papel |
| Participar | Agenda, QR, salas, totem | Presença confirmada, crianças localizadas, culto fluindo |
| Cuidar | Pastoral, aniversariantes, membros, mapa | Cuidado pastoral e vínculo sem exposição indevida |
| Contribuir | Ofertas, financeiro, RD | PIX imediato e prestação de contas legível |
| Servir | Escalas, estacionamento, administrativo | Escala visível e documentos à mão |
| Governar | Manutenção, ACL, Ghost, igrejas, billing, **Transferência de Membro** | Controle institucional com rastreio; saída e entrada entre instâncias sem duplicar cadastro |

---

# Parte A — Acesso e onboarding

<div class="screen">

## Login

<p class="route">Rota <code>/</code> · tela pública</p>

### Descrição comercial

É a porta da casa digital. A igreja deixa de depender de “manda o link no grupo” e passa a reconhecer cada pessoa pelo celular e por uma senha de quatro dígitos. Primeira entrada e recuperação seguem e-mail — canal auditável, sem misturar WhatsApp com autenticação. No totem, o aparelho do culto entra com fluxo próprio, para o quiosque nunca se parecer com o celular de um membro.

### Propósito e conexões

Valida telefone + PIN no servidor (`verificar_login`), restaura sessão, oferece biometria no aparelho nativo (atalho, sem substituir o PIN) e encaminha conforme o estado do perfil: Índice, cadastro incompleto, LGPD pendente ou totem. Liga-se a `/register`, `/forgot-password`, `/selecionar-igreja`, LGPD e `cel_totem`.

### Controles interativos

| Controle | Tipo | O que faz |
|---|---|---|
| Campo **Instância** | Texto | Identifica a igreja (código ou nome). A validação confirma que aquela instância existe e carrega logo, cores e parâmetros. |
| **X** no campo da instância | Botão | **Só apaga o texto digitado.** Não troca de igreja nem limpa a sessão. |
| **Alterar instância** | Botão | Encerra a instância já validada, esvazia o campo e devolve o foco para escolher outra igreja. Use este controle — e não o X — quando a pessoa entrou na instância errada. |
| Campo **Celular** | Telefone | Identidade de login. Formato brasileiro; o servidor reconhece o perfil pelo número. |
| **X** no celular | Botão | Limpa apenas o número, sem sair da instância. |
| Campo **PIN** (4 dígitos) | Senha | Autentica no servidor. Não substitui a biometria: a biometria só desbloqueia o aparelho depois que o PIN já foi cadastrado. |
| **Entrar** | Botão principal | Dispara `verificar_login`. Em sucesso, segue para Índice, cadastro, LGPD ou totem. |
| **Primeiro acesso** | Link | Abre o cadastro (`/register`) para quem ainda não tem PIN. |
| **Esqueci a senha** | Link | Abre recuperação por pergunta de segurança e e-mail. |
| **Atalhos de redes** (quando a instância cadastrou URLs) | Ícones | Abrem o canal oficial daquela igreja, sem misturar marcas. |

### O que os resultados representam

| Resultado | Significado |
|---|---|
| Logo e nome da igreja após validar a instância | A sessão já está amarrada àquele `tenant`; dados de outra congregação não entram. |
| Mensagem de telefone ou PIN inválido | O servidor recusou a combinação; não há “usuário genérico”. |
| Avanço silencioso para o Índice | Perfil completo, LGPD em dia (ou desligada) e sessão gravada. |
| Encaminhamento ao cadastro ou à LGPD | Falta dado obrigatório ou aceite; o app não libera a vida da família até isso. |

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

### Controles interativos

| Controle | Tipo | O que faz |
|---|---|---|
| Campos **Nome**, **Nascimento**, **Celular** | Texto/data/telefone | Identidade mínima da pessoa. Sem eles o cadastro não avança. |
| Campo **CEP da residência** | Texto | Dispara busca de logradouro; o endereço oficial nasce daqui, não de digitação livre. |
| **Selfie** (quando LGPD ativa) | Câmera/arquivo | Foto biométrica para carteirinha e totem. Sem ela o fluxo LGPD não fecha. |
| **Continuar** | Botão principal | Grava o perfil e segue: Índice (LGPD desligada) ou termos (LGPD ligada). |
| Aceite de termos (se exigido) | Confirmação | Só libera o restante do app depois do rito em `/lgpd`. |

### O que os resultados representam

| Resultado | Significado |
|---|---|
| Endereço preenchido após o CEP | O servidor reconheceu o CEP; o cadastro está georreferenciável. |
| Aviso para preencher nome/nascimento/CEP | Faltam dados obrigatórios; a igreja ainda não tem ficha válida. |
| Encaminhamento à LGPD | A instância exige aceite; o Índice ainda não está liberado. |

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

Evita o “perdi a senha, me coloca de novo”. A pessoa responde a pergunta de segurança e recebe um novo PIN no e-mail. A igreja não improvisar reset por conversa paralela.

### Propósito e conexões

Abre-se no passo 2 do login. Gera PIN temporário por e-mail e devolve ao fluxo de autenticação. WhatsApp permanece fora da autenticação.

### Controles interativos

| Controle | Tipo | O que faz |
|---|---|---|
| Campo **Celular** | Telefone | Localiza o perfil que pediu o reset. |
| **Pergunta de segurança** + resposta | Desafio | Confirma que quem pede o PIN é a pessoa cadastrada. |
| **Enviar novo PIN** | Botão | Gera senha temporária e dispara e-mail. |
| Voltar ao login | Link | Devolve à porta de entrada sem alterar a instância. |

### O que os resultados representam

| Resultado | Significado |
|---|---|
| Mensagem de e-mail enviado | O PIN novo já saiu pelo canal auditável; a pessoa ainda precisa entrar com ele. |
| Resposta de segurança recusada | O reset não ocorre; evita troca de senha por terceiros. |

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

### Controles interativos

| Controle | Tipo | O que faz |
|---|---|---|
| Lista / cartões de igreja | Toque | Escolhe a instância da sessão (logo, nome, cores). |
| Confirmar igreja | Botão | Grava o `tenant_id` e carrega parâmetros (prefixo familiar, PIX, totem). |
| Voltar | Navegação | Retorna ao login sem misturar congregações. |

### O que os resultados representam

| Resultado | Significado |
|---|---|
| Logo e paleta da igreja | A sessão já está isolada naquela casa. |
| Igreja ausente da lista | A pessoa não tem vínculo ali, ou a instância não está publicada. |

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

### Controles interativos

| Controle | Tipo | O que faz |
|---|---|---|
| Texto dos termos | Rolagem | Precisa ir até o fim; o aceite não libera sem leitura. |
| **Aceito os termos** | Botão | Grava o aceite com data/hora e libera o Índice. |
| **Recuso** | Botão | Bloqueia o restante do app enquanto a instância exigir LGPD. |

### O que os resultados representam

| Resultado | Significado |
|---|---|
| Botões ainda bloqueados | A pessoa ainda não rolou o documento até o fim. |
| Alerta vermelho no Painel | Há pendência de LGPD; a jornada da família está incompleta. |
| Tela pulada | `LGPD_Ativo` está desligado nesta igreja (chip no Controle de Acesso). |

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

### Controles interativos

| Controle | Tipo | O que faz |
|---|---|---|
| Mensagem de sessão encerrada | Leitura | Confirma que perfil e token saíram do aparelho. |
| Voltar ao login | Botão/atalho | Abre `/` para nova autenticação. |

### O que os resultados representam

| Resultado | Significado |
|---|---|
| Esta tela após “Encerrar sessão” | Logout consciente; o histórico de acesso registra a saída. |
| Login vazio na sequência | Não há sessão residual no navegador ou no totem. |

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

### Controles interativos

| Controle | Tipo | O que faz |
|---|---|---|
| Dados do informante | Campos | Quem preenche o pedido (telefone, nome, parentesco). |
| Incluir outros membros | Botões/linhas | Adiciona cônjuge, filhos e demais do núcleo. |
| **Enviar cadastro** | Botão | Coloca o lote na fila da **Recepção Familiar**; ainda não cria `profiles` oficiais. |

### O que os resultados representam

| Resultado | Significado |
|---|---|
| Confirmação de envio | A secretaria verá o lote; a família ainda não está “no sistema” até gravar. |
| Pedido invisível no app autenticado | Esperado: só a manutenção processa a fila. |

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

É o “saguão”. Depois do login, a pessoa vê atalhos coloridos para Agenda, Salas, QR, Ofertas, Pastoral, Membros, Aniversariantes, Financeiro, Escalas e Perfil. Nada de labirinto: o que está disponível aparece; o que não cabe naquele dia (QR fora do culto, salas sem evento) fica explicado, não quebrado.

### Propósito e conexões

Distribui etiquetas na altura da tela (`indexShortcutHints`). Cada toque abre o Painel no card correspondente (`dashboardCard`). Rodapé: Encerrar sessão; engrenagem de manutenção à direita, se houver permissão. Marca d’água da instância.

### Controles interativos

| Controle | Tipo | O que faz |
|---|---|---|
| Atalhos coloridos (Agenda, Salas, QR, Ofertas, Pastoral, Membros, Aniversariantes, Financeiro, Escalas, Perfil) | Botões | Abrem o Painel já no card daquele módulo. Só aparecem se o papel tiver grant e a regra do dia permitir. |
| Texto de hint no atalho | Leitura | Explica por que QR ou salas estão indisponíveis naquele momento (fora do culto, sem evento). |
| **Encerrar sessão** | Botão (rodapé) | Abre o diálogo de logout consciente. |
| **Engrenagem** | Botão | Entra na manutenção, se o papel tiver permissão. |
| Marca d’água da instância | Identidade | Lembra em qual igreja a sessão está. |

### O que os resultados representam

| Resultado | Significado |
|---|---|
| Atalho ausente | ACL: a pessoa não deve usar aquele módulo. |
| QR cinza / hint | Não é dia de evento com check-in, ou falta audiência. |
| Engrenagem invisível | Não há grant de manutenção. |

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Encontra o que precisa em um toque, com linguagem de igreja, não de sistema.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Atalhos respeitam ACL. Quem não deve ver Financeiro ou Membros simplesmente não recebe o botão.
</div>
</div>
</div>

<div class="screen">

## Menu lateral

<p class="route">Componente <code>AppDrawer</code> · ícone de três linhas</p>

### Descrição comercial

É o corredor interno da plataforma. Na parte de cima, a vida do membro (Início, Perfil, Financeiro, Escalas, Aniversariantes, Lista de Membros, Administrativo). Depois da linha, a operação da igreja (eventos, salas, escalas, pastoral, finanças, relatórios, papéis, **Transferência de Membro**, Ghost). A engrenagem abre configurações finas: trilha, salas, avisos, igrejas, assinaturas e autorização de imagem.

### Propósito e conexões

Itens em `lib/appDrawerMenu.ts`, filtrados por papel. Navega para rotas próprias ou para o carrossel da Manutenção (`maintenance-dashboard` + painel). Configurações em `AppDrawerSettings`.

### Controles interativos

| Controle | Tipo | O que faz |
|---|---|---|
| Ícone de **três linhas** | Botão | Abre o menu sobre a tela atual, sem perder o contexto. |
| Itens acima da linha | Links | Jornada do membro/família. Só aparecem se o papel tiver grant. |
| Itens abaixo da linha | Links | Operação (manutenção). **Transferência de Membro** abre o painel pastoral de entrada/saída entre igrejas. |
| **Engrenagem** | Botão | Ajustes da instância (trilha, salas, avisos, igrejas, billing, mídia). |
| Toque fora / fechar | Gesto | Recolhe o menu. |

### O que os resultados representam

| Resultado | Significado |
|---|---|
| Item ausente | A pessoa não tem permissão — não é falha de tela. |
| Menu mais curto no totem | O quiosque não deve parecer o celular de um membro. |

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Um menu estável, sempre no mesmo lugar, com o que aquela pessoa realmente pode usar.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
A equipe entra nos módulos de gestão sem misturar com a jornada do membro. Super admin vê instâncias e billing.
</div>
</div>
</div>

<div class="screen">

## Painel (carrossel de cards)

<p class="route">Rota <code>/(tabs)/dashboard</code></p>

### Descrição comercial

É o “culto operacional” no bolso: um card por vez, deslizando, com o mesmo recorte visual da igreja. A família agenda presença, gera QR, vê salas, contribui, pede oração, encontra irmãos, consulta aniversários, lê o financeiro e confere a escala — sem abrir dez aplicativos.

### Propósito e conexões

Carrossel com ACL `dashboard.card.*`. Rodapé `‹` `›` e Menu. Telas filhas devolvem ao card de origem via `returnDashboardCard`. Paletas em `dashboardCardThemes`.

### Controles interativos

| Controle | Tipo | O que faz |
|---|---|---|
| Card atual (deslize) | Gesto | Troca o módulo visível (Agenda, QR, Ofertas, etc.). |
| **‹** / **›** | Botões do rodapé | Navegam para o card anterior ou seguinte, no mesmo recorte visual. |
| **Menu** | Botão | Abre o Índice sem perder a sessão. |
| Botões internos de cada card | Ações | Abrem a tela filha (ex.: ver PIX, abrir carteirinha). O Fechar dessas telas devolve **a este card**, não ao login. |
| Saudação pelo nome | Texto | Identidade efetiva (inclui Modo Ghost). |

### O que os resultados representam

| Resultado | Significado |
|---|---|
| Card que não aparece no carrossel | Grant `dashboard.card.*` desligado ou regra de evento (estacionamento, QR). |
| Retorno ao mesmo card após Fechar | A jornada é contínua; Fechar ≠ Encerrar sessão. |

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

Intercepta voltar do navegador no Índice (`AppBackHandler`). Distingue Encerrar sessão (web) de Sair do aplicativo (PWA instalado / nativo). Não deve ser disparado pelo Fechar de Ofertas ou Pastoral: esses voltam ao Índice.

### Controles interativos

| Controle | Tipo | O que faz |
|---|---|---|
| Texto **Deseja encerrar sua sessão?** | Confirmação | Evita logout por toque acidental. |
| **Encerrar sessão** / **Sair do aplicativo** | Botão de confirmar | Limpa perfil e token; vai para `/sessao-encerrada`. No PWA/nativo o rótulo deixa claro que o app fecha a sessão no aparelho. |
| **Cancelar** | Botão | Fecha o diálogo; a pessoa continua autenticada. |

### O que os resultados representam

| Resultado | Significado |
|---|---|
| Diálogo após o botão do Índice | Logout consciente. |
| Diálogo **não** aparece ao Fechar Ofertas/Pastoral | Correto: Fechar volta à jornada, não desloga. |

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

### Controles interativos

| Controle | Tipo | O que faz |
|---|---|---|
| Lista de eventos | Toque | Escolhe o culto/atividade para marcar presença. |
| Caixas por membro da família | Seleção | Diz quem vai (cônjuge, filhos, congregados do núcleo). |
| **Confirmar inscrição** / gravar | Botão | Reserva vaga e gera o pré-check-in usado no QR e nas salas. |
| **Fechar** | Botão | Volta ao Painel/Índice sem encerrar a sessão. |

### O que os resultados representam

| Resultado | Significado |
|---|---|
| Contagem de vagas | Capacidade do evento menos inscrições já feitas. |
| Membro sem caixa | Não pertence à família da sessão, ou já está inscrito em conflito. |
| Evento ausente | Não está publicado, ou a pessoa não tem grant de agenda. |

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

No dia do evento, a família apresenta um QR. No totem, a leitura confirma presença. Não é um QR genérico da igreja: é o código daquela família (ex.: `IBN0001`), o mesmo texto abaixo do código na carteirinha.

### Propósito e conexões

Visível no dia do evento, após audiência quando o culto exige. Geofence pode confirmar sem QR. Quórum trava após um check-in. O payload do QR é só o código familiar, sem dados pessoais.

### Controles interativos

| Controle | Tipo | O que faz |
|---|---|---|
| QR da família | Imagem | Payload = código familiar (ex.: `IBN0001`), o mesmo da carteirinha. O totem lê isto. |
| Código em texto abaixo do QR | Leitura | Conferência humana se a câmera falhar. |
| **Fechar** | Botão | Volta ao card do Painel. |

### O que os resultados representam

| Resultado | Significado |
|---|---|
| QR visível | Há evento no dia e (se exigido) a família já está na audiência. |
| Card/QR oculto | Fora do culto, sem inscrição, ou geofence já confirmou. |
| Check-in já feito | A lista de presença conta esta família; novo scan no totem entra em cooldown. |

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

### Controles interativos

| Controle | Tipo | O que faz |
|---|---|---|
| Lista da própria família (card do membro) | Leitura | Mostra só as crianças da casa e o status (inscrita / na sala). |
| Marcar entrada (manutenção) | Botão staff | Confirma que a criança entrou na sala e pode avisar o responsável no WhatsApp. |
| **Fechar** | Botão | Volta ao Painel. |

### O que os resultados representam

| Resultado | Significado |
|---|---|
| Criança “na sala” | Check-in de staff feito; o pai pode ficar tranquilo. |
| Lista vazia no card da família | Ninguém do núcleo está inscrito em Kids/Teens naquele evento. |
| Visão completa na manutenção | Equipe vê todas as inscrições, não só a própria casa. |

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

<p class="route">Rota <code>/ofertas</code> · card do Painel</p>

### Descrição comercial

A contribuição deixa de ser um constrangimento de “como eu pago?”. A tela mostra o recebedor da igreja e a chave PIX, com um toque para copiar. O Fechar volta ao Índice — não encerra a sessão.

### Propósito e conexões

Carrega dados da instância (`loadOfferingsRecipientBundle`). Independente da flag de ofertas do evento. PIX copiado com feedback.

### Controles interativos

| Controle | Tipo | O que faz |
|---|---|---|
| Nome do recebedor | Leitura | Identifica a igreja/CNPJ oficial da oferta. |
| Chave PIX | Texto | Valor a colar no banco. |
| **Copiar PIX** | Botão | Copia a chave e mostra confirmação. |
| **Fechar** | Botão | Volta ao Índice/Painel — **não** encerra a sessão. |

### O que os resultados representam

| Resultado | Significado |
|---|---|
| Chave visível | Parâmetro da instância; é a chave oficial, não um PIX pessoal. |
| Feedback “copiado” | O aparelho já tem a chave na área de transferência. |

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Contribui no próprio banco, na hora, sem pedir chave no corredor.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Chave oficial única, atualizável, sem grupos paralelos de PIX.
</div>
</div>
</div>

<div class="screen">

## Coração Aberto (pedido pastoral)

<p class="route">Rota <code>/pastoral</code></p>

### Descrição comercial

É o confessionário digital com dignidade: motivo, situação, para quem é o pedido e se vai para sigilo pastoral ou intercessão. A pessoa é ouvida sem precisar interceptar o pastor no pátio.

### Propósito e conexões

Categorias no banco; envio vinculado ao perfil. Histórico em `/pastoral-history`. Equipe trata em **Cuidado Pastoral**. Fechar → Índice.

### Controles interativos

| Controle | Tipo | O que faz |
|---|---|---|
| Motivo / situação | Campos | Descreve o pedido. |
| Destinatário (sigilo pastoral vs intercessão) | Escolha | Define quem vê o conteúdo na equipe. |
| **Enviar pedido** | Botão | Grava o pedido ligado ao perfil e abre a fila pastoral. |
| **Fechar** | Botão | Volta ao Índice, sem logout. |
| Atalho para **Meus pedidos** | Link | Abre o histórico pessoal. |

### O que os resultados representam

| Resultado | Significado |
|---|---|
| Confirmação de envio | O pedido entrou na fila; status inicial visível em Meus pedidos. |
| Sigilo pastoral | Só a equipe autorizada lê; não vai para intercessão aberta. |

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Pede oração com privacidade, escolhendo o grau de sigilo.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Fila pastoral organizada, com motivo e destino, em vez de recados perdidos.
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

### Controles interativos

| Controle | Tipo | O que faz |
|---|---|---|
| Lista de pedidos | Toque | Abre detalhe e status. |
| Puxar para atualizar | Gesto | Recarrega o status (em andamento, respondido). |
| Voltar | Navegação | Retorna ao Coração Aberto ou ao Painel. |

### O que os resultados representam

| Resultado | Significado |
|---|---|
| Status do pedido | Espelho do que a equipe registrou em Cuidado Pastoral. |
| Lista vazia | Nenhum pedido deste perfil, ou ainda não sincronizou. |

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

## Lista de Membros

<p class="route">Rota <code>/membros</code> · card do Painel</p>

### Descrição comercial

A comunidade se enxerga: nome, família, WhatsApp, GPS. Alterna membros e visitantes. O ícone da família abre o núcleo. O mapa geral posiciona a igreja no território — com detalhe de endereço só para quem pastoralmente deve vê-lo.

### Propósito e conexões

Busca, modal de família, WhatsApp e `/mapa-geolocalizacao`. ACL no detalhe do pin.

### Controles interativos

| Controle | Tipo | O que faz |
|---|---|---|
| Busca | Campo | Filtra por nome. |
| Alternar **Membros** / **Visitantes** | Filtro | Recorta a lista pelo papel eclesial. |
| Ícone da família | Botão | Abre o núcleo (nomes do mesmo código familiar). |
| WhatsApp | Link | Abre conversa com o número cadastrado. |
| Atalho do **mapa** | Link | Abre a geolocalização da comunidade. |

### O que os resultados representam

| Resultado | Significado |
|---|---|
| Pessoa na lista | Perfil visível nesta instância, conforme ACL. |
| Transferido / inativo ausente | Não aparece como ativo; ver Mudança de Papéis (nome vermelho). |

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

### Controles interativos

| Controle | Tipo | O que faz |
|---|---|---|
| Filtro por **mês** | Seletor | Mostra aniversariantes daquele mês. |
| WhatsApp no nome | Link | Abre mensagem de parabéns. |

### O que os resultados representam

| Resultado | Significado |
|---|---|
| Nome na lista | Há data de nascimento cadastrada e o perfil está visível nesta igreja. |
| Mês vazio | Ninguém com aniversário naquele recorte, ou cadastro sem data. |

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

Presta contas com linguagem de boletim, não de ERP: resultado do mês, comparativo, 12 meses, planejado × realizado e saldo bancário. A confiança na tesouraria cresce quando o membro lê o mesmo número que a diretoria.

### Propósito e conexões

Hub do card Financeiro. RD em `/expense-report`. Carga e conciliação na manutenção. ACL `dashboard.card.financial`.

### Controles interativos

| Controle | Tipo | O que faz |
|---|---|---|
| Resultado do mês / comparativo / 12 meses | Leitura | Prestação de contas em linguagem de boletim. |
| Planejado × realizado | Leitura | Duas visões coexistentes; não misturam na mesma coluna. |
| Saldo bancário | Leitura | Posição informada pela tesouraria. |
| Atalho **RD** | Link | Abre o Relatório de Despesas. |

### O que os resultados representam

| Resultado | Significado |
|---|---|
| Números do mês | O que a manutenção lançou e conciliou — a mesma fonte da diretoria. |
| Tela vazia / bloqueada | Sem grant `dashboard.card.financial` ou ainda sem carga. |

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Entende para onde foi a oferta, em linguagem clara, mês a mês.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Uma fonte da verdade. Versões REALIZADO e PLANEJADO coexistem sem misturar.
</div>
</div>
</div>

<div class="screen">

## Relatório de Despesas (RD)

<p class="route">Rota <code>/expense-report</code></p>

### Descrição comercial

Quem gastou pela igreja registra itens, comprovantes e PIX de reembolso, submete e avisa o tesoureiro no WhatsApp. Acaba o envelope de notinhas.

### Propósito e conexões

Membro cria, lista e exclui pendentes. Tesouraria concilia na manutenção. Contato em `Tesoureiro_contato`.

### Controles interativos

| Controle | Tipo | O que faz |
|---|---|---|
| Novo item / comprovante | Campos + anexo | Registra gasto e PIX de reembolso. |
| **Submeter** | Botão | Envia o RD e pode avisar o tesoureiro no WhatsApp. |
| Excluir pendente | Botão | Remove rascunho ainda não conciliado. |
| Lista dos próprios RDs | Leitura | Acompanha status (pendente, conciliado). |

### O que os resultados representam

| Resultado | Significado |
|---|---|
| RD pendente | Tesouraria ainda não conciliou. |
| RD conciliado | Entrou no mês financeiro oficial. |

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

O servo vê quando serve e com quem. A igreja deixa de anunciar escala só no grupo, onde a mensagem some.

### Propósito e conexões

Leitura dos tipos, datas e WhatsApp. Manutenção gera ciclo em bloco (`aplicar_ciclo_escala`). Estacionamento cruza placa.

### Controles interativos

| Controle | Tipo | O que faz |
|---|---|---|
| Lista por tipo/data | Leitura | Mostra quando a pessoa (ou a equipe) serve. |
| WhatsApp do parceiro | Link | Contato direto com quem divide a escala. |

### O que os resultados representam

| Resultado | Significado |
|---|---|
| Domingo na lista | Há vaga/ciclo aplicado na manutenção. |
| Lista vazia | Sem escala para este perfil, ou ciclo ainda não gerado. |

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Sabe o domingo em que está de pé, e fala com o parceiro de escala.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Ciclo justo (individual ou equipe), vagas por domingo e ordem sequencial.
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

### Controles interativos

| Controle | Tipo | O que faz |
|---|---|---|
| Lista de servos do dia | Leitura | Nomes de quem está de pé naquele culto. |
| Placa + WhatsApp (estacionamento) | Link | Encontra o dono do carro sem gritar no microfone. |

### O que os resultados representam

| Resultado | Significado |
|---|---|
| Cards visíveis | Evento/escala ativos e grant correspondente. |
| Cards ausentes | Fora do dia operacional, ou módulo desligado. |

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

---

# Parte D — Identidade, família e discipulado

<div class="screen">

## Perfil & Identidade

<p class="route">Rota <code>/perfil</code> · card <code>grouped_manage</code></p>

### Descrição comercial

É a identidade digital da pessoa na igreja: dados cadastrais, família, trilha de discipulado e carteirinha. Um único lugar para “quem eu sou aqui”.

### Propósito e conexões

`PerfilClassPanel` abre Dados Cadastrais, Gerenciar Família, Trilha e Carteirinha Digital, conforme ACL. Paleta de cores no rodapé do card.

### Controles interativos

| Controle | Tipo | O que faz |
|---|---|---|
| **Dados cadastrais** | Botão | Abre `/manage-profile`. |
| **Gerenciar família** | Botão | Abre `/manage-members`. |
| **Trilha de discipulado** | Botão | Abre `/trilha-discipulado`. |
| **Carteirinha digital** | Botão | Abre o documento de identidade (duas páginas). |
| Paleta no rodapé | Leitura | Identidade visual da instância. |

### O que os resultados representam

| Resultado | Significado |
|---|---|
| Botão ausente | Grant daquele submódulo desligado para o papel. |
| Nome/foto no card | Perfil efetivo (Ghost usa o alvo, não o auditor). |

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

### Controles interativos

| Controle | Tipo | O que faz |
|---|---|---|
| Seções (pessoais, documentos, endereço) | Acordeão | Abre só o bloco que a pessoa vai editar. |
| CEP | Campo | Sincroniza logradouro. |
| PIN / biometria | Segurança | Troca a senha de 4 dígitos; biometria é atalho no aparelho. |
| Selfie / veículos | Mídia | Atualiza foto e placas. |
| **Salvar** | Botão | Grava no perfil, respeitando ACL por coluna. |

### O que os resultados representam

| Resultado | Significado |
|---|---|
| Campo invisível ou só leitura | O papel não edita aquela coluna (ex.: CPF). |
| Endereço após CEP | Cadastro georreferenciável, alinhado à Recepção/Mapa. |

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

### Controles interativos

| Controle | Tipo | O que faz |
|---|---|---|
| Busca por telefone/nome | Campo | Localiza pessoa para incluir no núcleo. |
| Incluir / reconhecer / aceitar | Botões | Fecha o vínculo familiar oficial. |
| Transferir entre núcleos | Ação | Move o membro para outra família desta igreja (não é Transferência de Membro entre instâncias). |
| Indicadores Kids/Teens | Leitura | Sinaliza quem entra em sala no culto. |

### O que os resultados representam

| Resultado | Significado |
|---|---|
| Código familiar único | Todos da lista compartilham o QR de check-in. |
| Representante legal | Quem responde pelo núcleo na Agenda e na recepção. |

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

Dados do perfil efetivo (inclui Modo Ghost). QR = código familiar normalizado. Página 2: status Membro/Congregado e data de entrada no app.

### Controles interativos

| Controle | Tipo | O que faz |
|---|---|---|
| Página 1 (foto, nome, nascimento, telefone, e-mail) | Leitura | Identidade visível no culto. |
| Caixa de **endereço** | Acordeão | Endereço só aparece se a pessoa abrir — não fica exposto na frente. |
| Página 2 / virar | Gesto | Mostra QR de check-in, status eclesial e data de entrada. |
| QR | Imagem | Código familiar (`IBN0001`); o totem lê isto, não o telefone. |

### O que os resultados representam

| Resultado | Significado |
|---|---|
| Status Membro/Congregado | Papel eclesial oficial (Mudança de Papéis). |
| Data de entrada | Quando a pessoa passou a existir nesta instância do app. |
| Ausência do grupo familiar na frente | Decisão de privacidade: o código vive no QR. |

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

A igreja acompanha formação, não só frequência. Cinco passos, três lições cada, selos coloridos e, na 5.1, o Perfil Ministerial (50 perguntas). A pessoa vê conquista; a pastoral vê quem parou no caminho.

### Propósito e conexões

Progresso no servidor (`upsert_my_discipleship_lesson_progress`). Alertas e certificado. Manutenção: Temas, Reconhecimentos, Reset.

### Controles interativos

| Controle | Tipo | O que faz |
|---|---|---|
| Passos 1–5 e lições | Botões | Abre o conteúdo e registra progresso. |
| Selos coloridos | Status | Marcam lição cumprida. |
| **Perfil Ministerial** (5.1) | Questionário | 50 perguntas de dons; resultado pastoral. |
| Certificado / alerta | Leitura | Conclusão ou atraso visível para a pessoa e a pastoral. |

### O que os resultados representam

| Resultado | Significado |
|---|---|
| Selo preenchido | Lição gravada no servidor para este perfil. |
| Passo travado | Pré-requisito ainda não cumprido. |

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

### Controles interativos

| Controle | Tipo | O que faz |
|---|---|---|
| Filtros (todos, com papel, visitantes) | Chips | Recortam os pins. |
| Pin no mapa | Toque | Abre resumo; endereço completo só com ACL de detalhe. |

### O que os resultados representam

| Resultado | Significado |
|---|---|
| Pin sem endereço | Política: o papel não vê a casa de outra pessoa. |
| CEP inválido | Cadastro a corrigir (auditoria na manutenção). |

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Vê a dispersão da comunidade, sem expor a casa de ninguém indevidamente.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Pastoral e super admin enxergam o detalhe; demais veem o mapa. CEPs inválidos são auditáveis.
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

### Controles interativos

| Controle | Tipo | O que faz |
|---|---|---|
| Informativo **Administrativo** | Título de tela | Faixa centralizada em azul-escuro — padrão de identificação de módulo. |
| Chip **Atos Constitutivos** | Aba (única ativa) | Área dos documentos oficiais. |
| **Ver documentos publicados** | Botão | Abre a lista de PDFs publicados pelo financeiro. |
| Item da lista de atas | Toque | Abre o PDF na tela. |
| **Criar Relatório de Despesas (RD)** | Botão | Encaminha ao fluxo de RD. |

### O que os resultados representam

| Resultado | Significado |
|---|---|
| Lista de atas | Documentos que a tesouraria/secretaria publicou para consulta. |
| Visualizador PDF | Leitura no próprio app, sem baixar arquivo solto por e-mail. |

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

Instagram, YouTube e demais canais oficiais da instância — a voz da igreja em um lugar, não em cartaz desatualizado.

### Propósito e conexões

Lê cadastro da igreja (`/igrejas`). Login também pode exibir atalhos no passo do celular.

### Controles interativos

| Controle | Tipo | O que faz |
|---|---|---|
| Ícones / links dos canais | Botões | Abrem Instagram, YouTube e demais URLs oficiais desta instância. |

### O que os resultados representam

| Resultado | Significado |
|---|---|
| Canal ausente | A igreja não cadastrou aquela URL em Instâncias. |
| Mesmos ícones no login | Atalhos oficiais também no passo do celular, sem misturar marcas. |

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

O recado do culto chega a quem está no app, no tempo certo, sem depender só do projetor.

### Propósito e conexões

Membro lê avisos. Equipe orquestra na manutenção (engrenagem). Liga-se à programação de eventos.

### Controles interativos

| Controle | Tipo | O que faz |
|---|---|---|
| Lista de avisos (membro) | Leitura | Comunicados vigentes do culto/instância. |
| Editor / orquestração (manutenção) | Formulário | Cria, agenda e publica o recado por evento. |
| Publicar / desativar | Botões | Liga ou tira o aviso da vista do membro. |

### O que os resultados representam

| Resultado | Significado |
|---|---|
| Aviso na tela do membro | Está publicado e no recorte de tempo/evento. |
| Aviso só na manutenção | Rascunho ou fora da janela. |

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Não perde o comunicado se chegou depois do anúncio ao vivo.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Comunicado versionado, por evento/instância, com dono editorial.
</div>
</div>
</div>

<div class="screen">

## Autorização de imagem e voz

<p class="route">Rotas <code>/autorizacao-midia</code> e <code>/autorizacao-midia-confirmar</code></p>

### Descrição comercial

Transmissões e fotos de culto exigem consentimento. Esta tela registra a autorização — e o link de confirmação fecha o ciclo mesmo fora da sessão plena.

### Propósito e conexões

Menu de configurações. Confirmação por token. Relaciona-se a LGPD e ao cadastro.

### Controles interativos

| Controle | Tipo | O que faz |
|---|---|---|
| Texto da autorização | Leitura | Explica uso de imagem e voz em transmissões e fotos. |
| **Autorizo** / **Não autorizo** | Botões | Grava o consentimento no perfil. |
| Link de confirmação (`/autorizacao-midia-confirmar`) | Token | Fecha o ciclo mesmo fora da sessão plena. |

### O que os resultados representam

| Resultado | Significado |
|---|---|
| Autorização registrada | Equipe de mídia tem base auditável. |
| Recusa | A pessoa não deve aparecer em cortes identificáveis, conforme política da igreja. |

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

### Controles interativos

| Controle | Tipo | O que faz |
|---|---|---|
| Informativo **Sugestões e Melhorias** | Título de tela | Identifica o módulo no padrão institucional. |
| Formulário de nova solicitação | Campos + envio | O membro registra ideia ou problema. |
| Lista / detalhe / resposta (manutenção) | Painel | A equipe acompanha, responde e comunica. |
| Ícone **i** (painéis de manutenção) | Botão | Textos de ajuda em modal, para não ocupar a lista. |

### O que os resultados representam

| Resultado | Significado |
|---|---|
| Solicitação na lista | Há um pedido aberto, em andamento ou respondido. |
| Relatório em PDF | Consolidado institucional do backlog. |

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

Câmera, lookup por código familiar, RPC de confirmação, cooldown anti-duplo. Login dedicado (`cel_totem` + PIN 9999).

### Controles interativos

| Controle | Tipo | O que faz |
|---|---|---|
| Câmera / leitor | Sensor | Lê o QR da carteirinha (código familiar). |
| Confirmação sonora/visual | Feedback | “Confirmado” quando a família estava na audiência. |
| **Encerrar sessão** | Botão | Logout do quiosque no fim do culto — rotina operacional. |

### O que os resultados representam

| Resultado | Significado |
|---|---|
| Confirmado | Presença oficial na Lista de Presença; cooldown evita duplo check-in. |
| Recusa / não encontrado | Código inválido, família fora da audiência, ou evento sem totem. |
| Menu curto | O totem não deve parecer o celular de um membro. |

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

### Controles interativos

| Controle | Tipo | O que faz |
|---|---|---|
| Ligar/desligar sala (Kids, Teens, etc.) | Chaves | Define quais salas existem nesta igreja. |
| Rótulos | Campos | Nomes que o membro vê no card SALA(S). |
| **Salvar** | Botão | Grava parâmetros da instância. |

### O que os resultados representam

| Resultado | Significado |
|---|---|
| Sala desligada | Eventos não oferecem aquela categoria; o card da família não lista. |
| Nomes customizados | Operação infantil desta casa, não um rótulo genérico. |

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

O calendário oficial: criar, publicar, capacidade, totem, quórum, geofence, salas, ofertas. O culto deixa de ser um post e vira um objeto de operação.

### Propósito e conexões

CRUD em `events`. Dispara Agenda, QR, salas, presença e avisos. Locais favoritos alimentam geofence.

### Controles interativos

| Controle | Tipo | O que faz |
|---|---|---|
| Informativo **Programação de Eventos** | Título de tela | Identifica o módulo (mesmo padrão visual de Administrativo). |
| **+ Novo evento** | Botão | Abre o editor em branco para cadastrar culto, reunião ou assembleia. |
| Cartão do evento (título, data, local, vagas, categorias) | Toque | Abre a edição daquele registro. |
| Selo **PUBLICADO** (verde) | Status | O evento está visível na Agenda dos membros e pode alimentar totem, salas e ofertas. |
| Selo **RASCUNHO** (azul claro) | Status | Publicação desligada. A lista da equipe mostra como inativo; o membro não vê. |

### O que os resultados representam

| Resultado | Significado |
|---|---|
| Lista **EVENTOS CADASTRADOS** | Todos os eventos desta igreja, publicados ou rascunho. |
| Data/hora e local no cartão | O que a família verá se o evento estiver publicado. |
| “Vagas ilimitadas” vs número | Capacidade usada no check-in e na inscrição. |
| Categorias (Infantil, Jovens, check-in automático) | Regras de sala, faixa e fluxo de portaria. |

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

### Controles interativos

| Controle | Tipo | O que faz |
|---|---|---|
| Informativo **Cronograma de Eventos** | Título de tela | Identifica o módulo no padrão institucional. |
| Legenda **Publicado** (ponto cheio) / **Rascunho** (círculo) | Leitura | Traduz o mesmo status da lista de eventos. |
| **Por dia** / **Por mês** | Seletor | Muda a granularidade da grade (colunas = dias ou visão mensal). |
| Célula com horário | Toque | Abre o editor daquele evento. |

### O que os resultados representam

| Resultado | Significado |
|---|---|
| Contagem “N eventos · N dias” | Volume no recorte visível — ajuda a ver sobrecarga. |
| Texto sobre Publicado vs Rascunho | Publicado = visível no app dos membros; Rascunho = publicação desligada (equivalente a Inativo na lista). |
| Ponto azul na grade + horário | Há culto/reunião naquele dia; o ponto cheio confirma publicação. |

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

### Controles interativos

| Controle | Tipo | O que faz |
|---|---|---|
| Informativo / ícone **i** | Título/ajuda | Identifica o monitor de salas. |
| Lista de inscritos | Leitura | Todas as crianças do evento, não só uma família. |
| Marcar entrada | Botão | Check-in de sala; atualiza o card dos pais. |
| WhatsApp do responsável | Link | Contato imediato se houver ocorrência. |

### O que os resultados representam

| Resultado | Significado |
|---|---|
| Entrada marcada | A criança está na sala; o pai vê o status no card. |
| Lista vazia | Evento sem Kids/Teens inscritos, ou salas desligadas. |

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

Três peças de um único relógio: o tipo (louvor, recepção, som), quem está disponível e o ciclo gerado. A igreja para de “combinar no privado”.

### Propósito e conexões

Vagas por domingo, modo individual/equipe, preview transacional `aplicar_ciclo_escala`. Alimenta o card Escalas do membro.

### Controles interativos (Servos em Disponibilidade)

| Controle | Tipo | O que faz |
|---|---|---|
| Informativo **Servos em Disponibilidade** | Título de tela | Identifica o módulo; permanece visível acima dos campos (não é coberto pela lista). |
| **Tipo de escala** | Lista | Escolhe o ministério (louvor, recepção, som…). A lista de associados é daquele tipo. |
| Campo **Nome completo** | Busca | Localiza perfis da igreja para associar como servo. |
| **X** na busca | Botão | Limpa o texto da busca. |
| Lista **Já associados** + lixeira | Ação | Remove o servo daquele tipo (com confirmação). |
| Linha de resultado com **+** | Ação | Associa o perfil ao tipo. “Já cadastrado” impede duplicata. |
| **Atualizar** | Link | Recarrega tipos e lista. |

### O que os resultados representam

| Resultado | Significado |
|---|---|
| Lista vazia de associados | Ninguém disponível naquele tipo ainda. |
| Número à esquerda do nome | Ordem sequencial usada na geração do ciclo. |
| Nome em destaque após associar | A pessoa entra no rodízio da próxima programação de escalas. |

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Recebe uma escala previsível e justa.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Geração em bloco, ordem sequencial, alerta ao remover servo com datas futuras.
</div>
</div>
</div>

<div class="screen">

## Cuidado Pastoral (equipe)

<p class="route">Painel <code>pastoral_care</code></p>

### Descrição comercial

A fila sagrada: pedidos do Coração Aberto chegam aqui para o pastor e a intercessão tratarem com método, sem perder sigilo.

### Propósito e conexões

Gestão dos envios de `/pastoral`. Status visível em Meus pedidos.

### Controles interativos

| Controle | Tipo | O que faz |
|---|---|---|
| Fila de pedidos | Lista | Mostra Coração Aberto ainda não tratado. |
| Abrir pedido | Toque | Lê motivo, sigilo e destinatário. |
| Alterar **status** / responder | Ações | Atualiza o que o membro vê em Meus pedidos. |
| Filtro por destino (sigilo vs intercessão) | Filtro | Separa o confessionário da intercessão. |

### O que os resultados representam

| Resultado | Significado |
|---|---|
| Pedido aberto | Ainda não houve acompanhamento registrado. |
| Status no histórico do membro | Espelho desta tela — transparência sem quebrar sigilo. |

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Sabe que o pedido não caiu no vazio.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Distribuição de cuidado, priorização e registro ministerial.
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

### Controles interativos

| Controle | Tipo | O que faz |
|---|---|---|
| Editor de **temas** e lições | Formulário | Atualiza o currículo que o membro estuda. |
| **Reconhecimentos** | Lista/alertas | Sinaliza à pastoral quem parou ou concluiu. |
| **Reset** da trilha | Ação protegida | Recomeça o progresso com critério; pede confirmação. |

### O que os resultados representam

| Resultado | Significado |
|---|---|
| Tema publicado | O membro vê o material novo na Trilha. |
| Alerta pastoral | Alguém precisa de cuidado formativo. |
| Reset gravado | Progresso anterior deixou de valer, com rastro. |

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

### Controles interativos

| Controle | Tipo | O que faz |
|---|---|---|
| Importar **CSV** | Arquivo | Carrega lançamentos do mês. |
| **REALIZADO** / **PLANEJADO** | Seletor | Escolhe a versão orçamentária; as duas coexistem. |
| Esvaziar mês (com escopo) | Ação | Remove carga daquele recorte, com confirmação. |
| Conciliação de **RD** | Ações | Amarra reembolsos ao mês; permite desconciliar. |
| Accordion de seções | Navegação | Organiza receitas, despesas e saldos. |

### O que os resultados representam

| Resultado | Significado |
|---|---|
| Números no card Financeiro do membro | Espelho desta carga, não uma planilha paralela. |
| RD conciliado | Já entrou no realizado do mês. |

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

Modelo em `financialPredictiveModel`. Exige histórico mínimo de meses positivos. Treina nos últimos 12 meses **com receita**; a previsão começa no mês seguinte ao **calendário**. Líquido projetado = entradas − saídas (inteiros).

### Controles interativos

| Controle | Tipo | O que faz |
|---|---|---|
| Informativo **Modelo Preditivo** + ícone **i** | Título/ajuda | Explica treino vs previsão e o líquido. |
| **Recalcular modelo** | Botão | Relê financeiro e membresia e refaz a regressão. |
| **Fórmula membros** / **Fórmula LTV** | Botões | Mostram as contas usadas nos cards. |
| Tabelas de histórico e previsão | Leitura | Histórico de treino; receita e membros dos 12 meses **futuros** (após o mês calendário). |

### O que os resultados representam

| Resultado | Significado |
|---|---|
| **Último mês da base** | Último mês com dízimos/ofertas ordinários realizados. Se for anterior a julho quando estamos em agosto, o financeiro está atrasado. |
| **Previsão a partir de** | Primeiro mês projetado = mês seguinte ao calendário (não o mês seguinte ao último financeiro). |
| Aviso âmbar de atraso | Junho–agosto sem carga: o treino continua em maio, mas a janela projetada **avança** com o calendário. |
| Entradas / saídas / líquidos | Líquidos = entradas − saídas em cada mês. Os totais do resumo são a soma desses inteiros. |
| LTV negativo | No histórico, mais membros no mês associou-se a menos receita no mês seguinte (ou o inverso). |

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

Sete olhares analíticos: membros ativos/inativos, necessidades pastorais, saúde infantil (LGPD), quórum, estacionamento, sugestões, inscritos por evento. Sem relatório de faixa etária — decisão consciente de privacidade.

### Propósito e conexões

Catálogo da manutenção. Papéis pastoral/super admin conforme o relatório. Textos de ajuda saíram da tela e foram para o ícone **i** (modal), para liberar espaço à lista.

### Controles interativos

| Controle | Tipo | O que faz |
|---|---|---|
| Informativo **Relatórios** | Título | Identifica o módulo. |
| Ícone **i** | Botão | Explica o conjunto de relatórios sem ocupar a lista. |
| Card de cada relatório | Toque | Abre o olhar analítico correspondente (membros, pastoral, quórum, sugestões, inscritos etc.). |

### O que os resultados representam

| Resultado | Significado |
|---|---|
| Totais de ativos/inativos | Recorte da igreja da sessão, com herança familiar de `membership_out` e saídas por transferência no vínculo. |
| Ausência de faixa etária detalhada | Decisão de privacidade: o relatório não expõe idade além do necessário. |

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

### Controles interativos

| Controle | Tipo | O que faz |
|---|---|---|
| Informativo **Lista de Presença** | Título de tela | Identifica o módulo no padrão institucional. |
| Chip com o **nome do evento** | Seletor | Troca a assembleia/culto cujo quórum está sendo lido. O chip ativo (azul) é o documento da vez. |
| Tabela **# / Nome / Hora do check-in** | Leitura | Relação oficial dos presentes. |

### O que os resultados representam

| Resultado | Significado |
|---|---|
| Chip do evento | Só eventos com “Requer quórum = Sim” aparecem. |
| Data, horário e local no documento | Cabeçalho da ata daquele encontro. |
| Texto em itálico do estatuto | Declaração de convocação e quitação — contexto jurídico da lista. |
| Linha na tabela | A pessoa fez check-in (totem/QR) naquele evento; a hora é o instante do registro. |
| Tabela vazia | Ainda não houve check-in, ou o evento está no futuro. |
| “Atualizando lista…” | A tela consulta o registro de quórum de novo (cerca de 15 s). |

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

<p class="route">Painel <code>profile_cadastro</code> · super admin</p>

### Descrição comercial

Correção cirúrgica: buscar pessoa, ajustar CEP/endereço, em último caso excluir perfil. Poder alto, uso raro, responsabilidade máxima.

### Propósito e conexões

Busca em `profiles`. Exclusão completa restrita. Complementa Mudança de Papéis.

### Controles interativos

| Controle | Tipo | O que faz |
|---|---|---|
| Busca por nome/telefone | Campo | Localiza o perfil nesta instância. |
| Ajuste de CEP/endereço | Campos | Corrige geolocalização sem a pessoa criar outra conta. |
| **Excluir perfil** | Ação rara | Remove cadastro por completo (super admin); pede confirmação. |

### O que os resultados representam

| Resultado | Significado |
|---|---|
| Perfil encontrado | Há identidade global; a correção vale para a ficha oficial. |
| Exclusão | Uso excepcional; o rastro de acesso permanece na auditoria conforme política. |

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

### Controles interativos

| Controle | Tipo | O que faz |
|---|---|---|
| Informativo **Recepção — Cadastro Familiar** + ícone **i** | Título/ajuda | Explica que o formulário público entra aqui antes de virar `profiles`/`members`. |
| **Atualizar** | Botão | Recarrega a fila pendente. |
| **Selecionar todos** | Botão | Marca todos os lotes visíveis. |
| **Limpar** | Botão | Desmarca a seleção. |
| Cartão do lote (toque) | Seleção | Inclui ou tira aquele pedido da ação em lote. Mostra nomes, parentesco e conflitos. |
| **Gravar selecionados (N)** / **Gravar todos pendentes** | Botão principal | Cria família e perfis oficiais. Sem seleção, grava a fila inteira. |
| **Rejeitar selecionados** | Botão | Descarta os lotes marcados sem gerar cadastro. |

### O que os resultados representam

| Resultado | Significado |
|---|---|
| **Fila pendente (N)** | Quantidade de formulários públicos ainda não decididos. |
| “Nenhum cadastro aguardando análise” | Fila vazia — a recepção está em dia. |
| Conflito de família no cartão | O lote bateu em códigos divergentes; exige revisão manual antes de gravar. |
| Mensagem de sucesso após gravar | As pessoas já existem no app (login, Agenda, QR). |

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

RPCs SECURITY DEFINER, matriz de grants, `assert_gestor_super_admin_shield`. Afeta todas as telas.

### Controles interativos

| Controle | Tipo | O que faz |
|---|---|---|
| Informativo da tela | Título | Identifica **Controle de Acesso**. |
| Chip **App Ativo** (compacto, à esquerda) | Status | Mostra se o aplicativo da instância está liberado. |
| Chip **LGPD** (mesma linha, à direita) | Ação/status | Liga ou consulta a exigência de termos e selfie nesta igreja. |
| Lista de usuários / papéis | Tabela | Edição de grants. O **Gestor** nunca vê nem edita Super Administrador, nem PIN. |
| Visão por papel vs por recurso | Abas/filtros | Alterna a matriz de permissões. |

### O que os resultados representam

| Resultado | Significado |
|---|---|
| Usuário invisível para o Gestor | Proteção: Super Administrador fora do alcance desse papel. |
| Grant desligado | A tela ou o card some do menu daquela pessoa. |
| LGPD desligada | Cadastro e login não exigem aceite/selfie nesta instância. |

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Vê só o que lhe cabe — e isso é cuidado, não restrição vazia.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
ACL auditável, fail-closed, sem o gestor enxergar o super admin.
</div>
</div>
</div>

<div class="screen">

## Mudança de Papéis

<p class="route">Painel <code>mudanca_papeis</code></p>

### Descrição comercial

Visitante, congregado, membro: a caminhada eclesial vira dado oficial, com contagem de ativos e herança familiar.

### Propósito e conexões

Pastoral e super admin. Integra-se à Lista de Membros, carteirinha (status), limites de billing e **Transferência de Membro** (quem saiu por transferência aparece como inativo nesta igreja, com nome em vermelho).

### Controles interativos

| Controle | Tipo | O que faz |
|---|---|---|
| Ícone **i** ao lado do título | Botão | Abre o texto de ajuda em um modal, sem ocupar a lista. |
| Busca (nome, telefone, código) | Campo | Filtra a lista de perfis elegíveis. |
| Cabeçalhos **Visitante / Congregado / Membro** | Filtro | Mostra só aquele papel atual. |
| Nome azul sublinhado | Link | Abre as datas de membresia (entrada e desligamento). Congregados em família herdam datas do responsável. |
| Nome em **vermelho** | Status | Há data de saída: desligamento pastoral **ou** transferência aprovada na origem. |
| Ações de papel | Botões | Promovem ou rebaixam o papel eclesial, com registro. |

### O que os resultados representam

| Resultado | Significado |
|---|---|
| Contagens por papel | Ativos daquela igreja (sem super admin e sem equipe pastoral na lista operacional). |
| Data de desligamento preenchida | A pessoa não conta mais como membro/congregado ativo **nesta** instância. Em transferência, a data vive no vínculo (`profile_igreja_vinculos`), não em `profiles.membership_out` (para o destino poder recebê-la ativa). |

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

<p class="route">Painel <code>transferencia_igreja</code> · menu operacional</p>

### Descrição comercial

É a porta oficial entre instâncias da mesma plataforma: a pessoa (ou a família) **sai** de uma igreja e **entra** em outra sem criar um segundo cadastro, sem levar cargos de liderança e sem expor o diretório de congregações na tela. A igreja de destino solicita; a de origem registra a saída. O histórico fica auditável — não um “apaga aqui e lança lá” no WhatsApp.

### Propósito e conexões

A identidade (`profiles.id`, telefone, CPF) é global. O pedido fica em `igreja_transfer_requests` e as pessoas em `igreja_transfer_people`. Na origem, a data de saída e o status **Transferido** ficam em `profile_igreja_vinculos` (`membership_out`, `transferred_at`, `transferred_to_tenant_id`) — **não** em `profiles.membership_out`, para o membro permanecer ativo no destino. Após a aprovação, o destino gera novo código de família e zera cargos administrativos. Integra-se a Mudança de Papéis, Membros Inativos, login (conflito de instância) e Recepção Familiar.

### Controles interativos

| Controle | Tipo | O que faz |
|---|---|---|
| Informativo **Transferência de Membro** | Título de tela | Identifica o módulo (padrão Administrativo / Sugestões). |
| Ícone **i** | Botão | Explica o fluxo: localizar pelo celular; a origem só aparece depois da busca; a entrada no destino é sem cargos de liderança. |
| Aba **Solicitar** | Navegação | Formulário da igreja de **destino** para pedir a entrada de alguém que ainda está em outra instância. |
| Aba **Recebidos (N)** | Navegação | Pedidos em que **esta** igreja é a origem e precisa decidir a saída. O número é a quantidade pendente. |
| Aba **Enviados** | Navegação | Pedidos que esta igreja já mandou a outras origens. |
| Campo **Celular** (compacto) | Telefone | Única chave de busca na tela. Não há lista prévia de igrejas (IBEP, IBS etc.) — isso protege dados de outras congregações. |
| **Localizar cadastro** | Botão (à direita do celular) | Consulta o servidor pelo número. Se encontrar, revela a igreja de origem daquela pessoa e o grupo que será transferido. |
| **Observação pastoral** | Texto | Motivo opcional que viaja com o pedido para a origem. |
| **Incluir o grupo familiar inteiro** | Caixa | Se marcado, o pedido leva todos os membros da família de origem, não só o telefone digitado. Fica abaixo da observação. |
| **Solicitar transferência** | Botão principal (altura mínima 48 px) | Envia o pedido à origem **depois** que o cadastro foi localizado. Sem localização, o app pede para buscar pelo celular primeiro. Confirmação: cargos de liderança serão removidos na entrada. |
| Cartão do pedido (Recebidos / Enviados) | Leitura | Mostra tipo (Membro/Família), status, códigos origem → destino e nomes. |
| **Aprovar saída** | Botão | A origem confirma: grava a data de saída no vínculo, gera família no destino e conclui o pedido. |
| **Recusar** | Botão | A origem recusa; o cadastro permanece na igreja atual. |
| **Cancelar pedido** (Enviados, se pendente) | Botão | A igreja de destino desiste antes da decisão da origem. |

### O que os resultados representam

| Resultado | Significado |
|---|---|
| Ausência de chips IBEP/IBS/outras | Comportamento correto: outras igrejas **não** são listadas até existir um cadastro encontrado. |
| Bloco **Igreja de origem** após localizar | Código e nome da instância a que o telefone pertence hoje. |
| Linha **origem → destino** | De onde a pessoa sai e para onde esta igreja a recebe. |
| Nomes no preview | Quem vai no pedido (uma pessoa ou o grupo familiar). “Entra como…” é o papel básico no destino, sem liderança. |
| Aviso âmbar sobre cargos | Garantia institucional: privilégios da origem não atravessam a fronteira. |
| Status **Pendente** | A origem ainda não aprovou nem recusou. |
| Status **Concluído** | Saída registrada na origem; entrada válida no destino. |
| Status **Recusado** / **Cancelado** | Não houve mudança de vínculo. |
| **Histórico de saídas** (aba Recebidos) | Pedidos já processados em que esta igreja foi origem (`igreja_transfer_requests`). |
| Nome vermelho em Mudança de Papéis / Inativos na origem | A transferência foi aplicada; a pessoa não está ativa **aqui**, mas está (ou estará) no destino. |

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Continua sendo a mesma pessoa no app (mesmo telefone). Muda a igreja da sessão, a família e o que pode fazer — sem “criar outra conta”.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Rastro completo do pedido, decisão pastoral na origem e entrada limpa no destino. Sem vitrine de congregações irmãs na tela de busca.
</div>
</div>
</div>

<div class="screen">

## Acessos de Usuários

<p class="route">Painel <code>profile_access_insights</code></p>

### Descrição comercial

Quem entrou, quando, quais telas. Transparência de uso para a liderança responsável — e limpeza global só no super admin.

### Propósito e conexões

Histórico de sessão. Gestor não vê registros do Super Administrador.

### Controles interativos

| Controle | Tipo | O que faz |
|---|---|---|
| **Buscar por nome** | Campo | Filtra o histórico. |
| Linhas de acesso | Leitura | Quem entrou, quando e quais telas. |
| **Limpar histórico** | Botão (super admin) | Apaga o histórico global; o Gestor não vê Super Administrador nem executa limpeza indevida. |

### O que os resultados representam

| Resultado | Significado |
|---|---|
| Linha de login/navegação | Uso real do app naquela instância. |
| Ausência de registros do Super Admin para o Gestor | Escudo de segurança (mesmo princípio do Controle de Acesso). |

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Indireta: a igreja cuida do acesso sem vigiar a vida privada além do necessário.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Auditoria de login e navegação, com recorte de segurança entre papéis.
</div>
</div>
</div>

<div class="screen">

## Modo Ghost (Auditor)

<p class="route">Painel <code>auditor</code></p>

### Descrição comercial

Ver o app com os olhos de outra pessoa, para testar permissão de verdade. Não é “entrar na conta”: é simular a jornada do alvo, com identidade efetiva em todas as telas.

### Propósito e conexões

Grant `maintenance.card.auditor` ou super admin. `loadEffectiveSessionProfile` em todo fluxo. Encerrar Ghost volta ao auditor.

### Controles interativos

| Controle | Tipo | O que faz |
|---|---|---|
| Informativo **Modo Ghost (Auditor)** | Título | Identifica o módulo. |
| **Usuário ativo** (lista pesquisável) | Seletor | Escolhe o alvo pelo nome ou telefone. Placeholder: “Selecione um usuário...”. |
| **Ativar Modo Ghost** | Botão | Pede confirmação e simula a sessão do alvo. Alterações ficam em nome dele, com auditoria do operador real. |
| **Papéis de acesso** (após selecionar) | Leitura | Papéis do alvo **antes** de ativar. |
| **Relatório de acesso (ACL)** | Tabela | Telas/tabelas/colunas com Ver / Alterar (Sim/Não). |
| **Mostrar somente com acesso** / **Mostrar todos os recursos** | Botão | Filtra a matriz ACL. |
| Grupos Telas / Tabelas / Colunas (**+** / **−**) | Expansão | Abre ou fecha cada tipo de recurso. |
| Banner **Modo Ghost ativo (auditor)** | Status global | Lembra que o operador está simulado como o alvo — não é o login da pessoa. |
| **Sair** no banner | Botão | Encerra a simulação e devolve a identidade do auditor. |

### O que os resultados representam

| Resultado | Significado |
|---|---|
| “Nenhum papel atribuído — visitante” | O app trata o alvo como visitante até haver papel explícito. |
| Contagens “com visualização · com alteração · recursos cadastrados” | Tamanho da ACL daquela pessoa. |
| Menu/cards diferentes após Ativar | A jornada efetiva é a do alvo (`loadEffectiveSessionProfile`). |
| Tela pedindo para usar o banner | Ghost já está ativo; não se escolhe outro alvo até **Sair**. |

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Não usa esta tela. Beneficia-se de um app em que as permissões foram testadas.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
QA pastoral e de TI: “o congregado vê o que deveria ver?” — sem senha alheia.
</div>
</div>
</div>

<div class="screen">

## Instâncias (Igrejas)

<p class="route">Rota <code>/igrejas</code> · super admin</p>

### Descrição comercial

O ecossistema multi-igreja: logo, redes, CNPJ de ofertas, código da entidade. Cada casa tem cara e PIX próprios.

### Propósito e conexões

Tenancy, branding, prefixo familiar (`Parm_entidade`), ofertas. Engrenagem do menu.

### Controles interativos

| Controle | Tipo | O que faz |
|---|---|---|
| Lista de igrejas | Navegação | Abre a ficha da instância. |
| Logo, cores, redes, CNPJ, PIX | Campos | Identidade visual e tesouraria daquela casa. |
| Código da entidade / prefixo familiar | Campo | Gera códigos tipo `IBN0001` e isola famílias. |
| **Salvar** | Botão | Publica branding e parâmetros. |

### O que os resultados representam

| Resultado | Significado |
|---|---|
| Logo no login e no Índice | A sessão está amarrada a este tenant. |
| Prefixo diferente entre igrejas | Famílias e QR não se misturam. |

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

A sustentabilidade da plataforma: planos, limite de membros, checkout Stripe em modo teste/produção conforme ambiente. A igreja escolhe o plano com números de ativos à vista.

### Propósito e conexões

`BillingClass`, Functions Stripe, `assert_tenant_can_add_member`. Isolamento por `tenant_id`.

### Controles interativos

| Controle | Tipo | O que faz |
|---|---|---|
| Planos e limite de membros | Leitura/escolha | Mostra teto de ativos da igreja. |
| Checkout Stripe | Botão | Assina ou altera plano (teste ou produção conforme ambiente). |
| Contagem de ativos | Leitura | Base para `assert_tenant_can_add_member` (inclui o efeito de transferências). |

### O que os resultados representam

| Resultado | Significado |
|---|---|
| Limite atingido | Novos membros/transferências de entrada podem ser recusados até subir o plano. |
| Modo teste | Cobrança não é produção; útil para homologação. |

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Indireta: o app da igreja permanece disponível e dimensionado.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Contrato SaaS visível, com teto de membresia alinhado ao plano.
</div>
</div>
</div>

<div class="screen">

## Orquestrador (admin)

<p class="route">Rota <code>/admin/orquestrador</code></p>

### Descrição comercial

Console avançado de orquestração de eventos e avisos para operação de alto volume — o “mesa de controle” quando o culto é complexo.

### Propósito e conexões

Complementa Manutenção de Avisos e Programação de Eventos.

### Controles interativos

| Controle | Tipo | O que faz |
|---|---|---|
| Console de eventos e avisos | Painel | Dispara e coordena fluxos em lote no culto complexo. |
| Publicar / agendar | Ações | Alinha projetor, app e portaria no mesmo tempo. |

### O que os resultados representam

| Resultado | Significado |
|---|---|
| Aviso/evento no app do membro | O orquestrador publicou no recorte certo. |
| Item só no console | Ainda não chegou à jornada da família. |

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
4. **Cuidado e serviço** (pastoral, escalas, RD, ofertas).
5. A equipe **governa** (ACL, papéis, Ghost, relatórios, tesouraria e **transferência entre igrejas**).

O valor para o membro é autonomia e dignidade. O valor para a administração é controle com rastreio, menos WhatsApp como sistema e um único lugar em que o culto, a família e a prestação de contas se encontram.

Este documento descreve o produto como ele está no código em **25 de agosto de 2026**, incluindo informativos de tela padronizados, busca de transferência somente pelo celular (sem listar outras igrejas), registro de saídas em `igreja_transfer_requests` / `profile_igreja_vinculos`, e a distinção entre o **X** (limpa o campo) e **Alterar instância** no login. Telas condicionais (QR, estacionamento, servos, manutenção) aparecem somente quando o papel, o evento e os parâmetros da instância autorizam — e isso, em si, já é parte da proposta comercial: **cada pessoa vê a igreja que lhe cabe viver**.

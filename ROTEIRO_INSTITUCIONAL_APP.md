<div class="cover">
<img class="cover-logo" src="file:///C:/Users/maufr/.cursor/MProj/ecossistema/app-igreja/images/conecta.png" alt="Conecta+" />
<p class="cover-kicker">Roteiro institucional imersivo</p>
# Conecta+ — jornada de ponta a ponta
<p class="cover-sub">Um guia de casa: da porta de login à engrenagem da governança. Cada parada mostra o lugar na jornada, o porquê de cada detalhe, as pontes internas e a visão do membro ao lado da visão de quem administra.</p>
<p class="cover-meta">
<strong>Solução:</strong> ecossistema app-igreja (PWA + mobile)<br>
<strong>Caminho publicado:</strong> Início, menu do membro, Eu quero… e engrenagem — sem carrossel do Painel<br>
<strong>Recortes:</strong> busca automática em <code>Screeshot/</code>, <code>docs/manual-manutencao/screens/</code> e <code>docs/manual-painel/screens/</code><br>
<strong>Data:</strong> 1º de setembro de 2026<br>
<strong>Inclui:</strong> geofence (check-in por aproximação), totem, régua D+1/D+4/D+8, Ghost, Aliança, salas, Pix e Controle de Acesso
</p>
</div>

## Como ler este roteiro

Caminhamos na ordem em que a vida acontece: chegar, orientar-se, marcar presença, cuidar da família, servir, e só então abrir a engrenagem. Em cada parada há quatro lentes — o lugar, o que se encontra, as conexões e as duas visões (membro e administração). As imagens são os recortes originais do projeto, inseridos automaticamente quando o arquivo existe.

## Mapa da jornada

| Capítulo | O que a igreja ganha |
|---|---|
| A. Chegada | Identidade única, LGPD, igreja certa |
| B. Praça | Eventos, avisos, menu, Eu quero… |
| C. Culto | Agenda, geofence 30 m, totem, salas |
| D. Casa | Perfil, família, trilha, livros, RD |
| E. Comunidade | Pix, oração, célula, escalas, murais |
| F–J. Engrenagem | Operação, pessoas, culto, caixa, papéis |
| K. Camarim | O que saiu do caminho publicado |


# Parte A — Chegada — confiança e identidade

<div class="screen">

## Portão de entrada — Login

<p class="route">/</p>

<p class="missing-shot">Recorte original desta parada ainda não está na pasta Screeshot/ ou nos manuais — o roteiro descreve a tela mesmo assim.</p>

### Onde estamos na jornada

Primeiro passo de qualquer jornada. Tela pública, antes de qualquer menu.

### O que se encontra — e por quê

Telefone, senha de quatro dígitos e atalho biométrico no aparelho nativo. Recuperar senha e primeiro cadastro saem daqui. O totem do hall usa o mesmo portão, mas com identidade de aparelho (cel_totem), para o quiosque nunca se parecer com o celular de um irmão.

A igreja deixa de espalhar “o link do grupo” como credencial. Cada pessoa tem uma identidade auditável. A biometria existe para fluidez, não para substituir o PIN no servidor.

### Conexões internas e quem conduz

Valida `verificar_login`, restaura sessão, encaminha a cadastro incompleto, LGPD, escolha de igreja, totem ou Início. Quem administra o PIN e o aparelho do totem é a Secretaria / Super Administrador.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Entra com o próprio celular, no tempo dela. Não precisa pedir senha emprestada no corredor.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Sessão rastreável, PIN no servidor, totem isolado. Reduz aparelho “logado como outra pessoa”.
</div>
</div>
</div>

<div class="screen">

## Primeira visita digital — Cadastro

<p class="route">/register</p>

<p class="missing-shot">Recorte original desta parada ainda não está na pasta Screeshot/ ou nos manuais — o roteiro descreve a tela mesmo assim.</p>

### Onde estamos na jornada

Logo após o portão, para quem ainda não tem PIN.

### O que se encontra — e por quê

Nome, telefone, e-mail e senha inicial. É o formulário que transforma um número de WhatsApp em membro da casa digital.

Sem este degrau, a igreja continuaria com cadastros paralelos. O e-mail existe para recuperação auditável, não como login cotidiano.

### Conexões internas e quem conduz

Cria o perfil, dispara o fluxo de senha e liga-se a LGPD e ao cadastro familiar. Secretaria completa o que faltar em Cadastro de Usuário.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Ganha identidade própria, sem fila na mesa da secretaria só para “entrar no aplicativo”.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Base única de pessoas. Evita duplicatas e telefone compartilhado como conta oficial.
</div>
</div>
</div>

<div class="screen">

## Chave reserva — Recuperar senha

<p class="route">/forgot-password</p>

<p class="missing-shot">Recorte original desta parada ainda não está na pasta Screeshot/ ou nos manuais — o roteiro descreve a tela mesmo assim.</p>

### Onde estamos na jornada

Atalho do login, quando o PIN foi esquecido.

### O que se encontra — e por quê

Pedido de redefinição por e-mail, com mensagem clara de que o canal oficial não é o grupo da igreja.

Recuperação por WhatsApp da liderança mistura pastor com helpdesk. O e-mail deixa trilha.

### Conexões internas e quem conduz

Usa os parâmetros de remetente da instância. Super Administrador e Gestor de Controle de Acesso não vêem o PIN de ninguém.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Recupera o acesso em casa, sem constrangimento.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Suporte padronizado, sem anotar senha em papel.
</div>
</div>
</div>

<div class="screen">

## Qual casa? — Selecionar igreja

<p class="route">/selecionar-igreja</p>

<p class="missing-shot">Recorte original desta parada ainda não está na pasta Screeshot/ ou nos manuais — o roteiro descreve a tela mesmo assim.</p>

### Onde estamos na jornada

Quando o telefone pode pertencer a mais de uma instância, ou na primeira escolha.

### O que se encontra — e por quê

Lista as igrejas do ecossistema às quais a pessoa está vinculada e fixa o tenant da sessão.

O Conecta+ é multi-igreja. Misturar dados de duas comunidades seria um erro pastoral e jurídico.

### Conexões internas e quem conduz

Grava o tenant da sessão. Instâncias são criadas em Igrejas; a Aliança enxerga a rede.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Entra na igreja certa, com a agenda e o Pix daquela casa.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Isolamento de dados por instância, sem planilha “qual igreja é essa linha?”.
</div>
</div>
</div>

<div class="screen">

## O compromisso da casa — Termos LGPD

<p class="route">/lgpd</p>

<div class="shots single"><figure><img src="file:///C:/Users/maufr/.cursor/MProj/ecossistema/app-igreja/docs/manual-manutencao/screens/m14b-lgpd-modulo-inativo.png" alt="m14b-lgpd-modulo-inativo.png" /><figcaption class="shot-cap">docs/manual-manutencao/screens/m14b-lgpd-modulo-inativo.png</figcaption></figure></div>

### Onde estamos na jornada

Antes da vida no app, quando a igreja ativou o termo (`LGPD_Ativo`).

### O que se encontra — e por quê

Texto institucional de privacidade e o aceite rastreado. Sem aceite, a jornada não abre o Início.

Confiança. A igreja declara o que faz com nome, foto, localização e ofertas — e guarda quem concordou.

### Conexões internas e quem conduz

Parâmetro LGPD, Sobre o Conecta+ (declaração), Autorização de imagem e voz. Secretaria/SA ligam ou desligam o módulo.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Sabe que seus dados não são “do grupo do WhatsApp”.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Comprovante de aceite, módulo ligável por igreja, sem improvisar termo em PDF solto.
</div>
</div>
</div>

<div class="screen">

## Porta da rua — Cadastro familiar público

<p class="route">/cadastro-familia</p>

<p class="missing-shot">Recorte original desta parada ainda não está na pasta Screeshot/ ou nos manuais — o roteiro descreve a tela mesmo assim.</p>

### Onde estamos na jornada

Link da recepção e da Recepção Familiar, para quem ainda não está no app.

### O que se encontra — e por quê

Formulário completo da família (endereço por CEP, membros, menores) pensado para o visitante preencher no celular, no hall ou em casa.

A recepção não deve copiar papel. O visitante escreve a própria história; a igreja só reconhece.

### Conexões internas e quem conduz

Alimenta `members`/`profiles` e a fila da Recepção Familiar. Secretaria aceita o núcleo. A Régua de Acolhimento só nasce depois do aceite.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Cadastra a família uma vez, sem ditado no balcão.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Fila de reconhecimento, sem digitação duplicada e com endereço padronizado.
</div>
</div>
</div>

<div class="screen">

## Até logo — Sessão encerrada

<p class="route">/sessao-encerrada</p>

<p class="missing-shot">Recorte original desta parada ainda não está na pasta Screeshot/ ou nos manuais — o roteiro descreve a tela mesmo assim.</p>

### Onde estamos na jornada

Depois de Encerrar sessão no Início, ou timeout seguro.

### O que se encontra — e por quê

Tela de despedida que confirma: este aparelho não fala mais em nome daquela pessoa.

Celular emprestado, totem e Ghost exigem um fim de sessão visível, não um “sumiu a tela”.

### Conexões internas e quem conduz

Limpa sessão local e volta ao login. No totem, é rotina de fim de culto.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Sabe que saiu. O próximo da família não herda a conta.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Reduz sessão órfã em aparelho compartilhado.
</div>
</div>
</div>

<div class="screen">

## Bastidor técnico — Configurar instância

<p class="route">/configurar</p>

<p class="missing-shot">Recorte original desta parada ainda não está na pasta Screeshot/ ou nos manuais — o roteiro descreve a tela mesmo assim.</p>

### Onde estamos na jornada

Fora da jornada do membro. Usado na implantação da igreja no PWA.

### O que se encontra — e por quê

Ponto de configuração da instância (URL, tenant) para o aplicativo saber a qual casa pertence este endereço.

Cada igreja no Cloudflare/domínio precisa nascer com identidade, não com “cópia do vizinho”.

### Conexões internas e quem conduz

Instâncias (`/igrejas`) e parâmetros da casa. Só operação de TI / Super Administrador.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Não transita aqui no dia a dia.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Garante que o PWA daquela igreja aponta para o banco e a marca corretos.
</div>
</div>
</div>


# Parte B — A praça central — Início, menu e Eu quero…

<div class="screen">

## A praça — Início

<p class="route">/(tabs) · tela do membro</p>

<div class="shots"><figure><img src="file:///C:/Users/maufr/.cursor/MProj/ecossistema/app-igreja/Screeshot/1.png" alt="1.png" /><figcaption class="shot-cap">Screeshot/1.png</figcaption></figure>
<figure><img src="file:///C:/Users/maufr/.cursor/MProj/ecossistema/app-igreja/Screeshot/2-1.png" alt="2-1.png" /><figcaption class="shot-cap">Screeshot/2-1.png</figcaption></figure></div>

### Onde estamos na jornada

Depois do aceite e da sessão. É a casa à qual a pessoa volta sempre.

### O que se encontra — e por quê

Saudação pelo nome, marca da igreja, lista Próximos Eventos, faixa Avisos e o rodapé Eu quero… (Contribuir e pedido de oração). O menu hamburger abre a autonomia da família; a engrenagem, só para quem tem papel de operação, abre a manutenção.

O carrossel antigo do Painel saiu do caminho publicado. A praça precisa caber em um olhar: o que vem aí, o que a casa avisou, o que eu quero fazer agora.

### Conexões internas e quem conduz

Eventos vêm da Programação de Eventos. Avisos, da Manutenção de Avisos. Toque no evento abre a Agenda da Família. Geofence pode já estar ouvindo o GPS em segundo plano neste mesmo Início.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Não caça card. Vê o culto, o aviso e dois gestos de coração: contribuir e orar.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Publica evento e aviso uma vez; a praça de todos se atualiza. ACL esconde o que o papel não deve ver.
</div>
</div>
</div>

<div class="screen">

## O corredor da casa — Menu lateral

<p class="route">Drawer · Início, Perfil, Financeiro, Célula, Escalas, Murais, Sugestões, Redes, Sobre</p>

<div class="shots"><figure><img src="file:///C:/Users/maufr/.cursor/MProj/ecossistema/app-igreja/Screeshot/2-2.png" alt="2-2.png" /><figcaption class="shot-cap">Screeshot/2-2.png</figcaption></figure>
<figure><img src="file:///C:/Users/maufr/.cursor/MProj/ecossistema/app-igreja/docs/manual-manutencao/screens/m01-menu-modulos.png" alt="m01-menu-modulos.png" /><figcaption class="shot-cap">docs/manual-manutencao/screens/m01-menu-modulos.png</figcaption></figure></div>

### Onde estamos na jornada

Ícone de três linhas no Início. Só autonomia do membro — a gestão pesada está na engrenagem.

### O que se encontra — e por quê

Início, Perfil, Financeiro (leitura), Minha Célula, Escalas, Mural de Oportunidades, Mural de Generosidade, Sugestões, Redes Sociais e Sobre o Conecta+.

Separar “minha vida na igreja” de “eu opero a igreja” evita que um visitante tropece em Controle de Acesso.

### Conexões internas e quem conduz

Cada item respeita ACL. Engrenagem (AppDrawerSettings) é outro corredor, agrupado em Operação, Pessoas, Culto, Finanças e Governança.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Encontra o que é dela, em linguagem de família.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
O mesmo menu, filtrado. Gestor e Super Administrador enxergam a engrenagem; o membro, não.
</div>
</div>
</div>

<div class="screen">

## Dois passos de coragem — Eu quero…

<p class="route">Rodapé do Início</p>

<div class="shots"><figure><img src="file:///C:/Users/maufr/.cursor/MProj/ecossistema/app-igreja/Screeshot/1.png" alt="1.png" /><figcaption class="shot-cap">Screeshot/1.png</figcaption></figure>
<figure><img src="file:///C:/Users/maufr/.cursor/MProj/ecossistema/app-igreja/docs/manual-manutencao/screens/m09-cuidado-pastoral.png" alt="m09-cuidado-pastoral.png" /><figcaption class="shot-cap">docs/manual-manutencao/screens/m09-cuidado-pastoral.png</figcaption></figure></div>

### Onde estamos na jornada

Sempre visível na praça, some só quando a Agenda da Família está aberta.

### O que se encontra — e por quê

Contribuir se desdobra em Dízimos e Ofertas (Pix com valor) e Campanhas e Projetos (Pix já identificado). Ao lado, Fazer um pedido de Oração abre o Coração Aberto.

Dízimo e campanha não podem misturar no mesmo QR genérico. Oração não pode competir com recado de WhatsApp.

### Conexões internas e quem conduz

`/ofertas` (tesouraria configura a chave), `/pastoral` (pastoral lê a fila). Campanha sem projeto ativo avisa em toast, em vez de abrir tela vazia.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Dois toques: dar e pedir cuidado. Sem procurar menu.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Tesoureiro recebe Pix identificado. Pastoral recebe pedido com nome e telefone da sessão efetiva (inclusive em Ghost).
</div>
</div>
</div>

<div class="screen">

## Sair com dignidade — Encerrar sessão

<p class="route">Diálogo no Início</p>

<div class="shots single"><figure><img src="file:///C:/Users/maufr/.cursor/MProj/ecossistema/app-igreja/docs/manual-manutencao/screens/m00-acesso-engrenagem.png" alt="m00-acesso-engrenagem.png" /><figcaption class="shot-cap">docs/manual-manutencao/screens/m00-acesso-engrenagem.png</figcaption></figure></div>

### Onde estamos na jornada

Rodapé da sessão, vermelho de propósito: não é um detalhe escondido.

### O que se encontra — e por quê

Confirmação antes de limpar a sessão. No totem, é o botão de “este culto acabou neste aparelho”.

Famílias compartilham celular. Encerrar tem de ser óbvio.

### Conexões internas e quem conduz

Leva a `/sessao-encerrada` e devolve ao login. Ghost encerra a identidade efetiva, não a do auditor, por outro fluxo.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Entrega o aparelho sabendo que a conta dela não ficou aberta.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Higiene de sessão no hall e na secretaria.
</div>
</div>
</div>


# Parte C — O culto na palma da mão — agenda, geofence e totem

<div class="screen">

## Vamos no culto? — Agenda da Família

<p class="route">Modal no Início · toque no evento</p>

<div class="shots"><figure><img src="file:///C:/Users/maufr/.cursor/MProj/ecossistema/app-igreja/Screeshot/3.png" alt="3.png" /><figcaption class="shot-cap">Screeshot/3.png</figcaption></figure>
<figure><img src="file:///C:/Users/maufr/.cursor/MProj/ecossistema/app-igreja/Screeshot/1.png" alt="1.png" /><figcaption class="shot-cap">Screeshot/1.png</figcaption></figure></div>

### Onde estamos na jornada

Coração operacional da família. Substitui o Card 1 do Painel antigo.

### O que se encontra — e por quê

Evento selecionado, vagas, local, horários e a lista da audiência: cônjuge, filhos, congregados do núcleo. Quórum mostra só o próprio nome com cadeado. Selos de sala (Kids/Teens) quando o evento as habilita.

Pré-check-in é o passaporte. Sem audiência marcada, geofence e totem não têm a quem confirmar.

### Conexões internas e quem conduz

Programação de Eventos define capacidade, totem, geofence, quórum, somente membros e salas. `sync_family_event_registrations_atomic` grava a audiência. Secretaria e pastoral acompanham presença depois.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Marca quem vai, no sofá de casa. No templo, a casa já sabe.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Capacidade real, não lista de WhatsApp. Quórum e geofence nascem desta lista.
</div>
</div>
</div>

<div class="screen">

## Chegou no quarteirão — Check-in por aproximação

<p class="route">Início + Agenda · GPS do aparelho + RPC `confirm_geo_family_checkin_atomic`</p>

<div class="shots"><figure><img src="file:///C:/Users/maufr/.cursor/MProj/ecossistema/app-igreja/Screeshot/3.png" alt="3.png" /><figcaption class="shot-cap">Screeshot/3.png</figcaption></figure>
<figure><img src="file:///C:/Users/maufr/.cursor/MProj/ecossistema/app-igreja/docs/manual-manutencao/screens/m02-programacao-eventos.png" alt="m02-programacao-eventos.png" /><figcaption class="shot-cap">docs/manual-manutencao/screens/m02-programacao-eventos.png</figcaption></figure>
<figure><img src="file:///C:/Users/maufr/.cursor/MProj/ecossistema/app-igreja/docs/manual-manutencao/screens/m03-editor-evento.png" alt="m03-editor-evento.png" /><figcaption class="shot-cap">docs/manual-manutencao/screens/m03-editor-evento.png</figcaption></figure></div>

### Onde estamos na jornada

Quando o evento tem Check-in automático ligado e o local favorito tem latitude/longitude. Roda no Início, mesmo com a agenda fechada.

### O que se encontra — e por quê

O app pede localização, mede a distância até o local do culto (raio padrão 30 m, parâmetro `check_in_geofence_raio_metros`) e só dispara após três leituras consecutivas dentro do raio. A janela abre N horas antes (`check_in_geofence_tempo`, hoje 2 h) e vai até o fim do dia em America/Sao_Paulo. Sem audiência, abre a Agenda. Faixa na tela conta a aproximação.

Fila de QR no hall não é o único jeito de dizer “estou aqui”. Quem já marcou a família e entra no perímetro confirma presença sem ritual extra — e sem marcar presença do sofá: a audiência vira pré-check-in; `confirmado` só com GPS.

### Conexões internas e quem conduz

Coordenadas vêm de Locais favoritos (`event_local` = nome do local). Programação de Eventos liga `geofence_ativo`. Sem coordenadas, o app avisa e a manutenção recusa salvar o flag. Totem e quórum convivem: totem continua para quem precisa do leitor.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Chega perto, autoriza o GPS, vê “check-in confirmado” com os nomes da família.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Presença objetiva com lat/lng e horário. Relatórios distinguem GPS (Geofence) de totem. Evento futuro confirmado sem GPS volta a pré-check-in.
</div>
</div>
</div>

<div class="screen">

## O porteiro eletrônico — Totem de check-in

<p class="route">/totem-checkin</p>

<p class="missing-shot">Recorte original desta parada ainda não está na pasta Screeshot/ ou nos manuais — o roteiro descreve a tela mesmo assim.</p>

### Onde estamos na jornada

Engrenagem → Operação e Segurança. Aparelho do hall, não o celular do membro.

### O que se encontra — e por quê

Câmera lê o QR da família (o mesmo código da carteirinha). Confirma quem já estava na audiência. Cooldown evita duplo beep. Encerrar sessão é rotina de fim de culto.

Há quem não queira GPS, há quórum que exige leitor, há visitante com carteirinha impressa na cabeça. O totem é o gesto único da portaria.

### Conexões internas e quem conduz

Login `cel_totem`. RPC `lookup_totem_checkin` / `confirm_totem_checkin`. Agenda gera o pré-check-in. Presença (quórum) trava a audiência depois.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Mostra o celular (ou o código), ouve o confirmado, entra.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Fila rápida, aparelho que não vaza sessão de membro, presença oficial para lista e salas.
</div>
</div>
</div>

<div class="screen">

## O crachá da casa — Carteirinha no Perfil

<p class="route">/perfil</p>

<p class="missing-shot">Recorte original desta parada ainda não está na pasta Screeshot/ ou nos manuais — o roteiro descreve a tela mesmo assim.</p>

### Onde estamos na jornada

Menu → Perfil. Convive com dados, trilha e Cantinho da Leitura.

### O que se encontra — e por quê

QR da família e código textual (ex.: IBN0001). Não carrega nome, telefone nem oferta — só o identificador que o totem entende.

Privacidade no corredor: quem olha por cima do ombro não lê a vida da pessoa.

### Conexões internas e quem conduz

Mesmo código da Agenda/totem. Selfie biométrica (quando houver) reforça o Perfil, não o payload do QR.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Um código, uma família, um check-in.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Identidade operacional sem PII no QR.
</div>
</div>
</div>

<div class="screen">

## Nomes que as crianças reconhecem — Configuração de salas

<p class="route">/configuracao-salas</p>

<div class="shots single"><figure><img src="file:///C:/Users/maufr/.cursor/MProj/ecossistema/app-igreja/docs/manual-manutencao/screens/m05-sala-checkin.png" alt="m05-sala-checkin.png" /><figcaption class="shot-cap">docs/manual-manutencao/screens/m05-sala-checkin.png</figcaption></figure></div>

### Onde estamos na jornada

Engrenagem → Operação. Antes do culto com Kids/Teens.

### O que se encontra — e por quê

Rótulos afetivos, habilitação e atribuição de membros às salas. Sem isso, “IBN Infantil” seria um texto genérico.

Pai procura o nome que a criança ouve na porta, não um código interno.

### Conexões internas e quem conduz

Evento habilita salas na Programação. Equipe faz check-in em Sala(s) — Check In. Agenda mostra selos só das salas daquele culto.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Vê o nome da sala da filha na audiência.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Padroniza nomes, evita sala “fantasma” em evento que não a usa.
</div>
</div>
</div>

<div class="screen">

## A criança entrou? — Sala(s) Check-in

<p class="route">/maintenance-dashboard?panel=sala_servidor</p>

<div class="shots single"><figure><img src="file:///C:/Users/maufr/.cursor/MProj/ecossistema/app-igreja/docs/manual-manutencao/screens/m05-sala-checkin.png" alt="m05-sala-checkin.png" /><figcaption class="shot-cap">docs/manual-manutencao/screens/m05-sala-checkin.png</figcaption></figure></div>

### Onde estamos na jornada

Engrenagem → Culto e Eventos, no horário da sala.

### O que se encontra — e por quê

Lista quem da audiência pertence à sala, marca entrada, oferece WhatsApp do responsável.

Paz para quem está no templo: saber que o filho atravessou a porta da sala.

### Conexões internas e quem conduz

Nasce da Agenda + configuração de salas + evento. Não é o card congelado do Painel antigo: a operação vive aqui, na engrenagem.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Não opera esta tela; recebe a certeza (selo / aviso) de que a criança foi recebida.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Equipe da sala trabalha com lista viva, não papel na prancheta.
</div>
</div>
</div>


# Parte D — A casa da família — perfil, trilha e leitura

<div class="screen">

## Quem eu sou nesta casa — Perfil

<p class="route">/perfil</p>

<p class="missing-shot">Recorte original desta parada ainda não está na pasta Screeshot/ ou nos manuais — o roteiro descreve a tela mesmo assim.</p>

### Onde estamos na jornada

Menu lateral, segundo item. A identidade estendida da praça.

### O que se encontra — e por quê

Carteirinha, atalhos para dados cadastrais, família, trilha, reembolsos (RD) e Cantinho da Leitura.

Um único “eu” institucional: não há ficha na secretaria diferente da ficha no celular.

### Conexões internas e quem conduz

`/manage-profile`, `/manage-members`, `/trilha-discipulado`, `/expense-report`. Ghost mostra o alvo, nunca o auditor.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Atualiza a própria vida e vê a trilha andar.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Fonte única. Secretaria complementa; não compete.
</div>
</div>
</div>

<div class="screen">

## A ficha viva — Dados cadastrais

<p class="route">/manage-profile</p>

<p class="missing-shot">Recorte original desta parada ainda não está na pasta Screeshot/ ou nos manuais — o roteiro descreve a tela mesmo assim.</p>

### Onde estamos na jornada

A partir do Perfil.

### O que se encontra — e por quê

Nome, telefone, endereço, foto, campos que a igreja precisa para cuidado e para a tesouraria.

CEP e número evitam “mora perto daquela rua” como endereço oficial.

### Conexões internas e quem conduz

Sincroniza perfil e membro. Cadastro de Usuário (manutenção) é a visão da secretaria sobre a mesma pessoa.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Corrige o próprio cadastro, com dignidade.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Menos retrabalho; telefone novo propaga com cuidado (troca de telefone é fluxo próprio).
</div>
</div>
</div>

<div class="screen">

## O núcleo — Gerenciar família

<p class="route">/manage-members</p>

<p class="missing-shot">Recorte original desta parada ainda não está na pasta Screeshot/ ou nos manuais — o roteiro descreve a tela mesmo assim.</p>

### Onde estamos na jornada

A partir do Perfil. Onde o lar se declara.

### O que se encontra — e por quê

Cônjuge, filhos, congregados do núcleo, aceites, menores. É a mesma família que aparece na Agenda.

Culto, sala e geofence só fazem sentido se o núcleo estiver certo.

### Conexões internas e quem conduz

Recepção Familiar reconhece visitantes. Transferência de Membro move o núcleo entre instâncias.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
A família inteira cabe no celular de um responsável.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Núcleo auditável, sem “filho que só existe no WhatsApp”.
</div>
</div>
</div>

<div class="screen">

## O caminho de formação — Trilha de Discipulado

<p class="route">/trilha-discipulado</p>

<p class="missing-shot">Recorte original desta parada ainda não está na pasta Screeshot/ ou nos manuais — o roteiro descreve a tela mesmo assim.</p>

### Onde estamos na jornada

Perfil e atalhos de formação. Cinco passos, selos coloridos, Perfil Ministerial na etapa 5.1.

### O que se encontra — e por quê

Conteúdo, vídeos, reflexões e progresso visível. Quem conclui 100% aparece em Reconhecimentos.

Discipulado não pode ser pasta de PDF no Drive da liderança.

### Conexões internas e quem conduz

Temas, Reconhecimentos e Reset na engrenagem. Pastoral e Secretaria acompanham; o aluno avança sozinho.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Vê o próximo passo, não uma grade opaca.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Conteúdo versionado por igreja; reset é gesto consciente, não “apaga tudo no banco”.
</div>
</div>
</div>

<div class="screen">

## A estante da casa — Cantinho da Leitura e Livros doados

<p class="route">/perfil (cantinho) · /livros-doados (engrenagem)</p>

<p class="missing-shot">Recorte original desta parada ainda não está na pasta Screeshot/ ou nos manuais — o roteiro descreve a tela mesmo assim.</p>

### Onde estamos na jornada

Membro reserva no Perfil; secretaria opera o acervo na engrenagem.

### O que se encontra — e por quê

Acervo com ISBN, Bipar e CBL, empréstimo, renovação e doação. O cantinho é a vitrine; Livros doados é o balcão.

Livro emprestado “de boca” some. Aqui há data, responsável e renovação.

### Conexões internas e quem conduz

Secretaria gerencia. Membro solicita. Avisos de empréstimo aparecem na faixa do Início.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Descobre, reserva, retira, devolve.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Acervo vivo, não caixa de papelão na sala dos fundos.
</div>
</div>
</div>

<div class="screen">

## Prestação de contas pessoal — Relatório de Despesas

<p class="route">/expense-report</p>

<div class="shots single"><figure><img src="file:///C:/Users/maufr/.cursor/MProj/ecossistema/app-igreja/Screeshot/11.png" alt="11.png" /><figcaption class="shot-cap">Screeshot/11.png</figcaption></figure></div>

### Onde estamos na jornada

Perfil / financeiro do servo que adiantou um gasto da igreja.

### O que se encontra — e por quê

Formulário de RD, comprovantes, tramitação até tesouraria.

Reembolso no Pix pessoal sem papel de verdade vira constrangimento. O RD oficializa.

### Conexões internas e quem conduz

Tesoureiro vê em Informações Financeiras. Parâmetro de contato do tesoureiro dispara aviso.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Pede reembolso com comprovante, sem perseguir tesoureiro no corredor.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Trilha de despesa, não envelope misterioso.
</div>
</div>
</div>


# Parte E — Vida em comunidade — servir, doar e cuidar

<div class="screen">

## O altar digital — Dízimos, ofertas e campanhas

<p class="route">/ofertas</p>

<p class="missing-shot">Recorte original desta parada ainda não está na pasta Screeshot/ ou nos manuais — o roteiro descreve a tela mesmo assim.</p>

### Onde estamos na jornada

Eu quero… → Contribuir. Também campanha identificada.

### O que se encontra — e por quê

Valor com centavos, Pix Copia e Cola, campanha/projeto quando houver. Não mistura dízimo com campanha no mesmo payload.

Transparência: o doador vê o valor; a tesouraria vê o destino.

### Conexões internas e quem conduz

Chave Pix nos parâmetros. Gestão de Campanhas cria o destino. Financeiro de leitura mostra o consolidado depois.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Dá com clareza, no celular, no culto ou em casa.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Identificação de origem, sem “Pix genérico da conta da igreja” como único rastro.
</div>
</div>
</div>

<div class="screen">

## O ouvido da casa — Pedido de oração

<p class="route">/pastoral</p>

<div class="shots single"><figure><img src="file:///C:/Users/maufr/.cursor/MProj/ecossistema/app-igreja/docs/manual-manutencao/screens/m09-cuidado-pastoral.png" alt="m09-cuidado-pastoral.png" /><figcaption class="shot-cap">docs/manual-manutencao/screens/m09-cuidado-pastoral.png</figcaption></figure></div>

### Onde estamos na jornada

Eu quero… → Fazer um pedido de Oração.

### O que se encontra — e por quê

Coração Aberto: o pedido segue à fila pastoral com a identidade da sessão efetiva.

Pedido no grupo da igreja expõe ferida. Aqui o canal é pastoral, não público.

### Conexões internas e quem conduz

Cuidados Pastorais (engrenagem) agenda slot. `/pastoral-history` mostra os pedidos da pessoa.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Fala com a liderança sem plateia.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Fila, histórico e slot — cuidado com nome e data, não recado perdido.
</div>
</div>
</div>

<div class="screen">

## O que eu já entreguei — Meus pedidos

<p class="route">/pastoral-history</p>

<p class="missing-shot">Recorte original desta parada ainda não está na pasta Screeshot/ ou nos manuais — o roteiro descreve a tela mesmo assim.</p>

### Onde estamos na jornada

Continuação do Coração Aberto, para a própria pessoa.

### O que se encontra — e por quê

Histórico dos pedidos da sessão. Não é a fila da equipe.

Quem pediu precisa ver que o pedido não evaporou.

### Conexões internas e quem conduz

Nasce de `/pastoral`. Equipe responde em Cuidados Pastorais.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Acompanha o próprio cuidado.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Separado da mesa de atendimento — menos vazamento entre famílias.
</div>
</div>
</div>

<div class="screen">

## A sala da semana — Minha Célula

<p class="route">/pequeno-grupo</p>

<p class="missing-shot">Recorte original desta parada ainda não está na pasta Screeshot/ ou nos manuais — o roteiro descreve a tela mesmo assim.</p>

### Onde estamos na jornada

Menu do membro. Rota dedicada (não o card congelado do Painel).

### O que se encontra — e por quê

Grupo, anfitrião, líder, participantes, datas. Botão Novo grupo na gestão não reaproveita o cadastro do grupo já selecionado.

Célula é pastoral de proximidade. Precisa de data real, não “toda terça, eu acho”.

### Conexões internas e quem conduz

Gestão de Pequenos Grupos na engrenagem. Régua D+4 aponta para célula após a recepção.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Sabe onde é, com quem é, quando é.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Líder e anfitrião distintos; participantes sem misturar papéis.
</div>
</div>
</div>

<div class="screen">

## Minha vez de servir — Escalas

<p class="route">/escalas</p>

<div class="shots single"><figure><img src="file:///C:/Users/maufr/.cursor/MProj/ecossistema/app-igreja/docs/manual-manutencao/screens/m08-programacao-escalas.png" alt="m08-programacao-escalas.png" /><figcaption class="shot-cap">docs/manual-manutencao/screens/m08-programacao-escalas.png</figcaption></figure></div>

### Onde estamos na jornada

Menu do membro.

### O que se encontra — e por quê

A escala em que a pessoa está, com possibilidade de troca pontual quando a igreja libera o fluxo.

Servir sem surpresa de última hora no grupo da escala.

### Conexões internas e quem conduz

Tipos, Servos em Disponibilidade e Programação de Escalas na engrenagem. Avisos de troca aparecem no Início.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Vê o próprio dia de servir e pede troca com dignidade.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Grade oficial; substituição combinada, não “chama fulano no palco”.
</div>
</div>
</div>

<div class="screen">

## Onde meus dons cabem — Mural de Oportunidades

<p class="route">/mural-oportunidades</p>

<p class="missing-shot">Recorte original desta parada ainda não está na pasta Screeshot/ ou nos manuais — o roteiro descreve a tela mesmo assim.</p>

### Onde estamos na jornada

Menu do membro. Rota dedicada.

### O que se encontra — e por quê

Vagas de voluntariado publicadas pela igreja. O membro se oferece.

Dons não devem depender de quem o líder lembra no corredor.

### Conexões internas e quem conduz

Mural de Voluntários (manutenção) publica e mede. Avisos de vaga no Início.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Candidata-se sem pedir “um minutinho” depois do culto.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Vagas visíveis, respostas rastreáveis.
</div>
</div>
</div>

<div class="screen">

## Empréstimo entre irmãos — Mural de Generosidade

<p class="route">/mural-generosidade</p>

<p class="missing-shot">Recorte original desta parada ainda não está na pasta Screeshot/ ou nos manuais — o roteiro descreve a tela mesmo assim.</p>

### Onde estamos na jornada

Menu do membro.

### O que se encontra — e por quê

Doações e pedidos de empréstimo entre a comunidade, com moderação.

Generosidade visível demais vira leilão; escondida demais vira exclusão. O mural equilibra.

### Conexões internas e quem conduz

Moderação do Mural na engrenagem. Avisos no Início.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Pede ou oferece com mediação da igreja.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Modera conteúdo, não deixa o mural virar classificados sem pastor.
</div>
</div>
</div>

<div class="screen">

## Fale com a casa — Sugestões e melhorias

<p class="route">Menu · também painel de manutenção para a equipe</p>

<p class="missing-shot">Recorte original desta parada ainda não está na pasta Screeshot/ ou nos manuais — o roteiro descreve a tela mesmo assim.</p>

### Onde estamos na jornada

Menu do membro (g) e engrenagem para quem trata o chamado.

### O que se encontra — e por quê

Canal de ideia, elogio e problema, com anexo de imagem se a permissão permitir.

Reclamação só no grupo da liderança não vira melhoria. Aqui vira fila.

### Conexões internas e quem conduz

Equipe responde no painel. ACL define quem vê o backlog.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Contribui com a ferramenta e com a operação, sem constranger no corredor.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Backlog único, priorizável.
</div>
</div>
</div>

<div class="screen">

## A voz pública — Redes sociais

<p class="route">/redes-sociais</p>

<p class="missing-shot">Recorte original desta parada ainda não está na pasta Screeshot/ ou nos manuais — o roteiro descreve a tela mesmo assim.</p>

### Onde estamos na jornada

Menu do membro.

### O que se encontra — e por quê

Atalhos oficiais das redes da igreja, para ninguém cair em perfil fã.

Marca e cuidado: o link certo, não o primeiro que o Google mostrar.

### Conexões internas e quem conduz

Parâmetros/conteúdo institucional. Sobre o Conecta+ conta a plataforma; redes contam a igreja.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Segue a casa certa.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Atualiza destinos sem publicar app novo.
</div>
</div>
</div>

<div class="screen">

## Quem nos hospeda — Sobre o Conecta+

<p class="route">/sobre-conecta</p>

<div class="shots"><figure><img src="file:///C:/Users/maufr/.cursor/MProj/ecossistema/app-igreja/images/conecta.png" alt="conecta.png" /><figcaption class="shot-cap">images/conecta.png</figcaption></figure>
<figure><img src="file:///C:/Users/maufr/.cursor/MProj/ecossistema/app-igreja/images/IBNORTE%20-%20LOGO%20MARCA%209.png" alt="IBNORTE - LOGO MARCA 9.png" /><figcaption class="shot-cap">images/IBNORTE - LOGO MARCA 9.png</figcaption></figure></div>

### Onde estamos na jornada

Menu do membro, último item de autonomia.

### O que se encontra — e por quê

Identidade da plataforma, versão, declaração de privacidade, créditos. Não é o site da igreja; é o contrato da ferramenta.

Transparência de software numa casa de fé: de quem é o app, o que ele faz com dados, qual revisão está no ar.

### Conexões internas e quem conduz

LGPD, autorização de mídia, parâmetros de versão.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Entende a casa digital além da logomarca local.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Documento vivo de privacidade, versionado com o deploy.
</div>
</div>
</div>

<div class="screen">

## As contas à luz — Financeiro (leitura)

<p class="route">/financial</p>

<div class="shots single"><figure><img src="file:///C:/Users/maufr/.cursor/MProj/ecossistema/app-igreja/docs/manual-manutencao/screens/m10-financeiro-manut.png" alt="m10-financeiro-manut.png" /><figcaption class="shot-cap">docs/manual-manutencao/screens/m10-financeiro-manut.png</figcaption></figure></div>

### Onde estamos na jornada

Menu do membro, conforme ACL. Não é a tesouraria operacional.

### O que se encontra — e por quê

Visão de leitura: resultado, comparativos, o que a igreja escolheu tornar visível à comunidade ou à liderança de leitura.

Transparência sem entregar o extrato bancário cru a todos.

### Conexões internas e quem conduz

Informações Financeiras (engrenagem) alimenta. Tesoureiro opera lá; aqui se contempla.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Confia porque vê, no nível que o papel permite.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Separa operação (lançar) de prestação (mostrar).
</div>
</div>
</div>

<div class="screen">

## O diretório — Lista de membros

<p class="route">/membros</p>

<p class="missing-shot">Recorte original desta parada ainda não está na pasta Screeshot/ ou nos manuais — o roteiro descreve a tela mesmo assim.</p>

### Onde estamos na jornada

Engrenagem → Pessoas (e atalhos de liderança).

### O que se encontra — e por quê

Pessoas da casa, com recortes de família e visitantes conforme o papel. Gestor de Controle de Acesso nunca vê Super Administrador.

Cuidado pastoral precisa de nomes certos, não de agenda telefônica pessoal do líder.

### Conexões internas e quem conduz

Cadastro de Usuário, papéis, mapa, aniversariantes. Ghost simula o olhar de um perfil-alvo.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Em geral não navega o diretório completo; vê a própria família.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Diretório oficial, filtrado por papel, com blindagem do Super Administrador.
</div>
</div>
</div>

<div class="screen">

## Parabéns com nome — Aniversariantes

<p class="route">/aniversariantes</p>

<p class="missing-shot">Recorte original desta parada ainda não está na pasta Screeshot/ ou nos manuais — o roteiro descreve a tela mesmo assim.</p>

### Onde estamos na jornada

Engrenagem → Pessoas.

### O que se encontra — e por quê

Quem faz anos no período, para a igreja cumprimentar de propósito.

Aniversário no grupo genérico esquece quem está na borda. A lista oficial não esquece.

### Conexões internas e quem conduz

Nasce de data de nascimento no cadastro. Pastoral e recepção usam.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
É visto. Isso já é cuidado.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Agenda de afeto operacional.
</div>
</div>
</div>

<div class="screen">

## A cidade da igreja — Mapa de geolocalização

<p class="route">/mapa-geolocalizacao</p>

<p class="missing-shot">Recorte original desta parada ainda não está na pasta Screeshot/ ou nos manuais — o roteiro descreve a tela mesmo assim.</p>

### Onde estamos na jornada

Engrenagem → Pessoas. Pins de famílias, não rastreador em tempo real do culto (isso é geofence de evento).

### O que se encontra — e por quê

Mapa com famílias que autorizaram endereço. Detalhe de pin é restrito ao papel.

Visita pastoral e células de bairro precisam de geografia, não de planilha de CEP.

### Conexões internas e quem conduz

Endereço do cadastro. Distinto do geofence de check-in (raio do templo no dia do evento).

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Não é vigiado: é encontrado para cuidado, no nível de privacidade configurado.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Mapa pastoral com ACL no detalhe do pin.
</div>
</div>
</div>

<div class="screen">

## Os papéis da instituição — Administrativo

<p class="route">/administrativo</p>

<p class="missing-shot">Recorte original desta parada ainda não está na pasta Screeshot/ ou nos manuais — o roteiro descreve a tela mesmo assim.</p>

### Onde estamos na jornada

Engrenagem → Pessoas. Atos constitutivos e documentos da igreja.

### O que se encontra — e por quê

Estatuto, atas, documentos que a liderança precisa ter à mão, não em gaveta de secretaria.

Governança visível. A igreja digital também tem personalidade jurídica.

### Conexões internas e quem conduz

Papéis ACL. Não confundir com Informações Financeiras.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Membro típico não opera; liderança consulta.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Repositório oficial, versionado na prática da casa.
</div>
</div>
</div>

<div class="screen">

## Rosto e voz — Autorização de imagem

<p class="route">/autorizacao-midia · /autorizacao-midia-confirmar</p>

<p class="missing-shot">Recorte original desta parada ainda não está na pasta Screeshot/ ou nos manuais — o roteiro descreve a tela mesmo assim.</p>

### Onde estamos na jornada

Engrenagem → Operação, e e-mail de confirmação.

### O que se encontra — e por quê

Termo de imagem e voz, aceite, confirmação por e-mail. A transmissão do culto deixa de ser um “todo mundo já sabe”.

LGPD aplicada ao culto filmado.

### Conexões internas e quem conduz

LGPD geral, Sobre o Conecta+, parâmetros de URL pública.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Decide com clareza se seu rosto entra na transmissão.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Prova de autorização, não suposição pastoral.
</div>
</div>
</div>

<div class="screen">

## O mural da praça — Avisos

<p class="route">/avisos · faixa no Início</p>

<div class="shots single"><figure><img src="file:///C:/Users/maufr/.cursor/MProj/ecossistema/app-igreja/Screeshot/2-1.png" alt="2-1.png" /><figcaption class="shot-cap">Screeshot/2-1.png</figcaption></figure></div>

### Onde estamos na jornada

Pager do Início e rota dedicada. Conteúdo publicado pela Manutenção de Avisos.

### O que se encontra — e por quê

Comunicados do culto, pastoral, campanha, livros, escalas — tudo o que a casa precisa gritar com educação.

Aviso só no púlpito some na terça. Aviso no Início permanece.

### Conexões internas e quem conduz

`event_avisos`, avisos de pastoral, campanha, oportunidades, generosidade, empréstimos, troca de escala.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Lê no celular o que ouviu (ou perdeu) no culto.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Um lugar para publicar; vários canais deixam de competir.
</div>
</div>
</div>


# Parte F — A engrenagem — operação do templo

<div class="screen">

## A porta dos fundos — Engrenagem

<p class="route">/maintenance-dashboard</p>

<div class="shots"><figure><img src="file:///C:/Users/maufr/.cursor/MProj/ecossistema/app-igreja/docs/manual-manutencao/screens/m00-acesso-engrenagem.png" alt="m00-acesso-engrenagem.png" /><figcaption class="shot-cap">docs/manual-manutencao/screens/m00-acesso-engrenagem.png</figcaption></figure>
<figure><img src="file:///C:/Users/maufr/.cursor/MProj/ecossistema/app-igreja/docs/manual-manutencao/screens/m01-menu-modulos.png" alt="m01-menu-modulos.png" /><figcaption class="shot-cap">docs/manual-manutencao/screens/m01-menu-modulos.png</figcaption></figure></div>

### Onde estamos na jornada

Ícone de engrenagem no Início, só para papéis de operação. Cinco grupos: Operação, Pessoas, Culto, Finanças, Governança.

### O que se encontra — e por quê

O índice da manutenção. Cada linha abre um painel com ACL própria. Falha fechada: sem grant, a tela não mente que existe.

O membro não deve tropeçar em Relatórios. A liderança não deve caçar a tela no carrossel antigo.

### Conexões internas e quem conduz

Todos os painéis abaixo. Ghost, papéis e Gestor de Controle de Acesso regulam o que aparece.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Não entra, salvo missão específica (ex.: voluntário de sala).
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Mapa mental da operação, agrupado como a igreja pensa — não como o banco pensa.
</div>
</div>
</div>


# Parte G — Pessoas — recepção, pastoral e cadastros

<div class="screen">

## O abraço na porta — Recepção Familiar

<p class="route">/maintenance-dashboard?panel=family_reception</p>

<div class="shots"><figure><img src="file:///C:/Users/maufr/.cursor/MProj/ecossistema/app-igreja/Screeshot/maintenance-dashboard-panel-family_reception.png" alt="maintenance-dashboard-panel-family_reception.png" /><figcaption class="shot-cap">Screeshot/maintenance-dashboard-panel-family_reception.png</figcaption></figure>
<figure><img src="file:///C:/Users/maufr/.cursor/MProj/ecossistema/app-igreja/docs/manual-manutencao/screens/m13-recepcao-familiar.png" alt="m13-recepcao-familiar.png" /><figcaption class="shot-cap">docs/manual-manutencao/screens/m13-recepcao-familiar.png</figcaption></figure></div>

### Onde estamos na jornada

Engrenagem → Pessoas. Domingo de manhã, mesa da recepção.

### O que se encontra — e por quê

Convite WhatsApp com nome e celular (DDD), mesmo que o número não esteja nos contatos. Campos limpos a cada família (X). Aceite do núcleo dispara a Régua.

Visitante não é “fulano que veio”. É uma família a ser reconhecida.

### Conexões internas e quem conduz

Cadastro familiar público, `initialize_visitor_followup_regua`, Lista de membros, papéis visitantes/congregado.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
É recebido com nome, não com ficha fria — e pode cadastrar no próprio celular.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Fila de aceite, WhatsApp padronizado, ponte oficial para o acolhimento D+1/D+4/D+8.
</div>
</div>
</div>

<div class="screen">

## Ninguém some na segunda — Régua de Acolhimento

<p class="route">/maintenance-dashboard?panel=visitor_followup</p>

<div class="shots single"><figure><img src="file:///C:/Users/maufr/.cursor/MProj/ecossistema/app-igreja/Screeshot/maintenance-dashboard-panel-visitor_followup.png" alt="maintenance-dashboard-panel-visitor_followup.png" /><figcaption class="shot-cap">Screeshot/maintenance-dashboard-panel-visitor_followup.png</figcaption></figure></div>

### Onde estamos na jornada

Engrenagem → Pessoas. Depois do aceite na Recepção.

### O que se encontra — e por quê

Passos D+1 (WhatsApp), D+4 (célula), D+8 (culto). Cada passo se conclui; a origem é a Recepção Familiar.

O visitante que “foi bem recebido” e nunca mais ouviu a igreja é um buraco pastoral. A régua fecha o buraco.

### Conexões internas e quem conduz

Recepção, Pequenos Grupos, Agenda. Papel pastoral/secretaria executa; o sistema lembra.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Sente que a casa lembrou — sem stalking amador.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Procedimento visível, não heroísmo de um diácono com caderninho.
</div>
</div>
</div>

<div class="screen">

## A mesa da secretaria — Cadastro de Usuário

<p class="route">/maintenance-dashboard?panel=profile_cadastro</p>

<div class="shots single"><figure><img src="file:///C:/Users/maufr/.cursor/MProj/ecossistema/app-igreja/docs/manual-manutencao/screens/m12-cadastro-usuario.png" alt="m12-cadastro-usuario.png" /><figcaption class="shot-cap">docs/manual-manutencao/screens/m12-cadastro-usuario.png</figcaption></figure></div>

### Onde estamos na jornada

Engrenagem → Pessoas.

### O que se encontra — e por quê

Edição administrativa do perfil: o que o membro não completa sozinho, a secretaria termina aqui.

Autonomia do membro não elimina o ofício da secretaria. Elimina a planilha paralela.

### Conexões internas e quem conduz

Lista de membros, papéis, família, LGPD.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Pode ser convidado a completar no Perfil; a secretaria não compete, complementa.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Ofício digital com a mesma ficha que o membro vê.
</div>
</div>
</div>

<div class="screen">

## A agenda do cuidado — Cuidados Pastorais

<p class="route">/maintenance-dashboard?panel=pastoral_care</p>

<div class="shots single"><figure><img src="file:///C:/Users/maufr/.cursor/MProj/ecossistema/app-igreja/docs/manual-manutencao/screens/m09-cuidado-pastoral.png" alt="m09-cuidado-pastoral.png" /><figcaption class="shot-cap">docs/manual-manutencao/screens/m09-cuidado-pastoral.png</figcaption></figure></div>

### Onde estamos na jornada

Engrenagem → Pessoas.

### O que se encontra — e por quê

Fila de pedidos, slots de atendimento, histórico da equipe.

Pastoral sem agenda vira corredor eterno. Slot é respeito ao sofrimento e ao calendário.

### Conexões internas e quem conduz

`/pastoral` alimenta. Avisos de slot no Início. Papel pastoral opera.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
É chamado no horário, não “depois do culto a gente vê”.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Mesa de atendimento com fila e registro.
</div>
</div>
</div>

<div class="screen">

## Quem pastoreia o grupo — Gestão de Pequenos Grupos

<p class="route">/maintenance-dashboard?panel=small_groups_management</p>

<p class="missing-shot">Recorte original desta parada ainda não está na pasta Screeshot/ ou nos manuais — o roteiro descreve a tela mesmo assim.</p>

### Onde estamos na jornada

Engrenagem → Pessoas.

### O que se encontra — e por quê

CRUD de grupos, anfitrião e líder em buscas separadas, participantes, novo grupo sem reaproveitar o anterior por engano.

Célula misturada com “lista de quem vai no churrasco” perde a alma. Aqui há papéis.

### Conexões internas e quem conduz

`/pequeno-grupo` do membro. Régua D+4.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Vê o grupo certo no menu Minha Célula.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Liderança e hospedagem distintas; datas reais.
</div>
</div>
</div>

<div class="screen">

## A vitrine de servir — Mural de Voluntários (manutenção)

<p class="route">/maintenance-dashboard?panel=volunteer_mural</p>

<p class="missing-shot">Recorte original desta parada ainda não está na pasta Screeshot/ ou nos manuais — o roteiro descreve a tela mesmo assim.</p>

### Onde estamos na jornada

Engrenagem → Pessoas.

### O que se encontra — e por quê

Publicação e gestão das vagas que o membro vê em Mural de Oportunidades.

Vaga sem dono na manutenção vira cartaz eterno na parede.

### Conexões internas e quem conduz

`/mural-oportunidades`. Avisos no Início.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Encontra vaga viva.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Abre, fecha e mede interesse.
</div>
</div>
</div>

<div class="screen">

## O filtro do afeto — Moderação do Mural de Generosidade

<p class="route">/maintenance-dashboard?panel=generosity_moderation</p>

<p class="missing-shot">Recorte original desta parada ainda não está na pasta Screeshot/ ou nos manuais — o roteiro descreve a tela mesmo assim.</p>

### Onde estamos na jornada

Engrenagem → Pessoas.

### O que se encontra — e por quê

Aprova, recusa, acompanha doações e empréstimos entre irmãos.

Sem moderação, o mural vira risco relacional e jurídico.

### Conexões internas e quem conduz

`/mural-generosidade`.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Confia que a igreja viu o anúncio.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Pastoreia o marketplace interno.
</div>
</div>
</div>


# Parte H — Culto e escalas — programar o domingo

<div class="screen">

## O domingo no calendário — Programação de Eventos

<p class="route">/maintenance-dashboard?panel=events</p>

<div class="shots"><figure><img src="file:///C:/Users/maufr/.cursor/MProj/ecossistema/app-igreja/docs/manual-manutencao/screens/m02-programacao-eventos.png" alt="m02-programacao-eventos.png" /><figcaption class="shot-cap">docs/manual-manutencao/screens/m02-programacao-eventos.png</figcaption></figure>
<figure><img src="file:///C:/Users/maufr/.cursor/MProj/ecossistema/app-igreja/docs/manual-manutencao/screens/m03-editor-evento.png" alt="m03-editor-evento.png" /><figcaption class="shot-cap">docs/manual-manutencao/screens/m03-editor-evento.png</figcaption></figure></div>

### Onde estamos na jornada

Engrenagem → Culto. Onde o culto vira objeto de operação.

### O que se encontra — e por quê

Nome, data/hora (mesmo seletor da gestão de células), local favorito, capacidade, totem, quórum, somente membros, salas, ofertas e o interruptor Check-in automático (geofence). Sem coordenadas no local, o interruptor não grava.

Culto não é um post. É capacidade, presença, criança, Pix e perímetro.

### Conexões internas e quem conduz

Agenda da Família, geofence, totem, avisos, replicar estrutura, purge de check-ins se o evento geofence mudar o que importa.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Vê o evento na praça, com vagas e local.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Um cadastro dispara a operação inteira do domingo.
</div>
</div>
</div>

<div class="screen">

## O ano em barras — Cronograma de Eventos

<p class="route">/maintenance-dashboard?panel=events_gantt</p>

<div class="shots single"><figure><img src="file:///C:/Users/maufr/.cursor/MProj/ecossistema/app-igreja/docs/manual-manutencao/screens/m04-cronograma.png" alt="m04-cronograma.png" /><figcaption class="shot-cap">docs/manual-manutencao/screens/m04-cronograma.png</figcaption></figure></div>

### Onde estamos na jornada

Engrenagem → Culto.

### O que se encontra — e por quê

Linha do tempo dos eventos, para a liderança enxergar choque de calendário.

Dois grandes eventos no mesmo sábado aparecem aqui antes de aparecerem como crise.

### Conexões internas e quem conduz

Programação de Eventos.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Não opera.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Planejamento visual da casa.
</div>
</div>
</div>

<div class="screen">

## O megafone — Manutenção de Avisos

<p class="route">/maintenance-dashboard?panel=event_orchestration</p>

<div class="shots"><figure><img src="file:///C:/Users/maufr/.cursor/MProj/ecossistema/app-igreja/Screeshot/2-1.png" alt="2-1.png" /><figcaption class="shot-cap">Screeshot/2-1.png</figcaption></figure>
<figure><img src="file:///C:/Users/maufr/.cursor/MProj/ecossistema/app-igreja/docs/manual-manutencao/screens/m01-menu-modulos.png" alt="m01-menu-modulos.png" /><figcaption class="shot-cap">docs/manual-manutencao/screens/m01-menu-modulos.png</figcaption></figure></div>

### Onde estamos na jornada

Engrenagem → Culto.

### O que se encontra — e por quê

Redige e publica o que a faixa Avisos do Início vai mostrar.

Aviso oral-only é evangelho de curto prazo. Aviso publicado é cuidado contínuo.

### Conexões internas e quem conduz

Início pager Avisos, `/avisos`.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Lê na praça.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Publica uma vez, alcança todos os papéis que devem ver.
</div>
</div>
</div>

<div class="screen">

## Os ofícios — Tipos de escala

<p class="route">/maintenance-dashboard?panel=scale_types</p>

<div class="shots single"><figure><img src="file:///C:/Users/maufr/.cursor/MProj/ecossistema/app-igreja/docs/manual-manutencao/screens/m06-tipos-escala.png" alt="m06-tipos-escala.png" /><figcaption class="shot-cap">docs/manual-manutencao/screens/m06-tipos-escala.png</figcaption></figure></div>

### Onde estamos na jornada

Engrenagem → Culto.

### O que se encontra — e por quê

Define os tipos (louvor, recepção, mídia…). Sem tipo, não há grade.

Escala “do pessoal do som” sem nome vira panelinha.

### Conexões internas e quem conduz

Servos em Disponibilidade, Programação, `/escalas`.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Vê o ofício com nome.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Taxonomia do servir.
</div>
</div>
</div>

<div class="screen">

## Quem pode ser chamado — Servos em Disponibilidade

<p class="route">/maintenance-dashboard?panel=scale_volunteers</p>

<div class="shots single"><figure><img src="file:///C:/Users/maufr/.cursor/MProj/ecossistema/app-igreja/docs/manual-manutencao/screens/m07-servos-disponibilidade.png" alt="m07-servos-disponibilidade.png" /><figcaption class="shot-cap">docs/manual-manutencao/screens/m07-servos-disponibilidade.png</figcaption></figure></div>

### Onde estamos na jornada

Engrenagem → Culto.

### O que se encontra — e por quê

Pool de pessoas por tipo de escala.

Não se escala quem não se dispôs — e não se esquece quem se dispôs.

### Conexões internas e quem conduz

Tipos, Programação, mural de vagas.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Disponibilidade vira convite concreto.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Pool oficial, não memória do líder de ministério.
</div>
</div>
</div>

<div class="screen">

## A grade da semana — Programação de Escalas

<p class="route">/maintenance-dashboard?panel=scales</p>

<div class="shots single"><figure><img src="file:///C:/Users/maufr/.cursor/MProj/ecossistema/app-igreja/docs/manual-manutencao/screens/m08-programacao-escalas.png" alt="m08-programacao-escalas.png" /><figcaption class="shot-cap">docs/manual-manutencao/screens/m08-programacao-escalas.png</figcaption></figure></div>

### Onde estamos na jornada

Engrenagem → Culto.

### O que se encontra — e por quê

Monta quem serve quando. Trocas pontuais nascem daqui para o membro em `/escalas`.

Domingo sem grade é improviso no púlpito.

### Conexões internas e quem conduz

Ciclos, avisos de swap, menu Escalas.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Recebe a escala no celular.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Publica a grade e acompanha substituições.
</div>
</div>
</div>

<div class="screen">

## O livro de presença — Quórum

<p class="route">/maintenance-dashboard?panel=quorum_presence</p>

<div class="shots single"><figure><img src="file:///C:/Users/maufr/.cursor/MProj/ecossistema/app-igreja/docs/manual-manutencao/screens/m11-lista-presenca.png" alt="m11-lista-presenca.png" /><figcaption class="shot-cap">docs/manual-manutencao/screens/m11-lista-presenca.png</figcaption></figure></div>

### Onde estamos na jornada

Engrenagem → Culto, quando o evento exige quórum.

### O que se encontra — e por quê

Lista de presença oficial. Audiência individual, cadeado após check-in no totem.

Assembleia e reuniões que exigem quórum não podem viver de lista de WhatsApp.

### Conexões internas e quem conduz

Evento `requer_quorum`, totem, Agenda (modo quórum).

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Marca a si; não marca o primo. Depois do totem, não desmarca.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Ata de presença com trilha.
</div>
</div>
</div>

<div class="screen">

## A tela do hall — Orquestrador

<p class="route">/admin/orquestrador</p>

<div class="shots single"><figure><img src="file:///C:/Users/maufr/.cursor/MProj/ecossistema/app-igreja/Screeshot/2-1.png" alt="2-1.png" /><figcaption class="shot-cap">Screeshot/2-1.png</figcaption></figure></div>

### Onde estamos na jornada

Engrenagem → Culto. Avisos em tela cheia para TV/totem de mensagem.

### O que se encontra — e por quê

Painel de comunicados em formato de palco, não de celular.

O hall precisa de uma voz visual única enquanto o culto acontece.

### Conexões internas e quem conduz

Avisos publicados. Distinto do totem de QR.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Lê no monitor do corredor.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Dirige a comunicação presencial.
</div>
</div>
</div>


# Parte I — Finanças e inteligência

<div class="screen">

## O livro-caixa digital — Informações Financeiras

<p class="route">/maintenance-dashboard?panel=financials</p>

<div class="shots single"><figure><img src="file:///C:/Users/maufr/.cursor/MProj/ecossistema/app-igreja/docs/manual-manutencao/screens/m10-financeiro-manut.png" alt="m10-financeiro-manut.png" /><figcaption class="shot-cap">docs/manual-manutencao/screens/m10-financeiro-manut.png</figcaption></figure></div>

### Onde estamos na jornada

Engrenagem → Finanças. Tesoureiro.

### O que se encontra — e por quê

Extratos, resultado, comparativo, 12 meses, orçamento, saldo, RD. Onde se lança e se concilia.

Tesouraria amadora vive de planilha. Aqui a prestação e a operação se encontram.

### Conexões internas e quem conduz

`/financial` (leitura), `/expense-report`, campanhas, preditivo.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Vê o que o papel permite em Financeiro de leitura.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Opera com trilha, não com “confia no tesoureiro”.
</div>
</div>
</div>

<div class="screen">

## O destino do extra — Gestão de Campanhas

<p class="route">/maintenance-dashboard?panel=campaigns_management</p>

<p class="missing-shot">Recorte original desta parada ainda não está na pasta Screeshot/ ou nos manuais — o roteiro descreve a tela mesmo assim.</p>

### Onde estamos na jornada

Engrenagem → Finanças.

### O que se encontra — e por quê

Cria campanhas e projetos que o Eu quero… oferece com Pix identificado.

Campanha misturada no dízimo some no caixa único.

### Conexões internas e quem conduz

`/ofertas?campaignId=`. Avisos de campanha no Início.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Dá para um propósito nomeado.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Propósito, prazo e identificação no Pix.
</div>
</div>
</div>

<div class="screen">

## O horizonte — Modelo preditivo

<p class="route">/maintenance-dashboard?panel=predictive_insights</p>

<div class="shots single"><figure><img src="file:///C:/Users/maufr/.cursor/MProj/ecossistema/app-igreja/docs/manual-manutencao/screens/m10-financeiro-manut.png" alt="m10-financeiro-manut.png" /><figcaption class="shot-cap">docs/manual-manutencao/screens/m10-financeiro-manut.png</figcaption></figure></div>

### Onde estamos na jornada

Engrenagem → Finanças. Pacote avançado.

### O que se encontra — e por quê

Sinais de tendência para a liderança, não bola de cristal pública.

Governança antecipa caixa e cuidado; não espera o susto do mês.

### Conexões internas e quem conduz

Informações Financeiras, papéis de tesouraria/SA.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Não opera.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Lê tendência com responsabilidade, sem expor família na vitrine.
</div>
</div>
</div>


# Parte J — Governança, papéis e Aliança

<div class="screen">

## A apostila viva — Temas da Trilha

<p class="route">/maintenance-dashboard?panel=discipleship_themes</p>

<p class="missing-shot">Recorte original desta parada ainda não está na pasta Screeshot/ ou nos manuais — o roteiro descreve a tela mesmo assim.</p>

### Onde estamos na jornada

Engrenagem → Governança.

### O que se encontra — e por quê

Textos, vídeos e reflexões dos passos que o aluno vê em `/trilha-discipulado`.

Conteúdo de formação não pode viver só no YouTube solto.

### Conexões internas e quem conduz

Trilha do membro, reconhecimentos, reset.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Recebe material da casa, no passo certo.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Edita a formação sem republicar o app.
</div>
</div>
</div>

<div class="screen">

## O diploma pastoral — Reconhecimentos

<p class="route">/maintenance-dashboard?panel=discipleship_alerts</p>

<p class="missing-shot">Recorte original desta parada ainda não está na pasta Screeshot/ ou nos manuais — o roteiro descreve a tela mesmo assim.</p>

### Onde estamos na jornada

Engrenagem → Governança.

### O que se encontra — e por quê

Alunos 100% prontos para certificado.

Conclusão invisível desanima. Reconhecimento é liturgia de formação.

### Conexões internas e quem conduz

Trilha. Pastoral celebra; o sistema avisa.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
É visto no fim do caminho.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Lista pronta para culto de envio ou certificado.
</div>
</div>
</div>

<div class="screen">

## Recomeçar com testemunha — Resetar Trilha

<p class="route">/maintenance-dashboard?panel=discipleship_reset</p>

<p class="missing-shot">Recorte original desta parada ainda não está na pasta Screeshot/ ou nos manuais — o roteiro descreve a tela mesmo assim.</p>

### Onde estamos na jornada

Engrenagem → Governança. Gesto raro.

### O que se encontra — e por quê

Reinicia progresso de um usuário nesta igreja.

Erro de percurso ou nova temporada pastoral. Nunca um delete silencioso.

### Conexões internas e quem conduz

Trilha do alvo. Auditoria implícita no ofício.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Só ocorre com conversa pastoral, não por bug de tela.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Ferramenta consciente, não botão de pânico.
</div>
</div>
</div>

<div class="screen">

## O observatório — Relatórios

<p class="route">/maintenance-dashboard?panel=relatorios</p>

<div class="shots single"><figure><img src="file:///C:/Users/maufr/.cursor/MProj/ecossistema/app-igreja/docs/manual-manutencao/screens/m11-lista-presenca.png" alt="m11-lista-presenca.png" /><figcaption class="shot-cap">docs/manual-manutencao/screens/m11-lista-presenca.png</figcaption></figure></div>

### Onde estamos na jornada

Engrenagem → Governança.

### O que se encontra — e por quê

Consultas oficiais (presença, geofence vs totem, pessoas, etc.) sem exportar o banco inteiro para Excel de alguém.

Decisão pastoral e assemblear precisa de número com dono.

### Conexões internas e quem conduz

Check-ins, membros, finanças. ACL por relatório.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Não opera.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Enxerga a casa com o mesmo sistema que a opera.
</div>
</div>
</div>

<div class="screen">

## Quem abre qual porta — Controle de Acesso

<p class="route">/maintenance-dashboard?panel=access_control</p>

<div class="shots single"><figure><img src="file:///C:/Users/maufr/.cursor/MProj/ecossistema/app-igreja/docs/manual-manutencao/screens/m14-controle-acesso.png" alt="m14-controle-acesso.png" /><figcaption class="shot-cap">docs/manual-manutencao/screens/m14-controle-acesso.png</figcaption></figure></div>

### Onde estamos na jornada

Engrenagem → Governança. Super Administrador na UI; SQL também protege o Gestor.

### O que se encontra — e por quê

Matriz de grants, papéis vivos (visitantes, congregado, member, family_acceptor, secretaria, tesoureiro, pastoral, gestor_controle_acesso, super_admin), aba Pessoas por papel. Gestor não vê Super Administrador, nem PIN.

Igreja digital sem ACL vira grupo de WhatsApp com superpoderes. Papel é teologia de responsabilidade.

### Conexões internas e quem conduz

Todos os menus. Mudança de Papéis executa; esta tela desenha. Ghost testa o olhar.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Só vê o que o papel permite — e isso é proteção, não castigo.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Matriz viva, pessoas por papel, blindagem do Super Administrador.
</div>
</div>
</div>

<div class="screen">

## A imposição de mãos digital — Mudança de Papéis

<p class="route">/maintenance-dashboard?panel=mudanca_papeis</p>

<div class="shots single"><figure><img src="file:///C:/Users/maufr/.cursor/MProj/ecossistema/app-igreja/docs/manual-manutencao/screens/m15-mudanca-papeis.png" alt="m15-mudanca-papeis.png" /><figcaption class="shot-cap">docs/manual-manutencao/screens/m15-mudanca-papeis.png</figcaption></figure></div>

### Onde estamos na jornada

Engrenagem → Governança.

### O que se encontra — e por quê

Atribui ou retira papéis de uma pessoa concreta.

Liderança muda. O app tem de mudar com cerimônia, não com update escondido.

### Conexões internas e quem conduz

Controle de Acesso, Lista de membros. Gestor não edita Super Administrador.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Ganha ou perde telas conforme o chamado.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Ofício de papel com rastro.
</div>
</div>
</div>

<div class="screen">

## Carta de mudança — Transferência de Membro

<p class="route">/maintenance-dashboard?panel=transferencia_igreja</p>

<div class="shots single"><figure><img src="file:///C:/Users/maufr/.cursor/MProj/ecossistema/app-igreja/docs/manual-manutencao/screens/m12-cadastro-usuario.png" alt="m12-cadastro-usuario.png" /><figcaption class="shot-cap">docs/manual-manutencao/screens/m12-cadastro-usuario.png</figcaption></figure></div>

### Onde estamos na jornada

Engrenagem → Governança. Rede multi-igreja.

### O que se encontra — e por quê

Move o vínculo da pessoa entre instâncias da casa.

Membro que muda de cidade não deve nascer de novo como visitante eterno.

### Conexões internas e quem conduz

Instâncias, cadastro, papéis.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Continua conhecido na nova casa.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Traslada, não duplica.
</div>
</div>
</div>

<div class="screen">

## O diário de bordo — Acessos de Usuários

<p class="route">/maintenance-dashboard?panel=profile_access_insights</p>

<div class="shots single"><figure><img src="file:///C:/Users/maufr/.cursor/MProj/ecossistema/app-igreja/docs/manual-manutencao/screens/m16-acessos-usuarios.png" alt="m16-acessos-usuarios.png" /><figcaption class="shot-cap">docs/manual-manutencao/screens/m16-acessos-usuarios.png</figcaption></figure></div>

### Onde estamos na jornada

Engrenagem → Governança.

### O que se encontra — e por quê

Insights de telas visitadas, para formação e suporte — não para bisbilhotar devoção.

Saber que a trilha não é usada é pastoral de produto. Saber o conteúdo da oração de alguém não é.

### Conexões internas e quem conduz

ACL, Ghost. Gestor sem Super Administrador.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Não é um ranking público.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Enxerga adoção de telas para treinar melhor.
</div>
</div>
</div>

<div class="screen">

## Ver com os olhos do outro — Modo Ghost

<p class="route">/maintenance-dashboard?panel=auditor</p>

<div class="shots"><figure><img src="file:///C:/Users/maufr/.cursor/MProj/ecossistema/app-igreja/docs/manual-manutencao/screens/m16-acessos-usuarios.png" alt="m16-acessos-usuarios.png" /><figcaption class="shot-cap">docs/manual-manutencao/screens/m16-acessos-usuarios.png</figcaption></figure>
<figure><img src="file:///C:/Users/maufr/.cursor/MProj/ecossistema/app-igreja/Screeshot/1.png" alt="1.png" /><figcaption class="shot-cap">Screeshot/1.png</figcaption></figure></div>

### Onde estamos na jornada

Engrenagem → Governança. Grant explícito.

### O que se encontra — e por quê

Auditor assume a identidade efetiva do alvo: menus, família, telefone, geofence e ACL do alvo. Encerrar Ghost devolve o operador real. Busca de perfis sob demanda, sem pré-carregar milhares.

Suporte e auditoria sem pedir a senha da viúva. Ver o que ela vê.

### Conexões internas e quem conduz

`loadEffectiveSessionProfile`, `getEffectiveUserPhone`. Login real e totem usam a identidade real. Gestor não lista Super Administrador.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Pode ser ajudado sem entregar o PIN.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Depura a jornada real, com rastro de quem auditou.
</div>
</div>
</div>

<div class="screen">

## A assinatura da casa — Billing

<p class="route">/billing</p>

<div class="shots single"><figure><img src="file:///C:/Users/maufr/.cursor/MProj/ecossistema/app-igreja/docs/manual-manutencao/screens/m10-financeiro-manut.png" alt="m10-financeiro-manut.png" /><figcaption class="shot-cap">docs/manual-manutencao/screens/m10-financeiro-manut.png</figcaption></figure></div>

### Onde estamos na jornada

Engrenagem → Governança. Plano da igreja no Conecta+.

### O que se encontra — e por quê

Planos e cobrança da instância (Stripe), o que libera pacotes de funcionalidades.

Sustento da plataforma com clareza, sem misturar com o dízimo da igreja local.

### Conexões internas e quem conduz

Instâncias, Aliança, pacotes Básico/Padrão/Avançado.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Não paga aqui o dízimo; isso é `/ofertas`.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Vê o contrato da ferramenta.
</div>
</div>
</div>

<div class="screen">

## A rede — Aliança Conecta Reino

<p class="route">/alianca-conecta-reino</p>

<div class="shots single"><figure><img src="file:///C:/Users/maufr/.cursor/MProj/ecossistema/app-igreja/docs/manual-manutencao/screens/m10-financeiro-manut.png" alt="m10-financeiro-manut.png" /><figcaption class="shot-cap">docs/manual-manutencao/screens/m10-financeiro-manut.png</figcaption></figure></div>

### Onde estamos na jornada

Engrenagem → Governança. Igreja mãe e indicações.

### O que se encontra — e por quê

Indicações, passivo de 40%, baixa manual das ofertas da aliança.

Igrejas em rede precisam de contas de aliança distintas das contas do culto local.

### Conexões internas e quem conduz

Instâncias, billing, tesouraria da mãe.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Vive a igreja local; a aliança é ofício da liderança da rede.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Rastreia indicação e passivo sem misturar com o caixa do domingo.
</div>
</div>
</div>

<div class="screen">

## Os endereços da rede — Instâncias

<p class="route">/igrejas</p>

<p class="missing-shot">Recorte original desta parada ainda não está na pasta Screeshot/ ou nos manuais — o roteiro descreve a tela mesmo assim.</p>

### Onde estamos na jornada

Engrenagem → Governança.

### O que se encontra — e por quê

Criar e alternar ambientes de igreja (tenant), marca, parâmetros.

Cada casa tem nome, Pix, LGPD e geofence próprios.

### Conexões internas e quem conduz

Selecionar igreja, `/configurar`, Aliança, billing.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Escolhe a casa no onboarding.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Nasce uma igreja no ecossistema sem fork de código.
</div>
</div>
</div>


# Parte K — Camarim — o que não está no caminho publicado

<div class="screen">

## O camarim — telas fora do caminho publicado

<p class="route">Carrossel `/(tabs)/dashboard` (só redireciona) · `/(tabs)/explore` congelada</p>

<div class="shots"><figure><img src="file:///C:/Users/maufr/.cursor/MProj/ecossistema/app-igreja/Screeshot/3.png" alt="3.png" /><figcaption class="shot-cap">Screeshot/3.png</figcaption></figure>
<figure><img src="file:///C:/Users/maufr/.cursor/MProj/ecossistema/app-igreja/docs/manual-manutencao/screens/m05-sala-checkin.png" alt="m05-sala-checkin.png" /><figcaption class="shot-cap">docs/manual-manutencao/screens/m05-sala-checkin.png</figcaption></figure></div>

### Onde estamos na jornada

Não estão no menu, nem em Eu quero…, nem na engrenagem como card antigo. O código dorme em `lib/frozen-dashboard-cards.comment.ts`.

### O que se encontra — e por quê

O Painel-carrossel (QR de check-in como card, SALA(S) do membro, estacionamento, escalas avulsas duplicadas, lista de membros no carrossel, etc.) saiu da publicação. Deep links antigos caem na Agenda, em `/ofertas`, `/escalas`, `/membros`… A operação correspondente vive nas rotas dedicadas e na engrenagem (totem, salas, geofence).

Uma praça, um corredor, uma engrenagem. Dois carrosséis ensinavam a igreja a se perder.

### Conexões internas e quem conduz

`lib/frozenPublication.ts`. Descongelar exige pedido explícito pelo nome do card.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Não precisa saber que houve um carrossel. Precisa do Início.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Não republica o card congelado “para consertar”. Usa totem, geofence, salas na manutenção.
</div>
</div>
</div>

<div class="screen">

## Explore — rota congelada

<p class="route">/(tabs)/explore</p>

<p class="missing-shot">Recorte original desta parada ainda não está na pasta Screeshot/ ou nos manuais — o roteiro descreve a tela mesmo assim.</p>

### Onde estamos na jornada

Fora do produto publicado. Deep link não deve ser ensinado.

### O que se encontra — e por quê

Tela legado do template Expo / atalhos antigos. Não faz parte da jornada institucional atual.

Manter no ar como produto seria treinar o usuário no caminho errado.

### Conexões internas e quem conduz

Redirecionamentos de `frozenPublication`.

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
Não encontra no menu.
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
Não treina esta rota. Treina Início, menu e engrenagem.
</div>
</div>
</div>


# Apêndice — recortes originais ainda não amarrados a uma parada

Estes arquivos estavam nas pastas de assets e entram no guia para nenhum recorte ficar de fora.

<div class="appendix">
<figure><img src="file:///C:/Users/maufr/.cursor/MProj/ecossistema/app-igreja/Screeshot/5.png" alt="5.png" /><figcaption class="shot-cap">Screeshot/5.png</figcaption></figure>
<figure><img src="file:///C:/Users/maufr/.cursor/MProj/ecossistema/app-igreja/Screeshot/6.png" alt="6.png" /><figcaption class="shot-cap">Screeshot/6.png</figcaption></figure>
<figure><img src="file:///C:/Users/maufr/.cursor/MProj/ecossistema/app-igreja/Screeshot/7.png" alt="7.png" /><figcaption class="shot-cap">Screeshot/7.png</figcaption></figure>
<figure><img src="file:///C:/Users/maufr/.cursor/MProj/ecossistema/app-igreja/Screeshot/8-1.png" alt="8-1.png" /><figcaption class="shot-cap">Screeshot/8-1.png</figcaption></figure>
<figure><img src="file:///C:/Users/maufr/.cursor/MProj/ecossistema/app-igreja/Screeshot/8-2.png" alt="8-2.png" /><figcaption class="shot-cap">Screeshot/8-2.png</figcaption></figure>
<figure><img src="file:///C:/Users/maufr/.cursor/MProj/ecossistema/app-igreja/Screeshot/9.png" alt="9.png" /><figcaption class="shot-cap">Screeshot/9.png</figcaption></figure>
<figure><img src="file:///C:/Users/maufr/.cursor/MProj/ecossistema/app-igreja/images/captura.png" alt="captura.png" /><figcaption class="shot-cap">images/captura.png</figcaption></figure>
<figure><img src="file:///C:/Users/maufr/.cursor/MProj/ecossistema/app-igreja/images/circulo.png" alt="circulo.png" /><figcaption class="shot-cap">images/circulo.png</figcaption></figure>
<figure><img src="file:///C:/Users/maufr/.cursor/MProj/ecossistema/app-igreja/images/IBEP.png" alt="IBEP.png" /><figcaption class="shot-cap">images/IBEP.png</figcaption></figure>
</div>

# Encerramento

A casa digital começa no telefone e termina na prestação de contas — passando pelo abraço da recepção, pelo raio de trinta metros do templo, pelo totem do hall e pela engrenagem que só a liderança gira. O membro vive a praça. A administração vive o ofício. O Conecta+ é o corredor que os une, sem planilha paralela e sem carrossel a mais.

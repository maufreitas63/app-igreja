import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  Packer,
  PageNumber,
  Paragraph,
  TextRun,
} from 'docx';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outPath = path.join(root, 'docs', 'Experiencia-do-Usuario-Conecta.docx');

const C = {
  slate900: '0F172A',
  slate700: '334155',
  slate600: '475569',
  blue800: '1E40AF',
  blue700: '1D4ED8',
  accent: '1B4F8A',
};

const thin = { style: BorderStyle.SINGLE, size: 6, color: 'CBD5E1' };

const run = (text, extras = {}) =>
  new TextRun({
    text,
    font: 'Calibri',
    size: 22,
    color: C.slate700,
    ...extras,
  });

const p = (text, extras = {}) =>
  new Paragraph({
    spacing: { after: 160, line: 276 },
    children: [run(text, extras)],
  });

const h1 = (text) =>
  new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 160 },
    children: [new TextRun({ text, font: 'Calibri', size: 32, bold: true, color: C.blue800 })],
  });

const h2 = (text) =>
  new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 120 },
    children: [new TextRun({ text, font: 'Calibri', size: 26, bold: true, color: C.accent })],
  });

const h3 = (text) =>
  new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 80 },
    children: [new TextRun({ text, font: 'Calibri', size: 24, bold: true, color: C.slate900 })],
  });

const bullet = (text) =>
  new Paragraph({
    numbering: { reference: 'ux-bullets', level: 0 },
    spacing: { after: 80, line: 276 },
    children: [run(text)],
  });

const children = [
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 80 },
    children: [new TextRun({ text: 'Conecta+', font: 'Calibri', size: 48, bold: true, color: C.blue800 })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 80 },
    children: [
      new TextRun({
        text: 'Experiência geral do usuário',
        font: 'Calibri',
        size: 28,
        color: C.slate900,
      }),
    ],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 360 },
    children: [
      new TextRun({
        text: 'Mapa das telas, da navegação e das interações visíveis no aplicativo',
        font: 'Calibri',
        size: 22,
        italics: true,
        color: C.slate600,
      }),
    ],
  }),

  h1('1. O que a pessoa encontra'),
  p(
    'O Conecta+ é um aplicativo da igreja em formato de página (PWA): abre no navegador ou na tela inicial do celular, com a marca da igreja no topo. A experiência é contínua — a pessoa entra, vê o que está acontecendo, age a partir da home ou do menu, e fecha a tela com um botão único no rodapé.'
  ),
  p(
    'Há dois caminhos principais depois do login. O primeiro é a vida da comunidade: início, perfil, contribuições, célula, escalas, murais e ajuda. O segundo é a engrenagem de configurações, no canto do menu, com painéis para organizar pessoas, culto, finanças e a operação da igreja. Em qualquer caminho, o visual permanece o mesmo: fundo claro, tipografia estável, ícones discretos e um botão Fechar sempre à mão.'
  ),

  h1('2. Casca visual — o que não muda de tela para tela'),
  h2('Topo'),
  bullet('À esquerda, a saudação com o nome da pessoa (na home) e o botão de três traços que abre o menu.'),
  bullet('À direita, o logotipo da igreja da sessão.'),
  bullet('Quando um evento da agenda está aberto, o topo troca o título pelo nome daquele evento, sem perder o menu.'),
  h2('Menu lateral'),
  bullet('Abre deslizando sobre a tela. Lista atalhos da vida comunitária: Início, Perfil, Financeiro, Minha Célula, Escalas, murais, Sugestões, Como faço…?, Redes Sociais e Sobre o Conecta+.'),
  bullet('No cabeçalho do menu há uma engrenagem. Ela abre as Configurações, agrupadas em Operação e Segurança, Gestão de Pessoas, Culto e Eventos, Finanças e Inteligência, e Governança e TI.'),
  bullet('Grupos da engrenagem expandem e recolhem. Itens mostram ícone, nome, uma frase de contexto e uma seta. Há um atalho de ajuda no topo e, quando disponível, Instâncias no rodapé das configurações.'),
  bullet('Uma barra no fim do drawer encerra a sessão.'),
  h2('Rodapé das telas internas'),
  bullet('O botão Fechar devolve a pessoa ao ponto de onde veio (em geral o Início). É o gesto padrão para sair de um módulo sem se perder.'),
  h2('Ajuda na própria tela'),
  bullet('Muitos títulos trazem um “i” à direita. O toque abre o artigo de ajuda daquela tela, sem sair do contexto.'),
  h2('Busca Enxergar'),
  bullet('Em listas longas, a busca pode abrir um painel no topo da tela. A pessoa digita e vê o recorte imediatamente, em vez de varrer a página inteira.'),
  h2('Diálogos e avisos'),
  bullet('Toasts confirmam ações, avisam ausência de dados ou pedem atenção.'),
  bullet('Caixas de confirmação pedem sim/não antes de atos irreversíveis.'),
  bullet('Campos de seleção (dropdown) podem ser pesquisáveis; interruptores ligam e desligam opções; calendários e relógios escolhem data e hora.'),

  h1('3. Entrar no aplicativo'),
  h2('Login'),
  p(
    'A primeira tela pede o telefone e, em seguida, o PIN de acesso. Há atalho para recuperar o PIN por e-mail, opção de desbloquear com biometria quando o aparelho oferece, e identificação da igreja pelo código da instância. Um totem de check-in também entra por telefone e PIN próprios, indo direto para a câmera de leitura.'
  ),
  h2('Cadastro'),
  p(
    'Quem ainda não completou o perfil preenche nome, nascimento e CEP, lê os termos de privacidade até o fim (quando o módulo está ativo), aceita o termo e tira ou envia uma selfie. Há etapa de câmera e de confirmação da foto. Um formulário à parte, em página própria, cobre o cadastro familiar mais completo (endereço e composição da família).'
  ),
  h2('Outras portas'),
  bullet('Esqueci a senha / PIN: fluxo de recuperação por e-mail.'),
  bullet('Privacidade (LGPD): leitura e aceite dos termos fora do cadastro, quando necessário.'),
  bullet('Selecionar igreja: escolha da instância quando há mais de um ambiente.'),
  bullet('Sessão encerrada e aplicativo indisponível: telas de espera, com mensagem da igreja, até o acesso voltar.'),
  bullet('Instâncias: criar ou alternar o ambiente da igreja, com a identidade visual correspondente.'),
  bullet(
    'Convite por link: um endereço com o código da igreja grava a instância e abre o login já apontando para aquele ambiente.'
  ),

  h1('4. Início — o centro da experiência'),
  p(
    'Depois do login a pessoa chega ao Início. É uma tela em duas camadas: acima, um “inbox” do que está vivo na igreja; abaixo, o bloco Eu quero…, com ações imediatas.'
  ),
  h2('Inbox de eventos e avisos'),
  p(
    'A área principal é um pager horizontal. A primeira página lista os eventos ativos (cultos, encontros, atividades). Cada linha mostra nome e horário. Ao tocar um evento, a Agenda da Família sobe no lugar do inbox: a pessoa vê quem da família está naquele evento, confirma presença, acompanha o check-in por proximidade quando ele está ligado, e gerencia inscrições da família. Fechar a agenda devolve o inbox.'
  ),
  p(
    'As páginas seguintes do pager reúnem comunicados: avisos publicados, lembretes pastorais, campanhas, oportunidades de voluntariado, generosidade, empréstimo de livros e trocas de escala. Itens não lidos podem ser marcados como lidos. Setas ou o deslize passam de uma página a outra.'
  ),
  h2('Eu quero…'),
  p(
    'No rodapé da home, a pessoa escolhe uma intenção. Contribuir abre um submenu: Dízimos e Ofertas (informa o valor e copia o Pix), Campanhas e Projetos (Pix já identificado na campanha) e Prímicias (compromisso com um item em espécie). Ao lado, Fazer um pedido de oração abre o cuidado pastoral. Na mesma linha do título há o atalho da assistente em conversa (Abigail), em janela sobre a home, para perguntas em linguagem natural.'
  ),

  h1('5. Telas da vida da comunidade'),
  p(
    'O menu e alguns atalhos levam a módulos com a mesma casca (topo + Fechar). Abaixo, o que cada um oferece à pessoa.'
  ),
  h3('Perfil'),
  p(
    'Dados cadastrais, foto, família, telefone e códigos. A pessoa atualiza o que é dela, vê o núcleo familiar e, quando o fluxo pede, troca o PIN depois de uma recuperação.'
  ),
  h3('Gestão do próprio cadastro e de membros da família'),
  p(
    'Telas dedicadas permitem editar o perfil com mais campos e acompanhar ou complementar cadastros de pessoas da família. Há ainda um formulário de cadastro familiar (endereço e composição), sempre voltando ao Início pelo Fechar.'
  ),
  h3('Financeiro (visão da pessoa / da igreja)'),
  p(
    'Hub com seções que se escolhem no próprio painel: resumo analítico, resultado do mês, comparativo, últimos doze meses, série histórica, orçamento, saldo em conta e, quando couber, o bloco da Aliança. Há seletor de mês e gráficos ou tabelas de acompanhamento.'
  ),
  h3('Dízimos, ofertas e campanhas'),
  p(
    'Informar valor (com centavos), gerar ou copiar Pix, ver campanhas ativas e contribuir em um projeto específico. Prímicias lista itens da cesta para a pessoa se comprometer.'
  ),
  h3('Minha Célula'),
  p(
    'Cartão do pequeno grupo: identificação, participantes e atalhos ligados à vida da célula.'
  ),
  h3('Escalas'),
  p(
    'A pessoa vê as escalas em que está, indica disponibilidade, acompanha a programação e trata trocas (avisos de permuta também aparecem no inbox da home).'
  ),
  h3('Mural de Oportunidades'),
  p(
    'Lista de vagas de serviço voluntário. A pessoa se candidata, acompanha o que publicou o interesse e recebe avisos na home.'
  ),
  h3('Mural de Generosidade'),
  p(
    'Doações e pedidos de empréstimo entre a comunidade, com acompanhamento do status e avisos.'
  ),
  h3('Sugestões'),
  p(
    'Canal para enviar ideias e melhorias, e acompanhar o que já foi registrado.'
  ),
  h3('Como faço…?'),
  p(
    'Catálogo pesquisável de artigos de ajuda. O toque abre o texto em modal. Há um catálogo voltado à vida da pessoa e outro voltado às telas da engrenagem.'
  ),
  h3('Redes sociais e Sobre o Conecta+'),
  p(
    'Links e presença da igreja nas redes, e uma tela institucional sobre o produto.'
  ),
  h3('Cuidado pastoral (pedido de oração)'),
  p(
    'Formulário para compartilhar um pedido com a equipe. Uma tela à parte mostra o histórico de atendimentos quando a pessoa já passou por horários de cuidado.'
  ),
  h3('Trilha de discipulado'),
  p(
    'Passos com textos, vídeos e reflexões. A pessoa avança no próprio ritmo e vê o progresso.'
  ),
  h3('Relatório de despesas (RD)'),
  p(
    'Lançar e acompanhar prestações de contas pessoais ligadas à igreja, com formulário e listagem.'
  ),
  h3('Aniversariantes, lista de membros, mapa e administrativo'),
  p(
    'Diretório da comunidade, lista de aniversariantes, mapa com pins das famílias e área de atos constitutivos ou documentos administrativos da igreja — sempre como telas de consulta e, quando o fluxo permite, de edição pontual.'
  ),
  h3('Livros doados'),
  p(
    'Acervo com busca (inclusive por ISBN), cadastro manual de títulos e avisos de empréstimo no inbox.'
  ),
  h3('Avisos e orquestração de comunicados'),
  p(
    'Há uma tela de avisos complementar ao pager da home e um painel de orquestração que organiza os comunicados dos eventos no tempo.'
  ),

  h1('6. Engrenagem — painéis de organização'),
  p(
    'A engrenagem reúne painéis de trabalho. Cada item abre uma tela cheia (às vezes um cartão dentro do dashboard de manutenção) com Fechar no rodapé. A pessoa percorre grupos; o conteúdo é o da operação da igreja, não o da vida pessoal.'
  ),

  h2('Operação e Segurança'),
  h3('Configuração de salas'),
  p('Nomes afetivos das salas e atribuição de pessoas a cada espaço.'),
  h3('Totem de check-in'),
  p(
    'Modo kiosk: câmera lê o QR no hall, confirma a presença no evento do dia e mostra feedback imediato (já confirmado, sucesso, erro). Há pedido de permissão de câmera e seleção do evento ativo.'
  ),
  h3('Autorização de imagem e voz'),
  p(
    'Termos de uso de imagem e voz, com confirmação — inclusive por e-mail — e uma tela de confirmação quando a pessoa chega pelo link.'
  ),

  h2('Gestão de Pessoas'),
  bullet('Lista de membros: diretório pesquisável da comunidade.'),
  bullet('Mapa de geolocalização: mapa interativo com pins das famílias.'),
  bullet('Aniversariantes: recorte por data.'),
  bullet('Cuidados pastorais: fila de pedidos e grade de horários (slots) para atendimento.'),
  bullet('Gestão de pequenos grupos: manutenção das células além da visão “minha célula”.'),
  bullet('Mural de voluntários: publicação e gestão das vagas que depois aparecem para a comunidade.'),
  bullet('Moderação do mural: análise de doações e empréstimos do mural de generosidade.'),
  bullet('Recepção familiar: acolhida de famílias novas, com formulário e fila de acompanhamento.'),
  bullet('Régua de acolhimento: sequência de contatos após a recepção (mensagens e convites ao longo dos dias).'),
  bullet('Cadastro de usuário: alta e edição operacional de pessoas.'),
  bullet('Administrativo: documentos e atos da igreja.'),
  bullet('Livros doados: mesma base do acervo, no contexto de gestão.'),

  h2('Culto e Eventos'),
  bullet('Programação de eventos: criar, editar, replicar e desativar eventos (data, hora, local favorito, capacidade, salas, geofence, totem).'),
  bullet('Cronograma de eventos: linha do tempo tipo Gantt com os eventos no calendário.'),
  bullet('Manutenção de avisos: comunicados que alimentam o inbox da home.'),
  bullet('Sala(s) — check-in: operação das salas no momento do culto (chamada / servidor).'),
  bullet('Tipos de escala: cadastro dos tipos de serviço.'),
  bullet('Servos em disponibilidade: quem se declarou disponível.'),
  bullet('Programação de escalas: montagem da escala no calendário.'),
  bullet('Presença: registro de quórum e lista de check-in do evento.'),

  h2('Finanças e Inteligência'),
  bullet('Informações financeiras: extratos, RD, orçamento e os mesmos recortes da tela Financeiro, no modo de manutenção.'),
  bullet('Gestão de campanhas: criar e acompanhar campanhas e projetos que depois recebem Pix na home.'),
  bullet('Prímicias: itens em espécie da campanha.'),
  bullet('Modelo preditivo: painel de tendências e projeções a partir da série financeira.'),

  h2('Governança e TI'),
  bullet('Temas da Trilha, reconhecimentos e reset: conteúdo dos passos, quem concluiu, e reinício pontual do progresso.'),
  bullet('Como faço…? e Base de conhecimento: leitura e edição dos artigos de ajuda.'),
  bullet('Relatórios: consultas e exportações operacionais.'),
  bullet('Controle de acesso: perfis, papéis e pessoas; interruptores de aplicativo ativo, gestão da instância e privacidade; matriz de “ver” e “editar” por tela.'),
  bullet('Mudança de papéis: busca da pessoa e alteração do papel, com lista filtrada no topo (Enxergar).'),
  bullet('Transferência de membro: mover alguém entre igrejas/instâncias.'),
  bullet('Acesso usuários: visão de quem entrou e como usa o sistema.'),
  bullet('Modo Ghost: ver a aplicação com os olhos de outra pessoa, sem sair da sessão atual.'),
  bullet(
    'Assinaturas: cartões de plano com preço e capacidade, checkout em janela segura, contratos gerados na tela, renovação e encerramento da contratação, com avisos visíveis do estado do pagamento.'
  ),
  bullet('Aliança Conecta Reino e Indicados: indicação de igrejas, acompanhamento financeiro da parceria e funil visual (kanban) dos indicados.'),
  bullet('Instâncias (Igrejas): criar e alternar ambientes.'),
  bullet('Chave da assistente: configuração da API de conversa da Abigail.'),

  h2('Painel de manutenção'),
  p(
    'Vários itens da engrenagem não mudam de “site”: abrem o mesmo dashboard de manutenção com o cartão correspondente (eventos, escalas, pastorais, finanças, relatórios etc.). A pessoa troca de cartão pelo menu; o Fechar sai do dashboard. Indicadores no topo de alguns cartões (por exemplo aplicativo ativo e gestão da instância) são interruptores visíveis, não menus escondidos.'
  ),

  h1('7. Ferramentas visuais e interações recorrentes'),
  bullet('Pager / carrossel horizontal na home para separar eventos de avisos.'),
  bullet('Agenda da família em painel sobre a home, com lista da família e status de presença.'),
  bullet('Mapa com pins e geolocalização (famílias e check-in por proximidade no evento).'),
  bullet('Gráfico de Gantt do cronograma de eventos.'),
  bullet('Kanban do funil de indicados.'),
  bullet('Gráficos e comparativos financeiros (mês, 12 meses, orçamento, saldo).'),
  bullet('Câmera para selfie no cadastro, QR no totem e leitura de código de barras/ISBN nos livros.'),
  bullet('Cópia de Pix e valores com centavos nas contribuições.'),
  bullet('Chat da Abigail em modal, a partir da home.'),
  bullet('Calendário mensal e relógio para horários de evento e de cuidado pastoral.'),
  bullet('Locais favoritos ao cadastrar evento.'),
  bullet('Interruptores (liga/desliga) e rádios de status (ativo / inativo).'),
  bullet('Listas com busca Enxergar no topo.'),
  bullet('Ajuda contextual (“i”) e catálogo Como faço…?.'),
  bullet('Toasts, confirmações e estados vazios (“nenhuma campanha ativa”).'),
  bullet('Marca d’água da igreja ao fundo das telas autenticadas.'),
  bullet('Instalação como PWA (ícone na tela inicial) e aviso para instalar quando o navegador oferece.'),

  h1('8. Fluxos de navegação, em sequência'),
  h3('Chegar'),
  p(
    'Abrir o endereço da igreja → login (telefone + PIN ou biometria) → se o cadastro estiver incompleto, cadastro e selfie → Início.'
  ),
  h3('Participar de um encontro'),
  p(
    'Início → tocar o evento → Agenda da Família → confirmar quem vai → (no hall) totem lê o QR ou o check-in por proximidade registra a presença → Fechar volta ao inbox.'
  ),
  h3('Contribuir'),
  p(
    'Início → Eu quero… → Contribuir → Dízimos e Ofertas, Campanha ou Prímicias → informar valor ou item → copiar Pix ou confirmar compromisso → Fechar.'
  ),
  h3('Pedir oração ou falar com a assistente'),
  p(
    'Início → pedido de oração (formulário) ou ícone da Abigail (conversa). Avisos pastorais também chegam no pager da home.'
  ),
  h3('Servir'),
  p(
    'Menu → Escalas (disponibilidade e programação) ou Mural de Oportunidades (candidatar-se). Trocas e convites voltam como avisos no Início.'
  ),
  h3('Organizar a igreja'),
  p(
    'Menu → engrenagem → grupo (Pessoas, Culto, Finanças, Governança) → painel → trabalhar no cartão → Fechar. A ajuda da engrenagem está em Como faço…? com o catálogo de manutenção, e o “i” em cada título.'
  ),
  h3('Sair'),
  p(
    'Barra Encerrar sessão no menu, ou simplesmente Fechar até o Início. Sessão expirada leva à tela de sessão encerrada e de novo ao login.'
  ),

  h1('9. O que a experiência privilegia'),
  bullet('Uma home que mostra o agora (eventos e avisos) e o próximo passo (Eu quero…).'),
  bullet('Um menu curto para a vida da pessoa e uma engrenagem à parte para a operação.'),
  bullet('Sempre o mesmo gesto de saída: Fechar.'),
  bullet('Ajuda colada no título da tela, não em um site externo.'),
  bullet('Ações financeiras e de presença com poucos toques: valor, Pix, QR, família.'),
  bullet('A igreja visível o tempo todo: logo no topo, marca d’água, nome da instância.'),
  p(
    'Este documento descreve o que a interface oferece à pessoa que usa o Conecta+, com base nas telas publicadas do aplicativo — da porta de entrada à engrenagem — sem detalhar quem vê o quê. A disponibilidade de cada item na prática depende da sessão, da igreja e do momento da operação.'
  ),
];

const doc = new Document({
  creator: 'Conecta+',
  title: 'Experiência geral do usuário — Conecta+',
  description:
    'Mapa das telas, da navegação e das interações visíveis no aplicativo Conecta+.',
  numbering: {
    config: [
      {
        reference: 'ux-bullets',
        levels: [
          {
            level: 0,
            format: 'bullet',
            text: '•',
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 360, hanging: 180 } } },
          },
        ],
      },
    ],
  },
  sections: [
    {
      properties: {
        page: {
          margin: { top: 1080, bottom: 1080, left: 1080, right: 1080 },
        },
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              border: { bottom: thin },
              spacing: { after: 120 },
              children: [
                new TextRun({
                  text: 'Conecta+  ·  Experiência do usuário',
                  font: 'Calibri',
                  size: 18,
                  color: C.slate600,
                }),
              ],
            }),
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              border: { top: thin },
              spacing: { before: 120 },
              children: [
                new TextRun({ text: 'Página ', font: 'Calibri', size: 16, color: C.slate600 }),
                new TextRun({ children: [PageNumber.CURRENT], font: 'Calibri', size: 16, color: C.slate600 }),
              ],
            }),
          ],
        }),
      },
      children,
    },
  ],
});

const buffer = await Packer.toBuffer(doc);
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, buffer);
console.log('Wrote', outPath);

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function readLines(file, start = 1, end = 0) {
  const content = fs.readFileSync(path.join(root, file), 'utf8');
  const lines = content.split(/\r?\n/);
  const from = start - 1;
  const to = end > 0 ? end : lines.length;
  return lines.slice(from, to);
}

function sectionHeader(title) {
  return ['', '---', '', `# ${title}`, '', '---', ''];
}

function writePackage(filename, intro, parts) {
  const chunks = [intro.join('\n')];
  for (const part of parts) {
    chunks.push(sectionHeader(part.title).join('\n'));
    chunks.push(readLines(part.file, part.start ?? 1, part.end ?? 0).join('\n'));
  }
  fs.writeFileSync(path.join(root, filename), `${chunks.join('\n')}\n`, 'utf8');
}

const TRAINING_DAYS = [
  {
    id: 1,
    title: 'Primeiro contato — login, cadastro e LGPD (ativo ou inativo)',
    start: 36,
    end: 258,
    qa: [
      ['O que digito na tela Boas-vindas?', 'Seu **celular** com DDD no formato `(00) 00000-0000`, depois o **código de 4 dígitos** recebido no WhatsApp (①③ na ilustração de login).'],
      ['Por que não vejo termos LGPD no cadastro?', 'A igreja pode ter **`LGPD_Ativo = nao`**. Nesse caso use o fluxo **0.2b**: nome, nascimento, CEP e **Continuar** — sem selfie nem caixa de termos.'],
      ['O cabeçalho vermelho significa o quê?', 'Com **`LGPD_Ativo = sim`**, há pendência de aceite dos termos. Vá em **Dados Cadastrais → LGPD** ou à tela **Termos de Uso e Privacidade** (seção 0.3). Com LGPD inativo, esse alerta **não aparece**.'],
      ['Quem liga ou desliga o módulo LGPD?', 'Somente **super_admin** em **Manutenção → Controle de Acesso** (interruptor **LGPD Ativo / Inativo**).'],
      ['O que é o Índice do Aplicativo?', 'Tela inicial com **atalhos** para cada card do painel — distribuição uniforme na altura da tela (seção 0.4).'],
      ['Posso trocar a senha temporária?', 'Sim — em **Gestão de Cadastros → Dados Cadastrais → Senha de acesso** após o primeiro login.'],
      ['Esqueci minha senha pessoal?', 'No **passo 2** do login, toque **Esqueci minha senha** → confirme o e-mail → responda a pergunta de segurança → novo PIN por **e-mail** (não é WhatsApp).'],
    ],
  },
  {
    id: 2,
    title: 'Agenda da Família e Check-in / QR Code',
    start: 259,
    end: 375,
    qa: [
      ['Como inscrevo minha família em um evento?', 'Card **Agenda da Família** → selecione o evento → marque os membros → confirme inscrição/audiência conforme as vagas exibidas.'],
      ['O que é pré-check-in (audiência)?', 'Confirmação de interesse **antes** do dia do evento; libera o card **Check-in / QR Code** quando o evento exige esse fluxo.'],
      ['Onde fica o QR da minha família?', 'Card **Check-in / QR Code** — etiqueta com código da família e QR para leitura no totem (② na ilustração).'],
      ['Posso fazer check-in manual?', 'Sim — use a seleção manual de membros no card QR quando a igreja habilitar esse fluxo.'],
      ['O que é check-in por proximidade?', 'Com **geofence ativo**, o app confirma presença automaticamente ao chegar ao templo (GPS + audiência prévia).'],
      ['Badges Kids/Teens no QR?', 'Indicam faixa etária do membro para salas **IBN Kids** / **IBN Teens** (prefixo **`Parm_entidade`** na interface).'],
      ['Não vejo eventos na agenda?', 'Pode não haver eventos publicados, ou seu perfil não tem permissão — fale com a secretaria.'],
    ],
  },
  {
    id: 3,
    title: 'SALA(S) — IBN Kids / IBN Teens e Dízimos e Ofertas',
    start: 376,
    end: 457,
    qa: [
      ['O card SALA(S) mostra quem?', 'Somente **membros da sua família** em monitoramento de entrada nas salas Kids/Teens — leitura apenas, sem editar.'],
      ['Por que não vejo ninguém no SALA(S)?', 'Nenhum familiar foi registrado na sala no momento, ou você não tem permissão para esse card.'],
      ['Como copio a chave PIX?', 'Card **Dízimos e Ofertas** → toque **Copiar chave PIX** (ícone *touch-app*) — a chave vem de `app_parameters`.'],
      ['Posso atualizar a chave PIX?', 'Membros veem a chave configurada pela igreja; alteração é feita na **manutenção** (equipe autorizada).'],
      ['O nome IBN KIDS vem de onde?', 'Do parâmetro **`Parm_entidade`** — prefixo dinâmico da entidade nos textos e cards.'],
    ],
  },
  {
    id: 4,
    title: 'Coração Aberto e Lista de Membros',
    start: 458,
    end: 670,
    qa: [
      ['Como envio um pedido pastoral?', 'Card **Coração Aberto** → preencha o formulário → envie. Acompanhe em **Meus pedidos**.'],
      ['Quem vê meu pedido pastoral?', 'A **equipe pastoral** na manutenção (Pacote 6, Parte 7) — estágios Acolher, Apoiar, Acompanhar.'],
      ['Lista de Membros vs Visitantes?', 'Botões **Visitantes** e **Membros** na mesma linha alternam a lista; o título muda para **LISTA DE VISITANTES** e o campo de busca para **Procurar visitante**.'],
      ['Como vejo integrantes da mesma família?', 'Na coluna **Família**, toque o ícone **users** (rosa) → modal **Membros da família** com código (ex.: **Família IBN0103**), nomes, parentesco e WhatsApp.'],
      ['O modal da família veio vazio — o que fazer?', 'Pode não haver integrantes reconhecidos no núcleo, falta de permissão ACL ou RPCs não aplicados no Supabase — avise a secretaria/TI. A mensagem *Nenhum membro reconhecido nesta família* ou erro em vermelho explica o caso.'],
      ['Como contato alguém pelo WhatsApp?', 'Na lista ou no modal familiar, toque o ícone **WhatsApp** (verde) ao lado do nome quando houver telefone cadastrado.'],
      ['Para que serve o Mapa Geral?', 'Abre `/mapa-geolocalizacao` com pins de endereços; filtros **Todos**, **Com papel** e **Visitantes**. Membros veem o mapa; **detalhe ao clicar no pin** (localização de outros) só com permissão pastoral/super_admin.'],
    ],
  },
  {
    id: 5,
    title: 'Aniversariantes e Financeiro',
    start: 671,
    end: 808,
    qa: [
      ['Como filtro aniversariantes do mês?', 'Card **Aniversariantes** → escolha o **mês** → lista com datas e atalho WhatsApp.'],
      ['O card Financeiro mostra o quê?', 'Hub de relatórios: **Relatório de Despesas (RD)** em destaque, fluxo de caixa e categorias conforme permissão.'],
      ['Quem acessa o Financeiro?', 'Perfis com grant no card (ex.: **`member`**, **`tesoureiro`**) — definido pelo ACL da igreja.'],
      ['Posso ver lançamentos de outros meses?', 'Conforme telas `/financial` — navegue períodos disponíveis para seu papel.'],
    ],
  },
  {
    id: 6,
    title: 'Relatório de Despesas (RD), Escalas e Servos',
    start: 809,
    end: 925,
    qa: [
      ['Como envio um RD?', 'Card **Financeiro** → **Relatório de Despesas** → preencha itens → **Submeter e Finalizar**; pode abrir WhatsApp do tesoureiro.'],
      ['Qual o formato do número do RD?', 'Prefixo **AAMM** + sequência mensal (ex.: `250500001`) — configurado para o papel **tesoureiro**.'],
      ['Onde vejo minhas escalas?', 'Card **Escalas** → tipos de escala → datas e servos com WhatsApp.'],
      ['Card Servos em escala?', 'Visível quando seu perfil participa de escalas — lista de colegas na mesma data/tipo.'],
      ['RD ficou pendente?', 'Aguarde conciliação na **manutenção → Informações Financeiras** (tesoureiro/super_admin).'],
    ],
  },
  {
    id: 7,
    title: 'Estacionamento, Gestão de Cadastros e encerramento',
    start: 926,
    end: 0,
    qa: [
      ['Como identifico um veículo no estacionamento?', 'Card **Estacionamento** → digite a **placa** → sistema busca proprietário e abre WhatsApp se cadastrado.'],
      ['Onde edito meus dados?', '**Gestão de Cadastros → Dados Cadastrais** — nome, CPF, endereço, selfie, veículos, senha.'],
      ['Como gerencio minha família?', '**Gestão de Cadastros → Gerenciar Família** — adicionar, reconhecimento familiar, Kids/Teens.'],
      ['Como saio com segurança?', 'Índice → **Encerrar sessão** / **Sair do aplicativo** — limpa telefone e perfil do aparelho.'],
      ['Perdi um card no painel?', 'A igreja define permissões por papel — não é defeito do aparelho; fale com a secretaria.'],
      ['Onde está o manual completo?', '[Pacote 5 — Manual do Painel](PACOTE_5_MANUAL_PAINEL.md) e treinamento por missões no [Pacote 1](PACOTE_1_VISAO_GERAL.md).'],
    ],
  },
];

function formatQaBlock(day) {
  const lines = [
    '',
    '---',
    '',
    `## Perguntas e respostas — Dia ${day.id}`,
    '',
    '| Pergunta | Resposta |',
    '|----------|----------|',
  ];
  for (const [q, a] of day.qa) {
    lines.push(`| ${q} | ${a} |`);
  }
  return lines.join('\n');
}

function buildTrainingDailyManual() {
  const chunks = [
    '# Manual de Treinamento Diário — Painel do Membro',
    '',
    '**App IBN · Igreja Batista Norte**',
    '',
    'Treinamento **particionado por dia**, baseado integralmente no [Pacote 5 — Manual do Painel](PACOTE_5_MANUAL_PAINEL.md). Cada dia reproduz as **mesmas ilustrações, referências numeradas (①②③…) e textos** do manual do membro, **sem misturar temas** entre dias.',
    '',
    '**Público:** novos membros, famílias e voluntários.  ',
    '**Formato:** um treinamento por dia · **15 a 25 minutos** por sessão · **Perguntas e respostas** ao final de cada dia.',
    '',
    '**Pacote:** [`PACOTE_7_TREINAMENTO_DIARIO.md`](PACOTE_7_TREINAMENTO_DIARIO.md) · **Índice geral:** [`INDICE_DOCUMENTACAO.md`](INDICE_DOCUMENTACAO.md)',
    '',
    '**Atualizado em:** 02/07/2026',
    '',
    '---',
    '',
    '## Índice dos treinamentos diários',
    '',
    '| Dia | Tema | Seções do Pacote 5 |',
    '|-----|------|-------------------|',
  ];

  for (const day of TRAINING_DAYS) {
    const range =
      day.end > 0 ? `linhas ${day.start}–${day.end}` : `linhas ${day.start}–fim`;
    chunks.push(`| **Dia ${day.id}** | ${day.title} | Parte correspondente (${range}) |`);
  }

  chunks.push(
    '',
    '> **LGPD opcional:** nos Dias 1 e 7, quando a igreja mantém **`LGPD_Ativo = nao`**, ignore passos de termos/selfie e siga **cadastro simplificado** (seção 0.2b do Pacote 5).',
    '',
    '---',
    ''
  );

  for (const day of TRAINING_DAYS) {
    chunks.push(`# Dia ${day.id} — ${day.title}`, '');
    chunks.push(readLines('MANUAL_DASHBOARD_MEMBRO.md', day.start, day.end).join('\n'));
    chunks.push(formatQaBlock(day));
    chunks.push('');
  }

  fs.writeFileSync(path.join(root, 'MANUAL_TREINAMENTO_DIARIO.md'), `${chunks.join('\n')}\n`, 'utf8');
}

buildTrainingDailyManual();

writePackage('PACOTE_1_VISAO_GERAL.md', [
  '# Pacote 1 — Visão Geral',
  '',
  'Documentação **autocontida** para diretoria, membros, famílias e voluntários.',
  '',
  '**Atualizado em:** 23/06/2026',
  '',
  'Conteúdo integrado: Funcionalidades · Manual de Treinamento · FAQ',
], [
  { title: 'Parte 1 — Funcionalidades do aplicativo IBN', file: 'FUNCIONALIDADES.md' },
  { title: 'Parte 2 — Manual de Treinamento (Mão na Massa)', file: 'MANUAL_TREINAMENTO.md' },
  { title: 'Parte 3 — Perguntas e Respostas (FAQ)', file: 'FAQ.md' },
]);

writePackage('PACOTE_2_OPERACAO.md', [
  '# Pacote 2 — Operação da Igreja',
  '',
  'Documentação **autocontida** para secretaria, eventos, salas Kids/Teens e líderes de escala.',
  '',
  '**Atualizado em:** 23/06/2026',
  '',
  'Conteúdo integrado: Manutenção como ecossistema · Missão B4 (escalas) · Card Agenda · FAQ Totem/Manutenção',
], [
  { title: 'Parte 1 — Manutenção como ecossistema vivo', file: 'MANUTENCAO_ECOSISTEMA.md' },
  { title: 'Parte 2 — Missão B4: Escalas em equipe (Manual de Treinamento)', file: 'MANUAL_TREINAMENTO.md', start: 265, end: 324 },
  { title: 'Parte 3 — Manual do Card 1: Agenda da Família', file: 'MANUAL_CARD1_DASHBOARD.md' },
  { title: 'Parte 4 — FAQ: Totem e Manutenção (equipe)', file: 'FAQ.md', start: 427, end: 470 },
]);

writePackage('PACOTE_3_GOVERNANCA_TI.md', [
  '# Pacote 3 — Governança, Permissões e TI',
  '',
  'Documentação **autocontida** para super administrador, TI e desenvolvedor.',
  '',
  '**Atualizado em:** 23/06/2026',
  '',
  'Conteúdo integrado: Manual operacional ACL · Modelo de controle de acesso · Camadas de segurança · Blueprint completo',
], [
  { title: 'Parte 1 — Manual operacional de Controle de Acesso', file: 'MANUAL_CONTROLE_ACESSO.md' },
  { title: 'Parte 2 — Controle de acesso: modelo e inventário', file: 'CONTROLE_ACESSO.md' },
  { title: 'Parte 3 — Especificação das camadas de segurança', file: 'CAMADAS_SEGURANCA.md' },
  { title: 'Parte 4 — Blueprint completo', file: 'BLUEPRINT.md' },
]);

writePackage('PACOTE_4_ANEXO_TECNICO.md', [
  '# Pacote 4 — Anexo Técnico',
  '',
  'Documentação **autocontida** de arquitetura e referências técnicas.',
  '',
  '**Atualizado em:** 23/06/2026',
  '',
  'Conteúdo integrado: Arquitetura Blueprint PWA · Cards do Dashboard',
], [
  { title: 'Parte 1 — Blueprint de Arquitetura e Especificação Técnica', file: 'ARQUITETURA_BLUEPRINT_PWA.md' },
  { title: 'Parte 2 — Cards do Dashboard', file: 'DASHBOARD_CARDS.md' },
]);

writePackage('PACOTE_5_MANUAL_PAINEL.md', [
  '# Pacote 5 — Manual do Painel (uso pelo membro)',
  '',
  'Documentação **autocontida** para primeiro acesso e uso diário do painel do membro.',
  '',
  '**Atualizado em:** 23/06/2026',
  '',
  'Conteúdo integrado: login, cadastro, LGPD (reconhecimento **opcional** via `LGPD_Ativo`), navegação, todos os cards do dashboard (sem manutenção), com ilustrações anotadas em **largura integral (100%)** e resultado esperado em cada ação.',
], [
  { title: 'Manual completo', file: 'MANUAL_DASHBOARD_MEMBRO.md' },
]);

writePackage('PACOTE_6_MANUAL_MANUTENCAO.md', [
  '# Pacote 6 — Manual do Painel de Manutenção (uso pela equipe)',
  '',
  'Documentação **autocontida** para quem gerencia o aplicativo: secretaria, líderes, pastoral, financeiro e TI.',
  '',
  '**Atualizado em:** 23/06/2026',
  '',
  'Conteúdo integrado: acesso via engrenagem, ACL (incl. interruptor **LGPD Ativo/Inativo**), papel **Tesoureiro**, todos os cards de maintenance-dashboard, com ilustrações em **largura integral (100%)**, resultado esperado e efeito no app dos membros.',
], [
  { title: 'Manual completo', file: 'MANUAL_DASHBOARD_MANUTENCAO.md' },
]);

writePackage('PACOTE_7_TREINAMENTO_DIARIO.md', [
  '# Pacote 7 — Treinamento Diário do Painel (membro)',
  '',
  'Documentação **autocontida** para capacitação **dia a dia**, derivada do Pacote 5.',
  '',
  '**Atualizado em:** 23/06/2026',
  '',
  'Conteúdo integrado: **7 treinamentos diários** com índice temático, todas as imagens e referências do manual do membro (sem misturar informações entre dias) e **Perguntas e Respostas** ao final de cada dia.',
], [
  { title: 'Manual completo', file: 'MANUAL_TREINAMENTO_DIARIO.md' },
]);

console.log('Pacotes gerados com sucesso.');

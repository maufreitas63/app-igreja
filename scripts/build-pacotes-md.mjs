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
    title: 'Primeiro contato — login por e-mail, cadastro e LGPD',
    start: 13,
    end: 185,
    qa: [
      ['O que digito na tela Boas-vindas?', 'Seu **celular** com DDD no formato `(00) 00000-0000`, depois o **PIN de 4 dígitos** recebido por **e-mail**.'],
      ['O PIN vem por WhatsApp?', 'Não. Primeiro acesso e recuperação usam **e-mail**. WhatsApp permanece para convites e contatos da igreja.'],
      ['Por que não vejo termos LGPD no cadastro?', 'A igreja pode ter **LGPD inativo** na engrenagem → Controle de Acesso. Nesse caso o cadastro é simplificado.'],
      ['O texto LGPD é o mesmo em todas as igrejas?', 'Não — cada instância pode ter texto próprio em `app_parameters`, editável no Controle de Acesso.'],
      ['Posso trocar o PIN temporário?', 'Sim — **Menu → Perfil → Dados Cadastrais → Senha de acesso**.'],
      ['Esqueci minha senha?', 'No passo do PIN toque **Esqueci minha senha** → confirme o e-mail → pergunta de segurança → novo PIN por e-mail.'],
    ],
  },
  {
    id: 2,
    title: 'Início, Agenda da Família e próximos eventos',
    start: 186,
    end: 298,
    qa: [
      ['Onde fica a Agenda da Família?', 'No **Início**, toque o culto/evento desejado — a Agenda sobe no lugar do inbox.'],
      ['Como inscrevo a família?', 'Abra o evento → marque os integrantes → confirme audiência/inscrição conforme as vagas.'],
      ['O carrossel do Painel ainda existe?', 'Não no caminho publicado. Use Início, menu, Eu quero… e Perfil. Cards antigos estão congelados.'],
      ['O que é pré-check-in (audiência)?', 'Confirmação de interesse antes do culto; libera fluxos de presença (totem/geofence) conforme o evento.'],
      ['Não vejo eventos?', 'Pode não haver cultos publicados ou seu perfil não tem permissão — fale com a secretaria.'],
    ],
  },
  {
    id: 3,
    title: 'Espaço Infantil (QR) e check-in do culto',
    start: 299,
    end: 391,
    qa: [
      ['Quando aparece o Check-in do Espaço Infantil?', 'Quando a família tem crianças elegíveis às salas e o evento usa esse fluxo.'],
      ['Como entrego a criança na sala?', 'Na Agenda, use o QR / Digitar Código da Família conforme a operação da igreja; o selo **Na sala** / **Liberado** acompanha o status.'],
      ['O que é check-in por proximidade?', 'Com geofence ativo, o app confirma presença ao chegar ao templo (GPS + audiência prévia).'],
      ['Onde apresento o QR no hall?', 'No **Totem de check-in** ou na Carteirinha Digital / Agenda, conforme o culto do dia.'],
    ],
  },
  {
    id: 4,
    title: 'Aniversários, sticker de novos membros e Eu quero… Contribuir',
    start: 392,
    end: 543,
    qa: [
      ['Quando aparece o bolo na Home?', 'Somente quando há aniversário pessoal ou de casamento **hoje**.'],
      ['O que é o sticker amarelo?', 'Aviso de **novos membros a admitir** — Super Admin sempre vê; secretaria/pastoral quando há fila/régua.'],
      ['Para onde o sticker me leva?', 'Com fila de recepção → **Recepção Familiar**; senão → **Mudança Papéis** já filtrada em Visitante.'],
      ['Como contribuo?', '**Eu quero… → Contribuir** → Dízimos/Ofertas, Campanhas ou Prímicias → copiar Pix.'],
    ],
  },
  {
    id: 5,
    title: 'Cuidado Pastoral, cancelamento e Abigail',
    start: 544,
    end: 696,
    qa: [
      ['Como peço oração ou conversa?', '**Eu quero… → Cuidado Pastoral** → preencha e envie. Acompanhe em Meus pedidos.'],
      ['Posso cancelar um pedido?', 'Sim — solicite cancelamento com justificativa; a equipe pastoral trata o pedido.'],
      ['O que faz o botão Excluir na engrenagem?', 'Somente **super_admin**, ao lado de Acompanhar, quando há solicitação de cancelamento — remove o pedido do banco.'],
      ['O que é a Abigail?', 'Assistente em conversa na Home (mesma linha de Eu quero…), com base na igreja da sessão.'],
    ],
  },
  {
    id: 6,
    title: 'Menu lateral e Perfil (dados, família, carteirinha, trilha)',
    start: 697,
    end: 1113,
    qa: [
      ['O que há no menu do membro?', 'Início, Perfil, Financeiro, Documentos oficiais, Célula, Escalas, murais, Apoio Mútuo, Sugestões, Como faço…?, Redes e Sobre.'],
      ['Onde edito meus dados?', '**Menu → Perfil → Dados Cadastrais**.'],
      ['Onde gerencio a família?', '**Perfil → Gerenciar Família** — inclui cuidados da criança quando aplicável.'],
      ['Onde está a Carteirinha Digital?', 'Em **Perfil**, abaixo de Gerenciar Família.'],
      ['O que é a Trilha de Discipulado?', 'Cinco passos com selos; na lição 5.1 está o Perfil Ministerial.'],
    ],
  },
  {
    id: 7,
    title: 'Documentos, Apoio Mútuo, privacidade e encerrar sessão',
    start: 1114,
    end: 0,
    qa: [
      ['Quem vê Documentos oficiais?', 'Em geral o papel **membro** — atas/publicações da igreja da sessão.'],
      ['Como funciona o Apoio Mútuo?', 'Categorias → nomes dos ofertantes → cartão com contato/QR; categorias sem oferta ficam inacessíveis.'],
      ['Como saio com segurança?', 'Menu → **Encerrar sessão**. Se a igreja ligou **Ao sair** com URL, o navegador pode ir ao site oficial.'],
      ['Uma tela sumiu do menu?', 'ACL da igreja — não é defeito do aparelho; fale com a secretaria.'],
      ['Onde está o manual completo?', '[Pacote 5](PACOTE_5_MANUAL_PAINEL.md) e [FUNCIONALIDADES.md](FUNCIONALIDADES.md).'],
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
    '**Atualizado em:** 05/10/2026',
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
    '> **Navegação atual:** Início + menu + Eu quero… + Perfil. O carrossel antigo está congelado.',
    '',
    '> **LGPD opcional:** no Dia 1, quando a igreja mantém LGPD inativo, ignore passos de termos/selfie e siga o cadastro simplificado.',
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
  '**Atualizado em:** 05/10/2026',
  '',
  'Conteúdo integrado: Funcionalidades · Manual de Treinamento · FAQ',
  '',
  'Navegação publicada: **Início + menu lateral + Eu quero… + Perfil + engrenagem**.',
], [
  { title: 'Parte 1 — Funcionalidades do Conecta+', file: 'FUNCIONALIDADES.md' },
  { title: 'Parte 2 — Manual de Treinamento (Mão na Massa)', file: 'MANUAL_TREINAMENTO.md' },
  { title: 'Parte 3 — Perguntas e Respostas (FAQ)', file: 'FAQ.md' },
]);

writePackage('PACOTE_2_OPERACAO.md', [
  '# Pacote 2 — Operação da Igreja',
  '',
  'Documentação **autocontida** para secretaria, eventos, salas Kids/Teens e líderes de escala.',
  '',
  '**Atualizado em:** 05/10/2026',
  '',
  'Conteúdo integrado: Manutenção como ecossistema · Escalas · Agenda · FAQ operacional',
], [
  { title: 'Parte 1 — Manutenção como ecossistema vivo', file: 'MANUTENCAO_ECOSISTEMA.md' },
  { title: 'Parte 2 — Escalas (Manual de Treinamento)', file: 'MANUAL_TREINAMENTO.md' },
  { title: 'Parte 3 — Agenda da Família', file: 'MANUAL_CARD1_DASHBOARD.md' },
  { title: 'Parte 4 — FAQ operacional', file: 'FAQ.md' },
]);

writePackage('PACOTE_3_GOVERNANCA_TI.md', [
  '# Pacote 3 — Governança, Permissões e TI',
  '',
  'Documentação **autocontida** para super administrador, TI e desenvolvedor.',
  '',
  '**Atualizado em:** 05/10/2026',
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
  '**Atualizado em:** 05/10/2026',
  '',
  'Conteúdo integrado: Arquitetura Blueprint PWA · Estado dos cards do Dashboard (congelados)',
], [
  { title: 'Parte 1 — Blueprint de Arquitetura e Especificação Técnica', file: 'ARQUITETURA_BLUEPRINT_PWA.md' },
  { title: 'Parte 2 — Cards do Dashboard (legado / congelado)', file: 'DASHBOARD_CARDS.md' },
]);

writePackage('PACOTE_5_MANUAL_PAINEL.md', [
  '# Pacote 5 — Manual do Membro (Início, menu, Eu quero… e Perfil)',
  '',
  'Documentação **autocontida** para primeiro acesso e uso diário.',
  '',
  '**Atualizado em:** 05/10/2026',
  '',
  'Conteúdo integrado: login por e-mail, cadastro, LGPD por instância, Início, Agenda, Espaço Infantil, Eu quero…, Abigail, menu, Perfil, Documentos oficiais e Apoio Mútuo — com ilustrações quando disponíveis.',
], [
  { title: 'Manual completo', file: 'MANUAL_DASHBOARD_MEMBRO.md' },
]);

writePackage('PACOTE_6_MANUAL_MANUTENCAO.md', [
  '# Pacote 6 — Manual da Engrenagem (manutenção)',
  '',
  'Documentação **autocontida** para quem gerencia o aplicativo: secretaria, líderes, pastoral, financeiro e TI.',
  '',
  '**Atualizado em:** 05/10/2026',
  '',
  'Conteúdo integrado: grupos da engrenagem, Recepção/Régua/sticker, Cuidados Pastorais (Excluir), Atribuições, Ghost, Assinaturas/Gestão Liberada, Controle de Acesso e operação de culto.',
], [
  { title: 'Manual completo', file: 'MANUAL_DASHBOARD_MANUTENCAO.md' },
]);

writePackage('PACOTE_7_TREINAMENTO_DIARIO.md', [
  '# Pacote 7 — Treinamento Diário do Membro',
  '',
  'Documentação **autocontida** para capacitação **dia a dia**, derivada do Pacote 5.',
  '',
  '**Atualizado em:** 05/10/2026',
  '',
  'Conteúdo integrado: **7 treinamentos diários** alinhados à navegação Início + menu + Eu quero… + Perfil, com Q&A ao final de cada dia.',
], [
  { title: 'Manual completo', file: 'MANUAL_TREINAMENTO_DIARIO.md' },
]);

console.log('Pacotes gerados com sucesso.');

/**
 * Insere blocos de ilustração anotada no MANUAL_DASHBOARD_MEMBRO.md
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const manualPath = path.join(root, 'MANUAL_DASHBOARD_MEMBRO.md');
const legends = JSON.parse(
  fs.readFileSync(path.join(root, 'docs', 'manual-painel', 'screen-legends.json'), 'utf8')
);

const anchors = [
  { after: '### Caminho\nTela **Boas-vindas**', image: '00-login.png', title: 'Boas-vindas' },
  { after: '### Caminho\nTela **Cadastro**', image: '01-cadastro.png', title: 'Cadastro inicial' },
  { after: '### Caminho\n**Dados Cadastrais** → botão **LGPD**', image: '01b-lgpd.png', title: 'Termos LGPD' },
  { after: '### Caminho\n**Índice do Aplicativo**', image: '02-indice-painel.png', title: 'Índice e Painel' },
  { after: '### Caminho\nPainel → card **Agenda da Família**', image: '03-agenda-familia.png', title: 'Agenda da Família' },
  { after: '### Caminho\nPainel → card **QR Code', image: '04-qr-checkin.png', title: 'QR Check-in' },
  { after: '### Caminho\nPainel → **SALA(S)**', image: '05-salas-kids-teens.png', title: 'SALA(S) Kids/Teens' },
  { after: '### Caminho\nPainel → **Dízimos e Ofertas**', image: '06-dizimos-ofertas.png', title: 'Dízimos e Ofertas' },
  { after: '### Caminho\nPainel → **Coração Aberto**', image: '07-coracao-aberto.png', title: 'Coração Aberto' },
  { after: '### Caminho\nPainel → **Lista de Membros**', image: '08-lista-membros.png', title: 'Lista de Membros' },
  { after: '### Caminho\nPainel → **Aniversariantes**', image: '09-aniversariantes.png', title: 'Aniversariantes' },
  { after: '### Caminho\nPainel → **Financeiro**', image: '10-financeiro.png', title: 'Financeiro' },
  { after: '   - **Resultado do mês**', image: '10a-fin-resultado.png', title: 'Financeiro — Resultado do mês' },
  { after: '   - **Comparativo mensal**', image: '10b-fin-comparativo.png', title: 'Financeiro — Comparativo mensal' },
  { after: '   - **Últimos 12 meses**', image: '10c-fin-12meses.png', title: 'Financeiro — Últimos 12 meses' },
  { after: '   - **Planejado × Realizado**', image: '10d-fin-orcamento.png', title: 'Financeiro — Planejado × Realizado' },
  { after: '   - **Saldo bancário**', image: '10e-fin-saldo.png', title: 'Financeiro — Saldo bancário' },
  { after: '### Caminho\nPainel → **Financeiro** → atalho **Relatório de Despesas (RD)**', image: '11-relatorio-despesas.png', title: 'Relatório de Despesas (RD)' },
  { after: '1. Toque **Novo RD**.', image: '11b-rd-formulario.png', title: 'Formulário de RD' },
  { after: '### Caminho\nPainel → **Escalas**', image: '12-escalas.png', title: 'Escalas' },
  { after: '### Caminho\nAparece automaticamente no carrossel', image: '12-escalas.png', title: 'Servos em escala (detalhe)' },
  { after: '### Caminho\nEscalas → escala de estacionamento', image: '13-estacionamento.png', title: 'Estacionamento' },
  { after: '### Caminho\nPainel → **Gestão de Cadastros**', image: '14-gestao-cadastros.png', title: 'Gestão de Cadastros' },
  { after: '1. Toque em **Dados Cadastrais**.', image: '15-dados-cadastrais.png', title: 'Dados Cadastrais' },
  { after: '2. Atualize **selfie**', image: '17-selfie-biometrica.png', title: 'Selfie biométrica' },
  { after: '**Gestão de Cadastros** → **Gerenciar Família**.', image: '16-gerenciar-familia.png', title: 'Gerenciar Família' },
];

function block(image, title) {
  const rows = legends[image] ?? [];
  const table = rows
    .map(([ref, text]) => `| ${ref} | ${text} |`)
    .join('\n');

  return `

### Ilustração — ${title} *(dados fictícios)*

![${title} — captura anotada](docs/manual-painel/screens/${image})

| Ref. | Elemento indicado na imagem |
|:----:|------------------------------|
${table}
`;
}

let content = fs.readFileSync(manualPath, 'utf8');

// Remove blocos de ilustração anteriores para idempotência
content = content.replace(/\n### Ilustração —[\s\S]*?(?=\n### |\n# |\n## |\n---\n\n# )/g, '\n');

content = content.replace(
  '| **Ilustração** | Mockup com **marcadores numerados**',
  '| **Ilustração** | Captura da tela com **marcadores numerados**'
);

for (const { after, image, title } of anchors) {
  const idx = content.indexOf(after);
  if (idx < 0) {
    console.warn(`Âncora não encontrada: ${after.slice(0, 40)}...`);
    continue;
  }

  const lineEnd = content.indexOf('\n', idx + after.length);
  const insertAt = lineEnd >= 0 ? lineEnd : idx + after.length;
  content = `${content.slice(0, insertAt)}${block(image, title)}${content.slice(insertAt)}`;
}

fs.writeFileSync(manualPath, content, 'utf8');
console.log('Ilustrações inseridas em MANUAL_DASHBOARD_MEMBRO.md');

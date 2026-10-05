/**
 * Insere blocos de ilustração anotada no MANUAL_DASHBOARD_MEMBRO.md
 * (âncoras alinhadas à UX Início + menu + Eu quero… — 05/10/2026).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const manualPath = path.join(root, 'MANUAL_DASHBOARD_MEMBRO.md');
const legendsPath = path.join(root, 'docs', 'manual-painel', 'screen-legends.json');
const legends = fs.existsSync(legendsPath)
  ? JSON.parse(fs.readFileSync(legendsPath, 'utf8'))
  : {};

/** Âncora = trecho único já presente no manual; imagem só entra se ainda não referenciada. */
const anchors = [
  { after: '**Boas-vindas → Celular → Continuar → Receber código por e-mail → PIN**', image: '00-login.png', title: 'Boas-vindas' },
  { after: '**Primeiro login → Cadastro → Dados pessoais → Termos LGPD → Selfie → Confirmar**', image: '01-cadastro.png', title: 'Cadastro inicial' },
  { after: '### Com LGPD inativo - passo a passo', image: '01c-cadastro-sem-lgpd.png', title: 'Cadastro simplificado (LGPD inativo)' },
  { after: '### Com LGPD ativo - passo a passo', image: '01b-lgpd.png', title: 'Termos LGPD' },
  { after: '**Menu → Início**', image: '02-indice-painel.png', title: 'Início' },
  { after: '**Início → Próximos Eventos → tocar no culto ou evento**', image: '03-agenda-familia.png', title: 'Agenda da Família' },
  { after: '**Início → Evento → Agenda da Família → Espaço Infantil | Check-In / Check-Out QR**', image: '04-qr-checkin.png', title: 'QR / Espaço Infantil' },
  { after: '**Início → Eu quero… → Contribuir**', image: '06-dizimos-ofertas.png', title: 'Dízimos e Ofertas' },
  { after: '**Início → Eu quero… → Cuidado Pastoral**', image: '07-coracao-aberto.png', title: 'Cuidado Pastoral' },
  { after: '**Menu → Perfil → Dados Cadastrais**', image: '15-dados-cadastrais.png', title: 'Dados Cadastrais' },
  { after: '**Menu → Perfil → Gerenciar Família**', image: '16-gerenciar-familia.png', title: 'Gerenciar Família' },
  { after: '**Menu → Perfil → Reembolsos → Novo RD**', image: '11-relatorio-despesas.png', title: 'Relatório de Despesas' },
  { after: '**Menu → Apoio Mútuo**', image: 'apoio-mutuo.png', title: 'Apoio Mútuo' },
  { after: '**Menu → módulo autorizado**', image: '08-lista-membros.png', title: 'Lista de Membros' },
];

function block(image, title) {
  const rows = legends[image] ?? [];
  const table = rows.length
    ? rows.map(([ref, text]) => `| ${ref} | ${text} |`).join('\n')
    : '| — | Captura de referência da tela publicada |';

  return `

### Ilustração — ${title}

![${title} — captura anotada](docs/manual-painel/screens/${image})

| Ref. | Elemento indicado na imagem |
|:----:|------------------------------|
${table}
`;
}

let content = fs.readFileSync(manualPath, 'utf8');

content = content.replace(/\n### Ilustração —[\s\S]*?(?=\n### |\n# |\n## |\n---\n)/g, '\n');

let inserted = 0;
let skipped = 0;

for (const { after, image, title } of anchors) {
  if (content.includes(`docs/manual-painel/screens/${image}`)) {
    skipped += 1;
    continue;
  }

  const idx = content.indexOf(after);
  if (idx < 0) {
    console.warn(`Âncora não encontrada: ${after.slice(0, 60)}...`);
    continue;
  }

  const lineEnd = content.indexOf('\n', idx + after.length);
  const insertAt = lineEnd >= 0 ? lineEnd : idx + after.length;
  content = `${content.slice(0, insertAt)}${block(image, title)}${content.slice(insertAt)}`;
  inserted += 1;
}

fs.writeFileSync(manualPath, content, 'utf8');
console.log(`Ilustrações painel: +${inserted} inseridas, ${skipped} já presentes.`);

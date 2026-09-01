import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mdToPdf } from 'md-to-pdf';
import { CHAPTERS, STOPS } from './roteiro-institucional-catalog.mjs';
import {
  resolveStopScreenshots,
  unusedScreenshots,
} from './roteiro-screenshot-resolver.mjs';
import { pdfCss as baseAnaliseCss } from './build-analise-institucional-telas-pdf.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'pdfs');
const mdPath = path.join(root, 'ROTEIRO_INSTITUCIONAL_APP.md');
const outputPath = path.join(outDir, 'ROTEIRO_INSTITUCIONAL_APP.pdf');
const logoAbs = path.join(root, 'images', 'conecta.png');

const extraCss = `
  ${baseAnaliseCss}
  .cover-logo {
    width: 42mm;
    height: auto;
    margin-bottom: 18px;
  }
  .shots {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 10px 0 6px;
    justify-content: center;
    align-items: flex-start;
  }
  .shots figure {
    margin: 0;
    flex: 1 1 46%;
    max-width: 48%;
    text-align: center;
  }
  .shots img {
    width: 100%;
    max-height: 88mm;
    object-fit: contain;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    background: #f8fafc;
  }
  .shots.single figure { max-width: 72%; flex-basis: 72%; }
  .shot-cap {
    font-size: 7.5pt;
    color: #64748b;
    margin-top: 4px;
  }
  .missing-shot {
    font-size: 8.5pt;
    color: #94a3b8;
    font-style: italic;
    margin: 8px 0;
  }
  .appendix img {
    max-height: 70mm;
    object-fit: contain;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    background: #fff;
  }
`;

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function shotsHtml(images) {
  if (!images.length) {
    return '<p class="missing-shot">Recorte original desta parada ainda não está na pasta Screeshot/ ou nos manuais — o roteiro descreve a tela mesmo assim.</p>';
  }

  const cls = images.length === 1 ? 'shots single' : 'shots';
  const figures = images
    .map(
      (img) =>
        `<figure><img src="${img.href}" alt="${escapeHtml(img.name)}" /><figcaption class="shot-cap">${escapeHtml(img.rel)}</figcaption></figure>`
    )
    .join('\n');

  return `<div class="${cls}">${figures}</div>`;
}

function buildMarkdown(rootDir) {
  const usedAbs = new Set();
  const logoHref = fs.existsSync(logoAbs) ? pathToFileURL(logoAbs).href : '';

  let md = `<div class="cover">
${logoHref ? `<img class="cover-logo" src="${logoHref}" alt="Conecta+" />` : ''}
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

`;

  for (const chapter of CHAPTERS) {
    const stops = STOPS.filter((stop) => stop.chapter === chapter.id);
    md += `\n# Parte ${chapter.id} — ${escapeHtml(chapter.title)}\n\n`;

    for (const stop of stops) {
      const { images, usedAbs: stopUsed } = resolveStopScreenshots(rootDir, stop.shots ?? []);
      for (const abs of stopUsed) {
        usedAbs.add(abs);
      }

      md += `<div class="screen">

## ${escapeHtml(stop.title)}

<p class="route">${escapeHtml(stop.route)}</p>

${shotsHtml(images)}

### Onde estamos na jornada

${escapeHtml(stop.place)}

### O que se encontra — e por quê

${escapeHtml(stop.what)}

${escapeHtml(stop.why)}

### Conexões internas e quem conduz

${escapeHtml(stop.links)}

<div class="split">
<div class="vision user">
<h4>Visão do Usuário Final</h4>
${escapeHtml(stop.user)}
</div>
<div class="vision admin">
<h4>Visão da Administração</h4>
${escapeHtml(stop.admin)}
</div>
</div>
</div>

`;
    }
  }

  const leftovers = unusedScreenshots(rootDir, usedAbs);
  md += `\n# Apêndice — recortes originais ainda não amarrados a uma parada\n\n`;
  md += leftovers.length
    ? 'Estes arquivos estavam nas pastas de assets e entram no guia para nenhum recorte ficar de fora.\n\n<div class="appendix">\n'
    : 'Todos os recortes encontrados nas pastas de assets foram associados a pelo menos uma parada.\n';

  for (const file of leftovers) {
    md += `<figure><img src="${pathToFileURL(file.abs).href}" alt="${escapeHtml(file.name)}" /><figcaption class="shot-cap">${escapeHtml(file.rel)}</figcaption></figure>\n`;
  }

  if (leftovers.length) {
    md += '</div>\n';
  }

  md += `\n# Encerramento\n\nA casa digital começa no telefone e termina na prestação de contas — passando pelo abraço da recepção, pelo raio de trinta metros do templo, pelo totem do hall e pela engrenagem que só a liderança gira. O membro vive a praça. A administração vive o ofício. O Conecta+ é o corredor que os une, sem planilha paralela e sem carrossel a mais.\n`;

  return { markdown: md, usedCount: usedAbs.size, leftoverCount: leftovers.length };
}

fs.mkdirSync(outDir, { recursive: true });

const { markdown, usedCount, leftoverCount } = buildMarkdown(root);
fs.writeFileSync(mdPath, markdown, 'utf8');
console.log(`Markdown salvo em: ${mdPath}`);
console.log(`Recortes amarrados: ${usedCount} · apêndice: ${leftoverCount}`);
console.log('Gerando ROTEIRO_INSTITUCIONAL_APP.pdf ...');

const pdf = await mdToPdf(
  { content: markdown },
  {
    dest: outputPath,
    pdf_options: {
      format: 'A4',
      margin: { top: '16mm', right: '14mm', bottom: '20mm', left: '14mm' },
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate:
        '<div style="width:100%;font-size:8px;color:#64748b;padding:0 14mm;display:flex;justify-content:space-between;">'
        + '<span>Roteiro institucional Conecta+</span>'
        + '<span>Jornada de ponta a ponta</span>'
        + '</div>',
      footerTemplate:
        '<div style="width:100%;font-size:8px;color:#64748b;text-align:center;padding:0 14mm;">'
        + 'Documento de apresentação · Página <span class="pageNumber"></span> de <span class="totalPages"></span>'
        + '</div>',
    },
    css: extraCss,
    launch_options: {
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
  }
);

if (!pdf?.filename) {
  throw new Error('PDF não gerado');
}

console.log(`PDF salvo em: ${outputPath}`);

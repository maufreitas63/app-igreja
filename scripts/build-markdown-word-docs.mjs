/**
 * Converte os markdowns de pacotes e manuais em .doc (HTML Word)
 * para abrir no Microsoft Office.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'pdfs');

const files = [
  'INDICE_DOCUMENTACAO.md',
  'PACOTE_1_VISAO_GERAL.md',
  'PACOTE_2_OPERACAO.md',
  'PACOTE_3_GOVERNANCA_TI.md',
  'PACOTE_4_ANEXO_TECNICO.md',
  'PACOTE_5_MANUAL_PAINEL.md',
  'MANUAL_DASHBOARD_MEMBRO.md',
  'PACOTE_6_MANUAL_MANUTENCAO.md',
  'MANUAL_DASHBOARD_MANUTENCAO.md',
  'PACOTE_7_TREINAMENTO_DIARIO.md',
  'MANUAL_TREINAMENTO_DIARIO.md',
  'FUNCIONALIDADES.md',
  'MANUAL_TREINAMENTO.md',
  'FAQ.md',
  'MANUTENCAO_ECOSISTEMA.md',
  'MANUAL_CARD1_DASHBOARD.md',
  'MANUAL_CONTROLE_ACESSO.md',
  'CONTROLE_ACESSO.md',
  'CAMADAS_SEGURANCA.md',
  'BLUEPRINT.md',
  'ARQUITETURA_BLUEPRINT_PWA.md',
  'DASHBOARD_CARDS.md',
  'README.md',
  'CHECKLIST_VALIDACAO_POS_DEPLOY.md',
  'DEPLOY_CLOUDFLARE.md',
  'PAPEIS_CONTROLE_ACESSO.md',
  'MANUAL_ENTREGA.md',
  'DESCRITIVO_APLICACAO.md',
];

const mimeByExt = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const inlineHtml = (text) => {
  const escaped = escapeHtml(text);
  return escaped
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      (_all, label, href) => `<a href="${escapeHtml(href)}">${escapeHtml(label)}</a>`
    );
};

const resolveImageSrc = (rawHref, mdDir) => {
  const href = rawHref.trim().replace(/^<|>$/g, '');
  if (/^https?:\/\//i.test(href) || href.startsWith('data:')) {
    return href;
  }

  const abs = path.resolve(mdDir, href.split('?')[0].split('#')[0]);
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
    return null;
  }

  const ext = path.extname(abs).toLowerCase();
  const mime = mimeByExt[ext];
  if (!mime) {
    return pathToFileURL(abs).href;
  }

  const data = fs.readFileSync(abs).toString('base64');
  return `data:${mime};base64,${data}`;
};

const markdownToWordBody = (markdown, mdDir) => {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const html = [];
  let i = 0;
  const listItems = [];

  const flushList = () => {
    if (!listItems.length) return;
    html.push('<ul>');
    for (const item of listItems) {
      html.push(`<li>${inlineHtml(item)}</li>`);
    }
    html.push('</ul>');
    listItems.length = 0;
  };

  while (i < lines.length) {
    const trimmed = lines[i].trim();

    const image = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (image) {
      flushList();
      const src = resolveImageSrc(image[2], mdDir);
      if (src) {
        html.push(
          `<p style="text-align:center"><img src="${src}" alt="${escapeHtml(image[1])}" /></p>`
        );
        if (image[1]) {
          html.push(`<p style="text-align:center;font-size:9pt;color:#64748B">${escapeHtml(image[1])}</p>`);
        }
      } else {
        html.push(
          `<p style="font-size:9.5pt;color:#94A3B8;font-style:italic">Ilustração indisponível neste recorte (${escapeHtml(image[2])}).</p>`
        );
      }
      i += 1;
      continue;
    }

    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      listItems.push(trimmed.slice(2));
      i += 1;
      continue;
    }

    flushList();

    if (!trimmed) {
      i += 1;
      continue;
    }

    if (trimmed === '---') {
      html.push('<hr>');
      i += 1;
      continue;
    }

    if (trimmed.startsWith('# ')) {
      html.push(`<h1>${inlineHtml(trimmed.slice(2))}</h1>`);
      i += 1;
      continue;
    }

    if (trimmed.startsWith('## ')) {
      html.push(`<h2>${inlineHtml(trimmed.slice(3))}</h2>`);
      i += 1;
      continue;
    }

    if (trimmed.startsWith('### ')) {
      html.push(`<h3>${inlineHtml(trimmed.slice(4))}</h3>`);
      i += 1;
      continue;
    }

    if (trimmed.startsWith('#### ')) {
      html.push(`<h4>${inlineHtml(trimmed.slice(5))}</h4>`);
      i += 1;
      continue;
    }

    if (trimmed.startsWith('|')) {
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const raw = lines[i].trim();
        if (!raw.includes('---')) {
          const cells = raw
            .split('|')
            .slice(1, -1)
            .map((cell) => cell.trim());
          if (cells.length) rows.push(cells);
        }
        i += 1;
      }

      if (rows.length) {
        const [header, ...body] = rows;
        html.push('<table><thead><tr>');
        for (const cell of header) html.push(`<th>${inlineHtml(cell)}</th>`);
        html.push('</tr></thead><tbody>');
        for (const row of body) {
          html.push('<tr>');
          for (const cell of row) html.push(`<td>${inlineHtml(cell)}</td>`);
          html.push('</tr>');
        }
        html.push('</tbody></table>');
      }
      continue;
    }

    if (trimmed.startsWith('<')) {
      html.push(lines[i]);
      i += 1;
      continue;
    }

    if (trimmed.startsWith('> ')) {
      html.push(`<blockquote>${inlineHtml(trimmed.slice(2))}</blockquote>`);
      i += 1;
      continue;
    }

    html.push(`<p>${inlineHtml(trimmed)}</p>`);
    i += 1;
  }

  flushList();
  return html.join('\n');
};

const wordCss = `
  body { font-family: Calibri, Segoe UI, sans-serif; font-size: 11pt; color: #1E293B; line-height: 1.45; }
  h1 { font-size: 18pt; color: #0F172A; border-bottom: 1.5pt solid #1E40AF; padding-bottom: 4pt; }
  h2 { font-size: 14pt; color: #1E3A8A; margin-top: 14pt; }
  h3 { font-size: 12pt; color: #1E40AF; margin-top: 10pt; }
  h4 { font-size: 11pt; color: #1D4ED8; }
  p { margin: 0 0 8pt; }
  ul { margin: 0 0 10pt 18pt; }
  li { margin-bottom: 3pt; }
  code { font-family: Consolas, Courier New, monospace; font-size: 9.5pt; color: #1E40AF; background: #F1F5F9; }
  table { border-collapse: collapse; width: 100%; font-size: 10pt; margin: 8pt 0 14pt; }
  th { background: #1E3A8A; color: #FFFFFF; text-align: left; padding: 6pt 8pt; }
  td { border: 0.5pt solid #CBD5E1; padding: 6pt 8pt; vertical-align: top; }
  hr { border: none; border-top: 0.75pt solid #E2E8F0; margin: 12pt 0; }
  img { max-width: 420px; max-height: 480px; height: auto; }
  blockquote { border-left: 3pt solid #94A3B8; margin-left: 0; padding-left: 10pt; color: #475569; }
  @page Section1 { size: 21cm 29.7cm; margin: 16mm 14mm 20mm 14mm; }
  div.Section1 { page: Section1; }
`;

fs.mkdirSync(outDir, { recursive: true });

let written = 0;
for (const file of files) {
  const inputPath = path.join(root, file);
  if (!fs.existsSync(inputPath)) {
    console.warn(`Ignorado (não encontrado): ${file}`);
    continue;
  }

  const markdown = fs.readFileSync(inputPath, 'utf8');
  const title = markdown
    .split('\n')
    .find((line) => line.startsWith('# '))
    ?.slice(2)
    .trim() || file.replace(/\.md$/i, '');
  const body = markdownToWordBody(markdown, path.dirname(inputPath));
  const wordHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
xmlns:w="urn:schemas-microsoft-com:office:word"
xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
<meta name="ProgId" content="Word.Document">
<meta name="Generator" content="Microsoft Word 15">
<title>${escapeHtml(title)}</title>
<style>
${wordCss}
</style>
</head>
<body>
<div class="Section1">
${body}
</div>
</body>
</html>
`;

  const outputPath = path.join(outDir, file.replace(/\.md$/i, '.doc'));
  fs.writeFileSync(outputPath, `\ufeff${wordHtml}`, 'utf8');
  written += 1;
  console.log(`DOC: ${path.relative(root, outputPath)}`);
}

console.log(`Pronto: ${written} arquivos .doc em pdfs/`);

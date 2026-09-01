import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const inputPath = path.join(root, 'ROTEIRO_INSTITUCIONAL_APP.md');
const docPath = path.join(root, 'ROTEIRO_INSTITUCIONAL_APP.doc');

const mimeByExt = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

const escapeText = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const inlineMarkdown = (text) =>
  escapeText(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');

const parseTable = (lines, start) => {
  const rows = [];
  let i = start;

  while (i < lines.length && lines[i].trim().startsWith('|')) {
    const raw = lines[i].trim();
    if (!raw.includes('---')) {
      const cells = raw
        .split('|')
        .slice(1, -1)
        .map((cell) => cell.trim());
      if (cells.length) {
        rows.push(cells);
      }
    }
    i += 1;
  }

  if (!rows.length) {
    return { html: '', next: i };
  }

  const [header, ...body] = rows;
  const html = [
    '<table>',
    '<thead><tr>',
    ...header.map((cell) => `<th>${inlineMarkdown(cell)}</th>`),
    '</tr></thead><tbody>',
    ...body.map(
      (row) => `<tr>${row.map((cell) => `<td>${inlineMarkdown(cell)}</td>`).join('')}</tr>`
    ),
    '</tbody></table>',
  ].join('');

  return { html, next: i };
};

const markdownToWordBody = (markdown) => {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const html = [];
  let i = 0;

  while (i < lines.length) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    if (trimmed.startsWith('|')) {
      const parsed = parseTable(lines, i);
      html.push(parsed.html);
      i = parsed.next;
      continue;
    }

    if (trimmed.startsWith('# ')) {
      html.push(`<h1>${inlineMarkdown(trimmed.slice(2))}</h1>`);
      i += 1;
      continue;
    }

    if (trimmed.startsWith('## ')) {
      html.push(`<h2>${inlineMarkdown(trimmed.slice(3))}</h2>`);
      i += 1;
      continue;
    }

    if (trimmed.startsWith('### ')) {
      html.push(`<h3>${inlineMarkdown(trimmed.slice(4))}</h3>`);
      i += 1;
      continue;
    }

    if (trimmed.startsWith('<')) {
      html.push(rawLine);
      i += 1;
      continue;
    }

    html.push(`<p>${inlineMarkdown(trimmed)}</p>`);
    i += 1;
  }

  return html.join('\n');
};

const embedLocalImages = (html) =>
  html.replace(/src="(file:\/\/[^"]+)"/gi, (_all, href) => {
    try {
      const abs = fileURLToPath(href);
      if (!fs.existsSync(abs)) {
        return 'src=""';
      }

      const ext = path.extname(abs).toLowerCase();
      const mime = mimeByExt[ext] ?? 'image/png';
      const data = fs.readFileSync(abs).toString('base64');
      return `src="data:${mime};base64,${data}"`;
    } catch {
      return 'src=""';
    }
  });

const wordCss = `
  body { font-family: Calibri, Segoe UI, sans-serif; font-size: 11pt; color: #1E293B; line-height: 1.45; }
  h1 { font-size: 20pt; color: #0F172A; border-bottom: 2pt solid #1E40AF; padding-bottom: 6pt; page-break-after: avoid; }
  h2 { font-size: 15pt; color: #1E3A8A; margin-top: 16pt; page-break-after: avoid; }
  h3 { font-size: 12.5pt; color: #1E40AF; margin-top: 10pt; page-break-after: avoid; }
  p { margin: 0 0 8pt; }
  code { font-family: Consolas, Courier New, monospace; font-size: 9.5pt; color: #1E40AF; background: #F1F5F9; }
  table { border-collapse: collapse; width: 100%; font-size: 10pt; margin: 8pt 0 14pt; }
  th { background: #1E3A8A; color: #FFFFFF; text-align: left; padding: 6pt 8pt; }
  td { border: 0.5pt solid #CBD5E1; padding: 6pt 8pt; vertical-align: top; }
  .cover { page-break-after: always; padding: 24pt 8pt; }
  .cover-kicker { color: #1D4ED8; font-size: 11pt; font-weight: 700; letter-spacing: 2pt; text-transform: uppercase; }
  .cover-sub { font-size: 13pt; color: #334155; }
  .cover-meta { border-top: 3pt solid #1E40AF; padding-top: 12pt; color: #475569; font-size: 10pt; }
  .cover-logo { width: 120px; height: auto; margin-bottom: 16pt; }
  .screen { border: 0.75pt solid #E2E8F0; padding: 10pt 12pt; margin: 12pt 0 16pt; page-break-inside: avoid; }
  .route { font-family: Consolas, Courier New, monospace; font-size: 8.5pt; color: #1E40AF; background: #EFF6FF; padding: 1pt 6pt; }
  .split { width: 100%; }
  .vision { font-size: 10pt; padding: 8pt 10pt; }
  .user { background: #F0FDF4; border-left: 4pt solid #15803D; }
  .admin { background: #EFF6FF; border-left: 4pt solid #1D4ED8; }
  .shots { text-align: center; margin: 10pt 0; }
  .shots img, .appendix img, figure img { max-width: 320px; max-height: 420px; height: auto; border: 0.75pt solid #CBD5E1; }
  .shot-cap { font-size: 8pt; color: #64748B; }
  .missing-shot { font-size: 9.5pt; color: #94A3B8; font-style: italic; }
  figure { display: inline-block; margin: 6pt 8pt; vertical-align: top; text-align: center; }
  @page Section1 { size: 21cm 29.7cm; margin: 16mm 14mm 20mm 14mm; }
  div.Section1 { page: Section1; }
`;

if (!fs.existsSync(inputPath)) {
  throw new Error(`Arquivo não encontrado: ${inputPath}`);
}

const markdown = fs.readFileSync(inputPath, 'utf8');
const body = embedLocalImages(markdownToWordBody(markdown));

const wordHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
xmlns:w="urn:schemas-microsoft-com:office:word"
xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
<meta name="ProgId" content="Word.Document">
<meta name="Generator" content="Microsoft Word 15">
<title>Roteiro institucional Conecta+ — jornada de ponta a ponta</title>
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

const payload = `\ufeff${wordHtml}`;
fs.writeFileSync(docPath, payload, 'utf8');

console.log(`DOC salvo em: ${docPath}`);
console.log(`Tamanho: ${(Buffer.byteLength(payload, 'utf8') / (1024 * 1024)).toFixed(1)} MB`);

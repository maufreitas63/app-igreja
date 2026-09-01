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
  LineRuleType,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const inputPath = path.join(root, 'pacotes-funcionalidades.md');
const docxPath = path.join(root, 'pacotes-funcionalidades.docx');
const docPath = path.join(root, 'pacotes-funcionalidades.doc');

const C = {
  slate900: '0F172A',
  slate800: '1E293B',
  slate600: '475569',
  slate500: '64748B',
  blue900: '1E3A8A',
  blue800: '1E40AF',
  blue100: 'DBEAFE',
  slate100: 'F1F5F9',
  slate50: 'F8FAFC',
  border: 'E2E8F0',
  tableBorder: 'CBD5E1',
};

const PAGE_WIDTH_DXA = 10320;
const cellMargins = { top: 80, bottom: 80, left: 120, right: 120 };

const inlineRuns = (text, extras = {}) => {
  const runs = [];
  const token = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let last = 0;
  let match;

  while ((match = token.exec(text)) !== null) {
    if (match.index > last) {
      runs.push(new TextRun({ text: text.slice(last, match.index), ...extras }));
    }

    const raw = match[0];
    if (raw.startsWith('`')) {
      runs.push(
        new TextRun({
          text: raw.slice(1, -1),
          font: 'Consolas',
          size: extras.size ? Math.max(16, extras.size - 2) : 16,
          color: C.blue800,
          shading: { type: ShadingType.CLEAR, fill: C.slate100 },
          ...extras,
          italics: extras.italics,
          bold: extras.bold,
        })
      );
    } else if (raw.startsWith('**')) {
      runs.push(new TextRun({ text: raw.slice(2, -2), bold: true, ...extras }));
    } else {
      runs.push(new TextRun({ text: raw.slice(1, -1), italics: true, ...extras }));
    }

    last = match.index + raw.length;
  }

  if (last < text.length) {
    runs.push(new TextRun({ text: text.slice(last), ...extras }));
  }

  if (!runs.length) {
    runs.push(new TextRun({ text: text || '', ...extras }));
  }

  return runs;
};

const para = (text, options = {}) =>
  new Paragraph({
    spacing: { after: options.after ?? 120, line: 276, lineRule: LineRuleType.AUTO },
    alignment: options.alignment,
    children: inlineRuns(text, {
      font: options.font ?? 'Calibri',
      size: options.size ?? 22,
      color: options.color ?? C.slate800,
      bold: options.bold,
      italics: options.italics,
    }),
  });

const heading1 = (text) =>
  new Paragraph({
    heading: HeadingLevel.HEADING_1,
    keepNext: true,
    border: { bottom: { style: BorderStyle.SINGLE, size: 18, color: C.blue800, space: 4 } },
    spacing: { before: 280, after: 200 },
    children: [new TextRun({ text, font: 'Calibri', size: 40, bold: true, color: C.slate900 })],
  });

const heading2 = (text) =>
  new Paragraph({
    heading: HeadingLevel.HEADING_2,
    keepNext: true,
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: C.blue100, space: 2 } },
    spacing: { before: 280, after: 140 },
    children: [new TextRun({ text, font: 'Calibri', size: 28, bold: true, color: C.blue900 })],
  });

const heading3 = (text) =>
  new Paragraph({
    heading: HeadingLevel.HEADING_3,
    keepNext: true,
    spacing: { before: 180, after: 80 },
    children: [new TextRun({ text, font: 'Calibri', size: 24, bold: true, color: C.blue800 })],
  });

const emptyLine = (after = 80) =>
  new Paragraph({ spacing: { after }, children: [new TextRun({ text: '' })] });

const bulletItem = (text) =>
  new Paragraph({
    numbering: { reference: 'bullets', level: 0 },
    spacing: { after: 60, line: 276, lineRule: LineRuleType.AUTO },
    children: inlineRuns(text, { font: 'Calibri', size: 22, color: C.slate800 }),
  });

const markdownTable = (rows) => {
  const [header, ...body] = rows;
  const colWidth = Math.floor(PAGE_WIDTH_DXA / Math.max(header.length, 1));

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: header.map(() => colWidth),
    rows: [
      new TableRow({
        tableHeader: true,
        children: header.map(
          (cell) =>
            new TableCell({
              width: { size: colWidth, type: WidthType.DXA },
              shading: { type: ShadingType.CLEAR, fill: C.blue900 },
              margins: cellMargins,
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: cell.replace(/\*\*/g, '').replace(/`/g, ''),
                      bold: true,
                      color: 'FFFFFF',
                      font: 'Calibri',
                      size: 18,
                    }),
                  ],
                }),
              ],
            })
        ),
      }),
      ...body.map(
        (row, rowIndex) =>
          new TableRow({
            children: row.map(
              (cell) =>
                new TableCell({
                  width: { size: colWidth, type: WidthType.DXA },
                  shading: {
                    type: ShadingType.CLEAR,
                    fill: rowIndex % 2 === 1 ? C.slate50 : 'FFFFFF',
                  },
                  margins: cellMargins,
                  borders: {
                    top: { style: BorderStyle.SINGLE, size: 4, color: C.tableBorder },
                    bottom: { style: BorderStyle.SINGLE, size: 4, color: C.tableBorder },
                    left: { style: BorderStyle.SINGLE, size: 4, color: C.tableBorder },
                    right: { style: BorderStyle.SINGLE, size: 4, color: C.tableBorder },
                  },
                  children: [
                    new Paragraph({
                      children: inlineRuns(cell, { font: 'Calibri', size: 18, color: C.slate800 }),
                    }),
                  ],
                })
            ),
          })
      ),
    ],
  });
};

const parseTable = (lines, start) => {
  const rows = [];
  let i = start;

  while (i < lines.length && lines[i].trim().startsWith('|')) {
    const raw = lines[i].trim();
    if (raw.includes('---')) {
      i += 1;
      continue;
    }

    const cells = raw
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim());

    if (cells.length) {
      rows.push(cells);
    }

    i += 1;
  }

  return { table: markdownTable(rows), next: i };
};

const buildChildren = (markdown) => {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const children = [];
  let i = 0;

  while (i < lines.length) {
    const trimmed = lines[i].trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    if (trimmed === '---') {
      children.push(emptyLine(60));
      i += 1;
      continue;
    }

    if (trimmed.startsWith('# ')) {
      children.push(heading1(trimmed.replace(/^#\s+/, '')));
      i += 1;
      continue;
    }

    if (trimmed.startsWith('## ')) {
      children.push(heading2(trimmed.replace(/^##\s+/, '')));
      i += 1;
      continue;
    }

    if (trimmed.startsWith('### ')) {
      children.push(heading3(trimmed.replace(/^###\s+/, '')));
      i += 1;
      continue;
    }

    if (trimmed.startsWith('|')) {
      const parsed = parseTable(lines, i);
      children.push(parsed.table, emptyLine(140));
      i = parsed.next;
      continue;
    }

    if (trimmed.startsWith('- ')) {
      children.push(bulletItem(trimmed.slice(2)));
      i += 1;
      continue;
    }

    children.push(para(trimmed));
    i += 1;
  }

  return children;
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
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
};

const markdownToWordBody = (markdown) => {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const html = [];
  let i = 0;

  const flushList = (items) => {
    if (!items.length) return;
    html.push('<ul>');
    for (const item of items) {
      html.push(`<li>${inlineHtml(item)}</li>`);
    }
    html.push('</ul>');
    items.length = 0;
  };

  const listItems = [];

  while (i < lines.length) {
    const trimmed = lines[i].trim();

    if (trimmed.startsWith('- ')) {
      listItems.push(trimmed.slice(2));
      i += 1;
      continue;
    }

    flushList(listItems);

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
        html.push('<table>');
        html.push('<thead><tr>');
        for (const cell of header) {
          html.push(`<th>${inlineHtml(cell)}</th>`);
        }
        html.push('</tr></thead><tbody>');
        for (const row of body) {
          html.push('<tr>');
          for (const cell of row) {
            html.push(`<td>${inlineHtml(cell)}</td>`);
          }
          html.push('</tr>');
        }
        html.push('</tbody></table>');
      }
      continue;
    }

    html.push(`<p>${inlineHtml(trimmed)}</p>`);
    i += 1;
  }

  flushList(listItems);
  return html.join('\n');
};

if (!fs.existsSync(inputPath)) {
  throw new Error(`Arquivo não encontrado: ${inputPath}`);
}

const markdown = fs.readFileSync(inputPath, 'utf8');

const doc = new Document({
  title: 'Pacotes de funcionalidades — Conecta+',
  creator: 'Conecta+',
  description: 'Recorte comercial das facilidades já entregues no código, em três pacotes.',
  styles: {
    default: {
      document: {
        run: { font: 'Calibri', size: 22, color: C.slate800 },
      },
    },
  },
  numbering: {
    config: [
      {
        reference: 'bullets',
        levels: [
          {
            level: 0,
            format: 'bullet',
            text: '•',
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 420, hanging: 280 } } },
          },
        ],
      },
    ],
  },
  sections: [
    {
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 907, right: 794, bottom: 1134, left: 794 },
        },
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              tabStops: [{ type: 'right', position: PAGE_WIDTH_DXA }],
              children: [
                new TextRun({
                  text: 'Pacotes de funcionalidades — Conecta+',
                  font: 'Calibri',
                  size: 16,
                  color: C.slate500,
                }),
                new TextRun({ text: '\t', font: 'Calibri', size: 16 }),
                new TextRun({
                  text: 'Básico · Padrão · Avançado',
                  font: 'Calibri',
                  size: 16,
                  color: C.slate500,
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
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: 'Documento comercial · Página ',
                  font: 'Calibri',
                  size: 16,
                  color: C.slate500,
                }),
                new TextRun({
                  children: [PageNumber.CURRENT],
                  font: 'Calibri',
                  size: 16,
                  color: C.slate500,
                }),
                new TextRun({ text: ' de ', font: 'Calibri', size: 16, color: C.slate500 }),
                new TextRun({
                  children: [PageNumber.TOTAL_PAGES],
                  font: 'Calibri',
                  size: 16,
                  color: C.slate500,
                }),
              ],
            }),
          ],
        }),
      },
      children: buildChildren(markdown),
    },
  ],
});

const buffer = await Packer.toBuffer(doc);
fs.writeFileSync(docxPath, buffer);

const wordCss = `
  body { font-family: Calibri, sans-serif; font-size: 12pt; color: #1E293B; line-height: 1.45; }
  h1 { font-size: 20pt; color: #0F172A; border-bottom: 2pt solid #1E40AF; padding-bottom: 4pt; }
  h2 { font-size: 16pt; color: #1E3A8A; margin-top: 18pt; }
  h3 { font-size: 13pt; color: #1E40AF; margin-top: 12pt; }
  p { margin: 0 0 8pt; }
  ul { margin: 0 0 10pt 18pt; }
  li { margin-bottom: 4pt; }
  code { font-family: Consolas, Courier New, monospace; font-size: 10pt; color: #1E40AF; background: #F1F5F9; }
  table { border-collapse: collapse; width: 100%; font-size: 10.5pt; margin: 8pt 0 14pt; }
  th { background: #1E3A8A; color: #FFFFFF; text-align: left; padding: 6pt 8pt; }
  td { border: 0.5pt solid #CBD5E1; padding: 6pt 8pt; vertical-align: top; }
  hr { border: none; border-top: 0.75pt solid #E2E8F0; margin: 12pt 0; }
  @page Section1 {
    size: 21cm 29.7cm;
    margin: 16mm 14mm 20mm 14mm;
  }
  div.Section1 { page: Section1; }
`;

const wordHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
xmlns:w="urn:schemas-microsoft-com:office:word"
xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
<meta name="ProgId" content="Word.Document">
<meta name="Generator" content="Microsoft Word 15">
<title>Pacotes de funcionalidades — Conecta+</title>
<style>
${wordCss}
</style>
</head>
<body>
<div class="Section1">
${markdownToWordBody(markdown)}
</div>
</body>
</html>
`;

fs.writeFileSync(docPath, `\ufeff${wordHtml}`, 'utf8');
console.log(`DOC salvo em: ${docPath}`);
console.log(`DOCX (Word nativo) salvo em: ${docxPath}`);

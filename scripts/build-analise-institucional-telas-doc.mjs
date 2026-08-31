import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mdToPdf } from 'md-to-pdf';
import { pdfCss } from './build-analise-institucional-telas-pdf.mjs';
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  HeightRule,
  LineRuleType,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from 'docx';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const inputPath = path.join(root, 'ANALISE_INSTITUCIONAL_TELAS.md');
const outDir = path.join(root, 'pdfs');
const docxPath = path.join(outDir, 'ANALISE_INSTITUCIONAL_TELAS.docx');
const docPath = path.join(outDir, 'ANALISE_INSTITUCIONAL_TELAS.doc');

const C = {
  slate900: '0F172A',
  slate800: '1E293B',
  slate700: '334155',
  slate600: '475569',
  slate500: '64748B',
  blue900: '1E3A8A',
  blue800: '1E40AF',
  blue700: '1D4ED8',
  blue100: 'DBEAFE',
  blue50: 'EFF6FF',
  green800: '166534',
  green700: '15803D',
  green50: 'F0FDF4',
  slate100: 'F1F5F9',
  slate50: 'F8FAFC',
  border: 'E2E8F0',
  tableBorder: 'CBD5E1',
};

const PAGE_WIDTH_DXA = 10320;
const THIN = { style: BorderStyle.SINGLE, size: 4, color: C.border };
const NONE = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const noBorders = { top: NONE, bottom: NONE, left: NONE, right: NONE };

const cellMargins = { top: 80, bottom: 80, left: 120, right: 120 };

const stripTags = (value) =>
  value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[ \t]+\n/g, '\n')
    .trim();

const inlineRuns = (text, extras = {}) => {
  const runs = [];
  const token = /(`[^`]+`|\*\*[^*]+\*\*)/g;
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
          bold: extras.bold,
        })
      );
    } else {
      runs.push(new TextRun({ text: raw.slice(2, -2), bold: true, ...extras }));
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
    keepNext: options.keepNext,
    children: inlineRuns(text, {
      font: options.font ?? 'Calibri',
      size: options.size ?? 20,
      color: options.color ?? C.slate800,
      bold: options.bold,
      italics: options.italics,
      allCaps: options.allCaps,
      characterSpacing: options.characterSpacing,
    }),
  });

const heading1 = (text) =>
  new Paragraph({
    heading: HeadingLevel.HEADING_1,
    keepNext: true,
    border: { bottom: { style: BorderStyle.SINGLE, size: 18, color: C.blue800, space: 4 } },
    spacing: { before: 280, after: 200 },
    children: [
      new TextRun({ text, font: 'Calibri', size: 40, bold: true, color: C.slate900 }),
    ],
  });

const heading2 = (text) =>
  new Paragraph({
    heading: HeadingLevel.HEADING_2,
    keepNext: true,
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: C.blue100, space: 2 } },
    spacing: { before: 240, after: 140 },
    children: [
      new TextRun({ text, font: 'Calibri', size: 29, bold: true, color: C.blue900 }),
    ],
  });

const heading3 = (text) =>
  new Paragraph({
    heading: HeadingLevel.HEADING_3,
    keepNext: true,
    spacing: { before: 160, after: 80 },
    children: [
      new TextRun({ text, font: 'Calibri', size: 23, bold: true, color: C.blue800 }),
    ],
  });

const emptyLine = (after = 80) =>
  new Paragraph({ spacing: { after }, children: [new TextRun({ text: '' })] });

const routeBadge = (text) =>
  new Paragraph({
    spacing: { after: 120 },
    keepNext: true,
    children: [
      new TextRun({
        text,
        font: 'Consolas',
        size: 16,
        color: C.blue800,
        shading: { type: ShadingType.CLEAR, fill: C.blue50 },
      }),
    ],
  });

const listItem = (text, index) =>
  new Paragraph({
    numbering: { reference: 'journey-numbers', level: 0 },
    spacing: { after: 80, line: 276, lineRule: LineRuleType.AUTO },
    children: inlineRuns(text, { font: 'Calibri', size: 20, color: C.slate800 }),
  });

const markdownTable = (rows) => {
  const [header, ...body] = rows;
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: header.map(() => Math.floor(PAGE_WIDTH_DXA / header.length)),
    rows: [
      new TableRow({
        tableHeader: true,
        children: header.map(
          (cell) =>
            new TableCell({
              width: { size: Math.floor(PAGE_WIDTH_DXA / header.length), type: WidthType.DXA },
              shading: { type: ShadingType.CLEAR, fill: C.blue900 },
              margins: cellMargins,
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: cell,
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
                  width: {
                    size: Math.floor(PAGE_WIDTH_DXA / header.length),
                    type: WidthType.DXA,
                  },
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

const visionCell = (title, body, fill, accent, titleColor) =>
  new TableCell({
    width: { size: 5060, type: WidthType.DXA },
    shading: { type: ShadingType.CLEAR, fill },
    margins: { top: 120, bottom: 120, left: 140, right: 140 },
    borders: {
      top: NONE,
      bottom: NONE,
      right: NONE,
      left: { style: BorderStyle.SINGLE, size: 24, color: accent },
    },
    verticalAlign: VerticalAlign.TOP,
    children: [
      new Paragraph({
        spacing: { after: 80 },
        children: [
          new TextRun({ text: title, bold: true, font: 'Calibri', size: 20, color: titleColor }),
        ],
      }),
      new Paragraph({
        spacing: { after: 0, line: 276, lineRule: LineRuleType.AUTO },
        children: inlineRuns(body, { font: 'Calibri', size: 19, color: C.slate800 }),
      }),
    ],
  });

const splitVisions = (userText, adminText) =>
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: [5060, 5060],
    rows: [
      new TableRow({
        children: [
          visionCell(
            'Visão do Usuário Final',
            userText,
            C.green50,
            C.green700,
            C.green800
          ),
          visionCell(
            'Visão da Administração',
            adminText,
            C.blue50,
            C.blue700,
            C.blue900
          ),
        ],
      }),
    ],
  });

const imagePlaceholder = (screenTitle) =>
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        height: { value: 2800, rule: HeightRule.ATLEAST },
        children: [
          new TableCell({
            width: { size: PAGE_WIDTH_DXA, type: WidthType.DXA },
            shading: { type: ShadingType.CLEAR, fill: C.slate50 },
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 200, bottom: 200, left: 200, right: 200 },
            borders: {
              top: { style: BorderStyle.DASHED, size: 8, color: '94A3B8' },
              bottom: { style: BorderStyle.DASHED, size: 8, color: '94A3B8' },
              left: { style: BorderStyle.DASHED, size: 8, color: '94A3B8' },
              right: { style: BorderStyle.DASHED, size: 8, color: '94A3B8' },
            },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 60 },
                children: [
                  new TextRun({
                    text: `Espaço para imagem — ${screenTitle}`,
                    bold: true,
                    font: 'Calibri',
                    size: 20,
                    color: C.slate600,
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: 'No Word: clique nesta caixa → Inserir → Imagens → Esta pasta (ou Arrastar a captura para cá).',
                    italics: true,
                    font: 'Calibri',
                    size: 18,
                    color: C.slate500,
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

const screenBox = ({ title, route, commercial, purpose, user, admin, extraChildren = [] }) => {
  const inner = [
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      keepNext: true,
      spacing: { before: 0, after: 80 },
      children: [new TextRun({ text: title, font: 'Calibri', size: 29, bold: true, color: C.blue900 })],
    }),
    routeBadge(route),
    heading3('Descrição comercial'),
    para(commercial, { size: 20, after: 140 }),
    heading3('Propósito e conexões'),
    para(purpose, { size: 20, after: 160 }),
    ...extraChildren,
    splitVisions(user, admin),
    emptyLine(160),
    imagePlaceholder(title),
  ];

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: PAGE_WIDTH_DXA, type: WidthType.DXA },
            shading: { type: ShadingType.CLEAR, fill: 'FFFFFF' },
            margins: { top: 160, bottom: 160, left: 180, right: 180 },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 8, color: C.border },
              bottom: { style: BorderStyle.SINGLE, size: 8, color: C.border },
              left: { style: BorderStyle.SINGLE, size: 8, color: C.border },
              right: { style: BorderStyle.SINGLE, size: 8, color: C.border },
            },
            children: inner,
          }),
        ],
      }),
    ],
  });
};

const parseTable = (lines, start) => {
  const rows = [];
  let i = start;
  while (i < lines.length && lines[i].trim().startsWith('|')) {
    const raw = lines[i].trim();
    if (!/^\|?\s*-{3,}/.test(raw.replace(/\|/g, '').trim()) && !raw.includes('---')) {
      const cells = raw
        .split('|')
        .slice(1, -1)
        .map((cell) => cell.trim());
      if (cells.length) {
        rows.push(cells);
      }
    } else if (raw.includes('|---') || /^\|?\s*:?-{3,}/.test(raw)) {
      i += 1;
      continue;
    }
    i += 1;
  }
  return { table: markdownTable(rows), next: i };
};

const collectUntil = (lines, start, stopTest) => {
  const buf = [];
  let i = start;
  while (i < lines.length && !stopTest(lines[i])) {
    buf.push(lines[i]);
    i += 1;
  }
  return { text: stripTags(buf.join('\n')).replace(/\n{2,}/g, '\n'), next: i };
};

const isSectionStop = (line) => {
  const trimmed = line.trim();
  return (
    trimmed.startsWith('### ') ||
    trimmed.startsWith('## ') ||
    trimmed.includes('class="split"') ||
    trimmed.startsWith('<div class="screen">')
  );
};

const collectBlocks = (lines, start, stopTest) => {
  const children = [];
  const paras = [];
  let i = start;

  const flushParas = () => {
    const text = stripTags(paras.join('\n')).replace(/\n{2,}/g, '\n').trim();
    paras.length = 0;
    if (text) {
      children.push(para(text, { size: 20, after: 140 }));
    }
  };

  while (i < lines.length && !stopTest(lines[i])) {
    if (lines[i].trim().startsWith('|')) {
      flushParas();
      const parsed = parseTable(lines, i);
      children.push(parsed.table, emptyLine(120));
      i = parsed.next;
      continue;
    }

    paras.push(lines[i]);
    i += 1;
  }

  flushParas();
  return { children, next: i };
};

const parseScreen = (lines, start) => {
  let i = start + 1;
  while (i < lines.length && !lines[i].startsWith('## ')) {
    i += 1;
  }
  const title = lines[i].replace(/^##\s+/, '').trim();
  i += 1;

  let route = '';
  while (i < lines.length && !lines[i].startsWith('### ')) {
    if (lines[i].includes('class="route"') || lines[i].includes('<p class="route">')) {
      route = stripTags(lines[i]);
    } else if (lines[i].trim() && !lines[i].includes('<p') && !route) {
      route = stripTags(lines[i]);
    }
    i += 1;
  }

  const skipHeading = () => {
    while (i < lines.length && (lines[i].startsWith('### ') || !lines[i].trim())) {
      i += 1;
    }
  };

  skipHeading();
  const commercial = collectUntil(
    lines,
    i,
    (line) => line.startsWith('### ') || line.includes('class="split"')
  );
  i = commercial.next;
  skipHeading();
  const purpose = collectUntil(
    lines,
    i,
    (line) =>
      line.includes('class="split"') ||
      line.startsWith('## ') ||
      line.startsWith('### ')
  );
  i = purpose.next;

  const extraChildren = [];
  while (i < lines.length) {
    const heading = lines[i].trim();
    if (heading.startsWith('### ')) {
      const headingText = heading.replace(/^###\s+/, '').trim();
      i += 1;
      while (i < lines.length && !lines[i].trim()) {
        i += 1;
      }
      const block = collectBlocks(lines, i, isSectionStop);
      extraChildren.push(heading3(headingText), ...block.children);
      i = block.next;
      continue;
    }
    break;
  }

  let user = '';
  let admin = '';
  while (i < lines.length) {
    const line = lines[i];
    if (line.includes('class="vision user"')) {
      i += 1;
      const block = collectUntil(
        lines,
        i,
        (l) => l.includes('</div>') || l.includes('class="vision admin"')
      );
      user = block.text.replace(/^Visão do Usuário Final\s*/i, '').trim();
      i = block.next;
    } else if (line.includes('class="vision admin"')) {
      i += 1;
      const block = collectUntil(lines, i, (l) => l.includes('</div>'));
      admin = block.text.replace(/^Visão da Administração\s*/i, '').trim();
      i = block.next;
    } else if (line.trim() === '</div>' && lines[i + 1]?.trim() === '</div>') {
      i += 2;
      break;
    } else {
      i += 1;
    }
  }

  return {
    children: [
      screenBox({
        title,
        route: route || 'Rota do aplicativo',
        commercial: commercial.text,
        purpose: purpose.text,
        extraChildren,
        user,
        admin,
      }),
      emptyLine(200),
    ],
    next: i,
  };
};

const coverChildren = () => [
  new Paragraph({
    spacing: { before: 1600, after: 200 },
    children: [
      new TextRun({
        text: 'DOCUMENTO COMERCIAL INSTITUCIONAL',
        bold: true,
        allCaps: true,
        font: 'Calibri',
        size: 22,
        color: C.blue700,
        characterSpacing: 280,
      }),
    ],
  }),
  new Paragraph({
    spacing: { after: 280 },
    children: [
      new TextRun({
        text: 'Análise de Telas e Menus da Plataforma Digital da Igreja',
        bold: true,
        font: 'Calibri',
        size: 56,
        color: C.slate900,
      }),
    ],
  }),
  new Paragraph({
    spacing: { after: 400, line: 300, lineRule: LineRuleType.AUTO },
    children: [
      new TextRun({
        text: 'Leitura comercial de cada tela e menu do aplicativo, com o valor que entrega na jornada da família, a conexão com os demais módulos, a visão simultânea de quem usa e de quem administra, e o significado de cada botão, texto interativo e resultado exibido.',
        font: 'Calibri',
        size: 26,
        color: C.slate700,
      }),
    ],
  }),
  new Paragraph({
    border: { top: { style: BorderStyle.SINGLE, size: 18, color: C.blue800, space: 10 } },
    spacing: { before: 120, after: 80 },
    children: [
      new TextRun({
        text: 'Solução: ',
        bold: true,
        font: 'Calibri',
        size: 20,
        color: C.slate600,
      }),
      new TextRun({
        text: 'ecossistema app-igreja (PWA + mobile)',
        font: 'Calibri',
        size: 20,
        color: C.slate600,
      }),
    ],
  }),
  para('Público: liderança, secretaria, pastoral, tesouraria e operação', {
    size: 20,
    color: C.slate600,
    after: 40,
  }),
  para('Base: código-fonte, rotas Expo Router, menu lateral, Índice, Painel e Manutenção', {
    size: 20,
    color: C.slate600,
    after: 40,
  }),
  para('Data: 31 de agosto de 2026', { size: 20, color: C.slate600, after: 400 }),
  new Paragraph({ children: [], pageBreakBefore: false }),
];

const buildChildren = (markdown) => {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const children = [];
  let i = 0;
  let listIndex = 0;

  while (i < lines.length && !lines[i].includes('class="cover"')) {
    i += 1;
  }
  while (i < lines.length && lines[i].trim() !== '</div>') {
    i += 1;
  }
  i += 1;

  children.push(...coverChildren());
  children.push(
    new Paragraph({
      pageBreakBefore: true,
      children: [new TextRun({ text: '' })],
    })
  );

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    if (trimmed === '---') {
      children.push(emptyLine(80));
      i += 1;
      continue;
    }

    if (trimmed.startsWith('<div class="screen">')) {
      const screen = parseScreen(lines, i);
      children.push(...screen.children);
      i = screen.next;
      listIndex = 0;
      continue;
    }

    if (trimmed.startsWith('# ')) {
      children.push(heading1(trimmed.replace(/^#\s+/, '')));
      i += 1;
      listIndex = 0;
      continue;
    }

    if (trimmed.startsWith('## ')) {
      children.push(heading2(trimmed.replace(/^##\s+/, '')));
      i += 1;
      listIndex = 0;
      continue;
    }

    if (trimmed.startsWith('### ')) {
      children.push(heading3(trimmed.replace(/^###\s+/, '')));
      i += 1;
      continue;
    }

    if (trimmed.startsWith('|')) {
      const parsed = parseTable(lines, i);
      children.push(parsed.table, emptyLine(160));
      i = parsed.next;
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      children.push(listItem(trimmed.replace(/^\d+\.\s+/, ''), listIndex));
      listIndex += 1;
      i += 1;
      continue;
    }

    if (trimmed.startsWith('<') && !stripTags(trimmed)) {
      i += 1;
      continue;
    }

    children.push(para(stripTags(trimmed)));
    i += 1;
  }

  return children;
};

if (!fs.existsSync(inputPath)) {
  throw new Error(`Arquivo não encontrado: ${inputPath}`);
}

fs.mkdirSync(outDir, { recursive: true });

const markdown = fs.readFileSync(inputPath, 'utf8');

const doc = new Document({
  title: 'Análise institucional de telas e menus',
  creator: 'Plataforma digital da igreja',
  description:
    'Documento comercial editável, com a mesma estrutura do PDF, para inserção manual de imagens.',
  styles: {
    default: {
      document: {
        run: { font: 'Calibri', size: 20, color: C.slate800 },
      },
    },
  },
  numbering: {
    config: [
      {
        reference: 'journey-numbers',
        levels: [
          {
            level: 0,
            format: 'decimal',
            text: '%1.',
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
        titlePage: true,
      },
      headers: {
        first: new Header({ children: [new Paragraph({ children: [] })] }),
        default: new Header({
          children: [
            new Paragraph({
              tabStops: [{ type: 'right', position: PAGE_WIDTH_DXA }],
              children: [
                new TextRun({
                  text: 'Análise institucional de telas e menus',
                  font: 'Calibri',
                  size: 16,
                  color: C.slate500,
                }),
                new TextRun({ text: '\t', font: 'Calibri', size: 16 }),
                new TextRun({
                  text: 'Plataforma digital da igreja',
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
                new TextRun({ children: [PageNumber.CURRENT], font: 'Calibri', size: 16, color: C.slate500 }),
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
console.log(`DOCX salvo em: ${docxPath}`);

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const findMatchingDivEnd = (html, openIndex) => {
  const openTagEnd = html.indexOf('>', openIndex) + 1;
  let depth = 1;
  let i = openTagEnd;
  while (i < html.length && depth > 0) {
    const nextOpen = html.indexOf('<div', i);
    const nextClose = html.indexOf('</div>', i);
    if (nextClose === -1) return html.length;
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth += 1;
      i = nextOpen + 4;
    } else {
      depth -= 1;
      if (depth === 0) return nextClose;
      i = nextClose + 6;
    }
  }
  return html.length;
};

const splitsToTables = (html) =>
  html.replace(
    /<div class="split">\s*<div class="vision user">([\s\S]*?)<\/div>\s*<div class="vision admin">([\s\S]*?)<\/div>\s*<\/div>/gi,
    (_, user, admin) =>
      `<table class="split-table" width="100%" cellspacing="8" cellpadding="0">
        <tr>
          <td class="vision user" width="50%" valign="top">${user}</td>
          <td class="vision admin" width="50%" valign="top">${admin}</td>
        </tr>
      </table>`
  );

const withImagePlaceholders = (html) => {
  const marker = 'class="screen"';
  let pos = 0;
  let last = 0;
  const parts = [];

  while (pos < html.length) {
    const classPos = html.indexOf(marker, pos);
    if (classPos === -1) break;
    const start = html.lastIndexOf('<div', classPos);
    if (start === -1 || start < last) {
      pos = classPos + marker.length;
      continue;
    }
    const close = findMatchingDivEnd(html, start);
    const inner = html.slice(start, close);
    const titleMatch = inner.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
    const title = stripTags(titleMatch?.[1] || 'Tela');
    const placeholder = `
<table class="img-ph" width="100%" cellspacing="0" cellpadding="12">
  <tr>
    <td align="center" style="border:1.5pt dashed #94A3B8; background:#F8FAFC;">
      <p style="margin:8pt 0 4pt; font-family:Calibri,sans-serif; font-weight:bold; color:#475569;">Espaço para imagem — ${escapeHtml(title)}</p>
      <p style="margin:0 0 8pt; font-family:Calibri,sans-serif; font-style:italic; color:#64748B;">No Word: clique nesta caixa → Inserir → Imagens (ou arraste a captura para cá).</p>
    </td>
  </tr>
</table>`;
    parts.push(html.slice(last, close), placeholder);
    last = close;
    pos = close + 6;
  }

  parts.push(html.slice(last));
  return parts.join('');
};

const wordCss = `
${pdfCss}
.split-table { width: 100%; border-collapse: separate; border-spacing: 10px 0; margin-top: 10px; }
.split-table td.vision { width: 50%; vertical-align: top; }
.img-ph { margin: 12px 0 4px; }
@page Section1 {
  size: 21cm 29.7cm;
  margin: 16mm 14mm 20mm 14mm;
  mso-header-margin: 8mm;
  mso-footer-margin: 10mm;
  mso-paper-source: 0;
}
div.Section1 { page: Section1; }
`;

console.log('Gerando ANALISE_INSTITUCIONAL_TELAS.doc ...');
const htmlResult = await mdToPdf(
  { path: inputPath },
  {
    as_html: true,
    css: wordCss,
  }
);

const rawHtml = String(htmlResult?.content || '');
const bodyMatch = rawHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
const body = withImagePlaceholders(splitsToTables(bodyMatch?.[1] || rawHtml));
const wordHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
xmlns:w="urn:schemas-microsoft-com:office:word"
xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
<meta name="ProgId" content="Word.Document">
<meta name="Generator" content="Microsoft Word 15">
<title>Análise institucional de telas e menus</title>
<!--[if gte mso 9]>
<xml>
<w:WordDocument>
  <w:View>Print</w:View>
  <w:Zoom>100</w:Zoom>
  <w:DoNotOptimizeForBrowser/>
</w:WordDocument>
</xml>
<![endif]-->
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

fs.writeFileSync(docPath, `\ufeff${wordHtml}`, 'utf8');
console.log(`DOC salvo em: ${docPath}`);
console.log(`Arquivo nativo do Word (mesmo conteúdo, melhor para colar imagens): ${docxPath}`);


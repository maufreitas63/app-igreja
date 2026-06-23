import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mdToPdf } from 'md-to-pdf';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const inputPath = path.join(root, 'MANUAL_ENTREGA.md');
const outDir = path.join(root, 'pdfs');
const outputPath = path.join(outDir, 'MANUAL_ENTREGA.pdf');

const pdfCss = `
  @page { size: A4; margin: 18mm 16mm; }
  body {
    font-family: 'Segoe UI', system-ui, sans-serif;
    font-size: 10.5pt;
    line-height: 1.5;
    color: #1e293b;
  }
  h1 {
    font-size: 22pt;
    color: #0f172a;
    border-bottom: 2px solid #1e40af;
    padding-bottom: 8px;
    page-break-after: avoid;
  }
  h2 {
    font-size: 15pt;
    color: #1e3a5f;
    margin-top: 1.4em;
    page-break-after: avoid;
    border-bottom: 1px solid #e2e8f0;
    padding-bottom: 4px;
  }
  h3 {
    font-size: 12pt;
    color: #334155;
    margin-top: 1em;
    page-break-after: avoid;
  }
  h4 { font-size: 11pt; page-break-after: avoid; }
  table {
    border-collapse: collapse;
    width: 100%;
    font-size: 9.5pt;
    margin: 10px 0 14px;
    page-break-inside: avoid;
  }
  th, td {
    border: 1px solid #cbd5e1;
    padding: 5px 7px;
    vertical-align: top;
    text-align: left;
  }
  th { background: #f1f5f9; font-weight: 600; color: #0f172a; }
  tr:nth-child(even) td { background: #f8fafc; }
  code {
    font-family: Consolas, 'Courier New', monospace;
    font-size: 8.5pt;
    background: #f1f5f9;
    padding: 1px 4px;
    border-radius: 3px;
  }
  pre {
    white-space: pre-wrap;
    word-break: break-word;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    padding: 10px 12px;
    border-radius: 6px;
    font-size: 8.5pt;
    page-break-inside: avoid;
  }
  blockquote {
    border-left: 3px solid #1e40af;
    margin: 12px 0;
    padding: 4px 12px;
    color: #475569;
    background: #f8fafc;
  }
  hr {
    border: none;
    border-top: 1px solid #e2e8f0;
    margin: 20px 0;
  }
  ul, ol { margin: 6px 0 10px; padding-left: 22px; }
  li { margin-bottom: 3px; }
  a { color: #1d4ed8; text-decoration: none; }
`;

if (!fs.existsSync(inputPath)) {
  throw new Error(`Arquivo não encontrado: ${inputPath}`);
}

fs.mkdirSync(outDir, { recursive: true });

console.log('Gerando MANUAL_ENTREGA.pdf ...');

const pdf = await mdToPdf(
  { path: inputPath },
  {
    dest: outputPath,
    pdf_options: {
      format: 'A4',
      margin: { top: '18mm', right: '16mm', bottom: '18mm', left: '16mm' },
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate:
        '<div style="width:100%;font-size:8px;color:#64748b;text-align:center;padding:0 16mm;">'
        + 'Manual de Entrega — App Igreja (IBNorte) · Página <span class="pageNumber"></span> de <span class="totalPages"></span>'
        + '</div>',
    },
    css: pdfCss,
    launch_options: {
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
  }
);

if (!pdf?.filename) {
  throw new Error('PDF não gerado');
}

console.log(`PDF salvo em: ${outputPath}`);

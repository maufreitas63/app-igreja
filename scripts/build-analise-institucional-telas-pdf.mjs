import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mdToPdf } from 'md-to-pdf';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const inputPath = path.join(root, 'ANALISE_INSTITUCIONAL_TELAS.md');
const outDir = path.join(root, 'pdfs');
const outputPath = path.join(outDir, 'ANALISE_INSTITUCIONAL_TELAS.pdf');

const pdfCss = `
  @page { size: A4; margin: 16mm 14mm 20mm 14mm; }
  body {
    font-family: 'Segoe UI', Calibri, system-ui, sans-serif;
    font-size: 10.2pt;
    line-height: 1.48;
    color: #1e293b;
  }
  .cover {
    page-break-after: always;
    min-height: 240mm;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 12mm 8mm;
  }
  .cover-kicker {
    color: #1d4ed8;
    font-size: 11pt;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    margin-bottom: 12px;
  }
  .cover h1 {
    font-size: 28pt;
    line-height: 1.15;
    color: #0f172a;
    border: none;
    margin: 0 0 16px;
    padding: 0;
  }
  .cover-sub {
    font-size: 13pt;
    color: #334155;
    max-width: 150mm;
    margin-bottom: 28px;
  }
  .cover-meta {
    border-top: 3px solid #1e40af;
    padding-top: 16px;
    color: #475569;
    font-size: 10pt;
  }
  h1 {
    font-size: 20pt;
    color: #0f172a;
    border-bottom: 3px solid #1e40af;
    padding-bottom: 8px;
    page-break-after: avoid;
  }
  h2 {
    font-size: 14.5pt;
    color: #1e3a8a;
    margin-top: 1.35em;
    page-break-after: avoid;
    border-bottom: 1px solid #bfdbfe;
    padding-bottom: 4px;
  }
  h3 {
    font-size: 11.5pt;
    color: #1e40af;
    margin-top: 0.95em;
    page-break-after: avoid;
  }
  h4 {
    font-size: 10.5pt;
    margin: 0 0 6px;
    page-break-after: avoid;
  }
  .screen {
    page-break-inside: avoid;
    margin: 14px 0 18px;
    padding: 12px 14px 10px;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    background: #ffffff;
    box-shadow: 0 1px 0 rgba(15, 23, 42, 0.04);
  }
  .route {
    display: inline-block;
    font-family: Consolas, 'Courier New', monospace;
    font-size: 8pt;
    color: #1e40af;
    background: #eff6ff;
    border: 1px solid #bfdbfe;
    border-radius: 4px;
    padding: 1px 6px;
    margin-bottom: 8px;
  }
  .split {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-top: 10px;
  }
  .vision {
    border-radius: 6px;
    padding: 10px 12px;
    font-size: 9.6pt;
    line-height: 1.42;
  }
  .vision h4 { font-size: 10pt; }
  .user {
    background: #f0fdf4;
    border-left: 4px solid #15803d;
  }
  .user h4 { color: #166534; }
  .admin {
    background: #eff6ff;
    border-left: 4px solid #1d4ed8;
  }
  .admin h4 { color: #1e3a8a; }
  table {
    border-collapse: collapse;
    width: 100%;
    font-size: 9.2pt;
    margin: 10px 0 14px;
  }
  th, td {
    border: 1px solid #cbd5e1;
    padding: 5px 7px;
    vertical-align: top;
    text-align: left;
  }
  th { background: #1e3a8a; color: #ffffff; font-weight: 600; }
  tr:nth-child(even) td { background: #f8fafc; }
  code {
    font-family: Consolas, 'Courier New', monospace;
    font-size: 8.3pt;
    background: #f1f5f9;
    padding: 1px 4px;
    border-radius: 3px;
  }
  blockquote {
    border-left: 3px solid #1e40af;
    margin: 10px 0;
    padding: 6px 12px;
    color: #334155;
    background: #f8fafc;
  }
  hr {
    border: none;
    border-top: 1px solid #e2e8f0;
    margin: 18px 0;
  }
  ul, ol { margin: 6px 0 10px; padding-left: 20px; }
  li { margin-bottom: 3px; }
  a { color: #1d4ed8; text-decoration: none; }
  .toc a { color: #1e3a8a; }
  @media print {
    .split { break-inside: avoid; }
    .screen { break-inside: avoid; }
  }
`;

if (!fs.existsSync(inputPath)) {
  throw new Error(`Arquivo não encontrado: ${inputPath}`);
}

fs.mkdirSync(outDir, { recursive: true });

console.log('Gerando ANALISE_INSTITUCIONAL_TELAS.pdf ...');

const pdf = await mdToPdf(
  { path: inputPath },
  {
    dest: outputPath,
    pdf_options: {
      format: 'A4',
      margin: { top: '16mm', right: '14mm', bottom: '20mm', left: '14mm' },
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate:
        '<div style="width:100%;font-size:8px;color:#64748b;padding:0 14mm;display:flex;justify-content:space-between;">'
        + '<span>Análise institucional de telas e menus</span>'
        + '<span>Plataforma digital da igreja</span>'
        + '</div>',
      footerTemplate:
        '<div style="width:100%;font-size:8px;color:#64748b;text-align:center;padding:0 14mm;">'
        + 'Documento comercial · Página <span class="pageNumber"></span> de <span class="totalPages"></span>'
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

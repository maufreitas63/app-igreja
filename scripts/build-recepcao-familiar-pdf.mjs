import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mdToPdf } from 'md-to-pdf';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const inputPath = path.join(root, 'docs', 'PROCESSO_RECEPCAO_FAMILIAR.md');
const outDir = path.join(root, 'pdfs');
const outputPath = path.join(outDir, 'PROCESSO_RECEPCAO_FAMILIAR.pdf');

const pdfCss = `
  body {
    font-family: 'Segoe UI', system-ui, sans-serif;
    font-size: 11pt;
    line-height: 1.45;
    color: #1e293b;
  }
  h1 { font-size: 20pt; color: #0f172a; page-break-after: avoid; }
  h2 {
    font-size: 15pt;
    color: #1e3a5f;
    margin-top: 1.3em;
    page-break-after: avoid;
    border-bottom: 1px solid #e2e8f0;
    padding-bottom: 4px;
  }
  h3 { font-size: 12.5pt; color: #1e293b; page-break-after: avoid; }
  table { border-collapse: collapse; width: 100%; font-size: 9.5pt; margin: 12px 0; }
  th, td { border: 1px solid #cbd5e1; padding: 6px 8px; vertical-align: top; }
  th { background: #e8eef5; font-weight: 600; }
  code { font-family: Consolas, monospace; font-size: 8.5pt; background: #f8fafc; padding: 1px 4px; }
  pre {
    white-space: pre-wrap;
    word-break: break-word;
    background: #f8fafc;
    padding: 12px;
    border-radius: 6px;
    font-size: 8.5pt;
  }
  hr { border: none; border-top: 1px solid #e2e8f0; margin: 20px 0; }
`;

fs.mkdirSync(outDir, { recursive: true });

console.log('Gerando PROCESSO_RECEPCAO_FAMILIAR.pdf ...');

const pdf = await mdToPdf(
  { path: inputPath },
  {
    dest: outputPath,
    pdf_options: {
      format: 'A4',
      margin: { top: '16mm', right: '14mm', bottom: '18mm', left: '14mm' },
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate:
        '<div style="font-size:9px;width:100%;text-align:center;color:#64748b;padding:0 14mm;">Recepção Familiar — validação operacional — <span class="pageNumber"></span> / <span class="totalPages"></span></div>',
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

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mdToPdf } from 'md-to-pdf';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const inputPath = path.join(root, 'DESCRITIVO_APLICACAO.md');
const outDir = path.join(root, 'pdfs');
const outputPath = path.join(outDir, 'DESCRITIVO_APLICACAO.pdf');

const pdfCss = `
  body {
    font-family: 'Segoe UI', system-ui, sans-serif;
    font-size: 11pt;
    line-height: 1.45;
    color: #1e293b;
  }
  h1 { font-size: 22pt; color: #0f172a; page-break-after: avoid; }
  h2 { font-size: 16pt; color: #1e293b; margin-top: 1.2em; page-break-after: avoid; }
  h3 { font-size: 13pt; page-break-after: avoid; }
  table { border-collapse: collapse; width: 100%; font-size: 10pt; margin: 12px 0; }
  th, td { border: 1px solid #cbd5e1; padding: 6px 8px; vertical-align: top; }
  th { background: #f1f5f9; font-weight: 600; }
  code { font-family: Consolas, monospace; font-size: 9pt; background: #f8fafc; padding: 1px 4px; }
  pre { white-space: pre-wrap; word-break: break-word; background: #f8fafc; padding: 12px; border-radius: 6px; font-size: 9pt; }
  hr { border: none; border-top: 1px solid #e2e8f0; margin: 24px 0; }
`;

fs.mkdirSync(outDir, { recursive: true });

console.log('Gerando DESCRITIVO_APLICACAO.pdf ...');

const pdf = await mdToPdf(
  { path: inputPath },
  {
    dest: outputPath,
    pdf_options: {
      format: 'A4',
      margin: { top: '18mm', right: '16mm', bottom: '18mm', left: '16mm' },
      printBackground: true,
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

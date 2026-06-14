import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mdToPdf } from 'md-to-pdf';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'pdfs');

const files = [
  'PACOTE_5_MANUAL_PAINEL.md',
  'PACOTE_6_MANUAL_MANUTENCAO.md',
];

const pdfCss = `
  body {
    font-family: 'Segoe UI', system-ui, sans-serif;
    font-size: 11pt;
    line-height: 1.45;
    color: #1e293b;
    max-width: 100%;
  }
  img { max-width: 50%; height: auto; display: block; margin: 12px auto; border-radius: 8px; }
`;

fs.mkdirSync(outDir, { recursive: true });

for (const file of files) {
  const inputPath = path.join(root, file);
  const outputPath = path.join(outDir, file.replace(/\.md$/i, '.pdf'));
  process.stdout.write(`Gerando ${file} ... `);

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
      launch_options: { args: ['--no-sandbox', '--disable-setuid-sandbox'] },
    }
  );

  if (!pdf?.filename) {
    throw new Error(`PDF nao gerado: ${file}`);
  }

  console.log('ok');
}

const docsPdfDir = path.join(root, 'docs', 'pdf');
fs.mkdirSync(docsPdfDir, { recursive: true });

for (const file of files) {
  const pdfName = file.replace(/\.md$/i, '.pdf');
  fs.copyFileSync(path.join(outDir, pdfName), path.join(docsPdfDir, pdfName));
}

console.log(`\nPDFs em: ${outDir}`);

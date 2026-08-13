/**
 * Copia pdf.js (viewer + worker) para public/ — carregados no PWA sem Metro.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const buildDir = path.join(root, 'node_modules', 'pdfjs-dist', 'build');
const publicDir = path.join(root, 'public');

const files = ['pdf.min.mjs', 'pdf.worker.min.mjs'];

for (const fileName of files) {
  const source = path.join(buildDir, fileName);
  const target = path.join(publicDir, fileName);

  if (!fs.existsSync(source)) {
    throw new Error(`Arquivo pdf.js não encontrado: ${source}`);
  }

  fs.mkdirSync(publicDir, { recursive: true });
  fs.copyFileSync(source, target);
  console.log(`${fileName} → ${target}`);
}

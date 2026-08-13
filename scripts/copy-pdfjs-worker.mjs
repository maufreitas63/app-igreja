/**
 * Copia o worker do pdf.js para public/ (mesmo origin no PWA).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.min.mjs');
const target = path.join(root, 'public', 'pdf.worker.min.mjs');

if (!fs.existsSync(source)) {
  throw new Error(`Worker pdf.js não encontrado: ${source}`);
}

fs.mkdirSync(path.dirname(target), { recursive: true });
fs.copyFileSync(source, target);
console.log(`pdf.worker.min.mjs → ${target}`);

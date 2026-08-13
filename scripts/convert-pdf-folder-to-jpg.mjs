/**
 * Converte PDFs de uma pasta em JPGs (uma imagem por página).
 * Não percorre subpastas — só arquivos .pdf no nível da pasta informada.
 *
 * Uso:
 *   node scripts/convert-pdf-folder-to-jpg.mjs
 *   node scripts/convert-pdf-folder-to-jpg.mjs --in "C:\IBN Tesouraria\Comprovantes\JPG"
 *   node scripts/convert-pdf-folder-to-jpg.mjs --force
 *   node scripts/convert-pdf-folder-to-jpg.mjs --limit 3
 *   node scripts/convert-pdf-folder-to-jpg.mjs --scale 2 --quality 85
 *
 * Padrão (mesma pasta de entrada e saída):
 *   C:\IBN Tesouraria\Comprovantes\JPG
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { pdf } from 'pdf-to-img';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const STANDARD_FONTS_DIR = path.join(root, 'node_modules', 'pdfjs-dist', 'standard_fonts');

const DEFAULT_DIR = String.raw`C:\IBN Tesouraria\Comprovantes\JPG`;

function parseArgs(argv) {
  const opts = {
    inputDir: DEFAULT_DIR,
    outputDir: DEFAULT_DIR,
    force: false,
    limit: 0,
    scale: 2,
    quality: 85,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];

    if ((arg === '--in' || arg === '--dir') && next) {
      opts.inputDir = next;
      if (!argv.includes('--out')) {
        opts.outputDir = next;
      }
      i += 1;
    } else if (arg === '--out' && next) {
      opts.outputDir = next;
      i += 1;
    } else if (arg === '--force') {
      opts.force = true;
    } else if (arg === '--limit' && next) {
      opts.limit = Math.max(0, Number.parseInt(next, 10) || 0);
      i += 1;
    } else if (arg === '--scale' && next) {
      opts.scale = Math.min(4, Math.max(1, Number.parseFloat(next) || 2));
      i += 1;
    } else if (arg === '--quality' && next) {
      opts.quality = Math.min(100, Math.max(40, Number.parseInt(next, 10) || 85));
      i += 1;
    } else if (arg === '--help' || arg === '-h') {
      opts.help = true;
    }
  }

  return opts;
}

/** Apenas .pdf no nível da pasta (ignora subpastas). */
function listPdfFiles(dir) {
  if (!fs.existsSync(dir)) {
    throw new Error(`Pasta de entrada não encontrada: ${dir}`);
  }

  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.pdf$/i.test(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

function pageOutputPath(outputDir, pdfBaseName, pageNumber, pageCount) {
  if (pageCount <= 1) {
    return path.join(outputDir, `${pdfBaseName}.jpg`);
  }

  const page = String(pageNumber).padStart(2, '0');
  return path.join(outputDir, `${pdfBaseName}-p${page}.jpg`);
}

function outputsExist(outputDir, pdfBaseName) {
  const single = path.join(outputDir, `${pdfBaseName}.jpg`);
  if (fs.existsSync(single)) {
    return true;
  }

  const prefix = `${pdfBaseName}-p`;
  return fs
    .readdirSync(outputDir)
    .some((name) => name.toLowerCase().startsWith(prefix.toLowerCase()) && /\.jpe?g$/i.test(name));
}

async function convertOnePdf(pdfPath, outputDir, { force, scale, quality }) {
  const baseName = path.basename(pdfPath, path.extname(pdfPath));

  if (!force && outputsExist(outputDir, baseName)) {
    return { status: 'skipped', pages: 0, reason: 'já convertido' };
  }

  const pages = [];
  const docInitParams = fs.existsSync(STANDARD_FONTS_DIR)
    ? { standardFontDataUrl: `${pathToFileURL(STANDARD_FONTS_DIR).href}/` }
    : undefined;

  for await (const pngBuffer of await pdf(pdfPath, { scale, docInitParams })) {
    pages.push(pngBuffer);
  }

  if (pages.length === 0) {
    return { status: 'empty', pages: 0, reason: 'PDF sem páginas' };
  }

  for (let index = 0; index < pages.length; index += 1) {
    const outPath = pageOutputPath(outputDir, baseName, index + 1, pages.length);
    await sharp(pages[index]).jpeg({ quality, mozjpeg: true }).toFile(outPath);
  }

  return { status: 'ok', pages: pages.length };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.help) {
    console.log(`Uso:
  node scripts/convert-pdf-folder-to-jpg.mjs [--in DIR] [--out DIR] [--force] [--limit N] [--scale 2] [--quality 85]

Padrão (só a pasta, sem subpastas):
  ${DEFAULT_DIR}`);
    return;
  }

  fs.mkdirSync(opts.outputDir, { recursive: true });

  let files = listPdfFiles(opts.inputDir);
  if (opts.limit > 0) {
    files = files.slice(0, opts.limit);
  }

  console.log(`Pasta   : ${opts.inputDir}`);
  console.log(`Saída   : ${opts.outputDir}`);
  console.log(`Escopo  : apenas arquivos .pdf nesta pasta (sem subpastas)`);
  console.log(`PDFs    : ${files.length}${opts.force ? ' (force)' : ''}`);
  console.log(`Escala  : ${opts.scale} · Qualidade JPG: ${opts.quality}`);
  console.log('');

  let ok = 0;
  let skipped = 0;
  let failed = 0;
  let pagesTotal = 0;

  for (let i = 0; i < files.length; i += 1) {
    const name = files[i];
    const pdfPath = path.join(opts.inputDir, name);
    const prefix = `[${i + 1}/${files.length}] ${name}`;

    try {
      const result = await convertOnePdf(pdfPath, opts.outputDir, opts);
      if (result.status === 'ok') {
        ok += 1;
        pagesTotal += result.pages;
        console.log(`${prefix} → ${result.pages} pág.`);
      } else if (result.status === 'skipped') {
        skipped += 1;
        console.log(`${prefix} (pulado: ${result.reason})`);
      } else {
        failed += 1;
        console.log(`${prefix} (falha: ${result.reason})`);
      }
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      console.error(`${prefix} ERRO: ${message}`);
    }
  }

  console.log('');
  console.log(`Concluído — ok: ${ok} · pulados: ${skipped} · falhas: ${failed} · páginas: ${pagesTotal}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

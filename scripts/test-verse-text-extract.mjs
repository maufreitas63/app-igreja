import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load helpers from import script by duplicating minimal test
const source = readFileSync(join(__dirname, 'import-dailyverses-themes.mjs'), 'utf8');

const block = `<span class="v2">O S<span style="font-variant:all-small-caps">enhor</span> te abençoe e te guarde;<br> o S<span style="font-variant:all-small-caps">enhor</span> faça resplandecer o seu rosto sobre ti e tenha misericórdia de ti;<br> o S<span style="font-variant:all-small-caps">enhor</span> sobre ti levante o seu rosto e te dê a paz.</span><div class="vr"><a href="/pt/numeros/6/24-26" class="vc">Números 6:24-26</a></div>`;

function decodeHtml(text) {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .trim();
}

function stripVerseHtml(html) {
  return decodeHtml(
    html
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
  );
}

function extractVerseText(block) {
  const open = block.match(/<span[^>]*class="v2"[^>]*>/);
  if (!open) return null;
  const afterOpen = block.slice(open.index + open[0].length);
  const close = /<\/span>\s*<div class="vr">/.exec(afterOpen);
  if (!close) {
    const fallback = block.match(/<span[^>]*class="v2"[^>]*>([\s\S]*?)<\/span>/);
    return fallback ? stripVerseHtml(fallback[1]) : null;
  }
  return stripVerseHtml(afterOpen.slice(0, close.index));
}

const texto = extractVerseText(block);
console.log(texto);
console.assert(texto.includes('abençoe'), 'missing abençoe');
console.assert(texto.includes('paz'), 'missing paz');
console.assert(texto.length > 80, `too short: ${texto.length}`);
console.log('OK');

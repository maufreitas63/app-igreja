import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer';
import sharp from 'sharp';

const VIEWPORT = { width: 390, height: 844, deviceScaleFactor: 2 };

/**
 * @param {Buffer} png
 * @param {{ n: number, x: number, y: number, lx: number, ly: number }[]} callouts
 * @param {number} scale
 */
function buildCalloutOverlay(png, callouts, scale) {
  const w = VIEWPORT.width * scale;
  const h = VIEWPORT.height * scale;
  const circles = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧'];

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  ${callouts
    .map((c) => {
      const label = circles[c.n - 1] ?? String(c.n);
      const x = c.x * scale;
      const y = c.y * scale;
      const lx = c.lx * scale;
      const ly = c.ly * scale;
      return `
  <line x1="${x}" y1="${y}" x2="${lx}" y2="${ly}" stroke="#fbbf24" stroke-width="2" stroke-dasharray="6 4"/>
  <circle cx="${lx}" cy="${ly}" r="14" fill="#fbbf24" stroke="#78350f" stroke-width="1.5"/>
  <text x="${lx}" y="${ly + 5}" text-anchor="middle" font-size="13" font-weight="700" fill="#1e293b" font-family="Segoe UI, sans-serif">${label}</text>
  <circle cx="${x}" cy="${y}" r="4" fill="#fbbf24"/>`;
    })
    .join('\n')}
</svg>`;

  return sharp(png).composite([{ input: Buffer.from(svg), top: 0, left: 0 }]).png();
}

/**
 * @param {string} html
 * @param {string} outfile
 * @param {{ n: number, x: number, y: number, lx: number, ly: number }[]} [callouts]
 */
export async function captureScreen(html, outfile, callouts = []) {
  fs.mkdirSync(path.dirname(outfile), { recursive: true });

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport(VIEWPORT);
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
    await page.evaluate(() => document.fonts?.ready);
    const screenshot = await page.screenshot({ type: 'png', fullPage: false });
    const pipeline =
      callouts.length > 0
        ? buildCalloutOverlay(screenshot, callouts, VIEWPORT.deviceScaleFactor)
        : sharp(screenshot);
    await pipeline.toFile(outfile);
  } finally {
    await browser.close();
  }
}

/**
 * @param {{ file: string, html: string, callouts?: object[] }[]} screens
 * @param {string} outDir
 */
export async function captureAll(screens, outDir) {
  for (const screen of screens) {
    const outfile = path.join(outDir, screen.file);
    process.stdout.write(`Capturando ${screen.file} ... `);
    await captureScreen(screen.html, outfile, screen.callouts ?? []);
    console.log('ok');
  }
}

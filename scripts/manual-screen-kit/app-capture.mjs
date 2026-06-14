import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';
import sharp from 'sharp';
import { startDistServer, DIST_DIR } from './serve-dist.mjs';
import { loadRedactionReplacements, redactPagePii } from './redact-pii.mjs';

const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() || 'https://bldbrsuiwctoaxzcrjoc.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJsZGJyc3Vpd2N0b2F4emNyam9jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0NTgyMTQsImV4cCI6MjA5NTAzNDIxNH0.q2ME_1_Qatxfc6Aas02H7A6y6dUpk4BsNQyDIeQYVgU';

const VIEWPORT = { width: 390, height: 844 };
const DEVICE_SCALE = 1;
const OUTPUT_SCALE = 0.5;

const MEMBER_PHONE_RAW = process.env.MANUAL_SCREEN_MEMBER_PHONE?.trim() || '';
const MEMBER_PIN_ENV = process.env.MANUAL_SCREEN_MEMBER_PIN?.trim() || '';

const circles = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧'];

function formatPhoneInput(raw) {
  const d = raw.replace(/\D/g, '');
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7, 11)}`;
}

const MEMBER_PHONE = MEMBER_PHONE_RAW ? formatPhoneInput(MEMBER_PHONE_RAW) : '';

async function fetchProfileCredentials(profileId, label) {
  const url = `${SUPABASE_URL}/rest/v1/profiles?id=eq.${profileId}&select=phone,access_pin`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Não foi possível obter perfil ${label} (${res.status}).`);
  }

  const rows = await res.json();
  const row = rows[0];
  if (!row?.phone) {
    throw new Error(`Perfil ${label} sem telefone. Defina MANUAL_SCREEN_* no ambiente.`);
  }

  return {
    phone: formatPhoneInput(String(row.phone)),
    pin: String(row.access_pin ?? '1001').padStart(4, '0').slice(-4),
  };
}

async function fetchMemberCredentials() {
  if (process.env.MANUAL_SCREEN_MEMBER_PHONE?.trim()) {
    return {
      phone: formatPhoneInput(process.env.MANUAL_SCREEN_MEMBER_PHONE.trim()),
      pin: process.env.MANUAL_SCREEN_MEMBER_PIN?.trim() || '1001',
    };
  }

  const actorId =
    process.env.TSTMAX_ACTOR_PROFILE_ID?.trim() || '04b919ba-38b4-4fe5-a371-2e98e9acbc0d';
  return fetchProfileCredentials(actorId, 'membro');
}

async function fetchMaintCredentials() {
  if (process.env.MANUAL_SCREEN_MAINT_PHONE?.trim()) {
    return {
      phone: formatPhoneInput(process.env.MANUAL_SCREEN_MAINT_PHONE.trim()),
      pin: process.env.MANUAL_SCREEN_MAINT_PIN?.trim() || '1001',
    };
  }

  const actorId =
    process.env.TSTMAX_ACTOR_PROFILE_ID?.trim() || '04b919ba-38b4-4fe5-a371-2e98e9acbc0d';
  return fetchProfileCredentials(actorId, 'manutenção');
}

/**
 * @param {import('puppeteer').Page} page
 * @param {string} selector
 */
async function centerOf(page, selector) {
  const el = await page.waitForSelector(selector, { timeout: 20000, visible: true });
  const box = await el.boundingBox();
  if (!box) return null;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/**
 * @param {import('puppeteer').Page} page
 * @param {string} text
 */
async function centerOfText(page, text) {
  const point = await page.evaluate((needle) => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!node.textContent?.includes(needle)) continue;
      const el = node.parentElement;
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }
    return null;
  }, text);

  return point;
}

/**
 * @param {import('puppeteer').Page} page
 * @param {{ n: number, selector?: string, text?: string, lx: number, ly: number }[]} callouts
 */
async function resolveCallouts(page, callouts) {
  const resolved = [];
  for (const c of callouts) {
    let point = null;
    if (c.selector) {
      point = await centerOf(page, c.selector);
    } else if (c.text) {
      point = await centerOfText(page, c.text);
    }
    if (!point) {
      console.warn(`Callout ${c.n}: alvo não encontrado`);
      continue;
    }
    resolved.push({ n: c.n, x: point.x, y: point.y, lx: c.lx, ly: c.ly });
  }
  return resolved;
}

function buildCalloutOverlay(width, height, callouts) {
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  ${callouts
    .map((c) => {
      const label = circles[c.n - 1] ?? String(c.n);
      const x = c.x * OUTPUT_SCALE;
      const y = c.y * OUTPUT_SCALE;
      const lx = c.lx * OUTPUT_SCALE;
      const ly = c.ly * OUTPUT_SCALE;
      return `
  <line x1="${x}" y1="${y}" x2="${lx}" y2="${ly}" stroke="#fbbf24" stroke-width="2" stroke-dasharray="6 4"/>
  <circle cx="${lx}" cy="${ly}" r="13" fill="#fbbf24" stroke="#78350f" stroke-width="1.5"/>
  <text x="${lx}" y="${ly + 5}" text-anchor="middle" font-size="12" font-weight="700" fill="#1e293b" font-family="Segoe UI, sans-serif">${label}</text>
  <circle cx="${x}" cy="${y}" r="4" fill="#fbbf24"/>`;
    })
    .join('\n')}
</svg>`;
  return Buffer.from(svg);
}

async function saveScreenshot(page, outfile, callouts = [], ctx = null) {
  fs.mkdirSync(path.dirname(outfile), { recursive: true });
  if (ctx?.redactionReplacements?.length) {
    await redactPagePii(page, ctx.redactionReplacements);
    await new Promise((r) => setTimeout(r, 350));
  }
  const screenshot = await page.screenshot({ type: 'png', fullPage: false });
  const srcW = Math.round(VIEWPORT.width * DEVICE_SCALE);
  const srcH = Math.round(VIEWPORT.height * DEVICE_SCALE);
  const outW = Math.round(srcW * OUTPUT_SCALE);
  const outH = Math.round(srcH * OUTPUT_SCALE);

  let pipeline = sharp(screenshot).resize(outW, outH, { fit: 'fill' });
  if (callouts.length > 0) {
    pipeline = pipeline.composite([
      { input: buildCalloutOverlay(outW, outH, callouts), top: 0, left: 0 },
    ]);
  }
  await pipeline.png().toFile(outfile);
}

async function clearSession(page, baseUrl) {
  await page.goto(`${baseUrl}/?signedOut=1`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      /* file:// / about:blank podem bloquear storage */
    }
  });
}

/**
 * @param {import('puppeteer').Page} page
 * @param {string} baseUrl
 * @param {{ phone: string, pin: string }} creds
 */
async function loginMember(page, baseUrl, creds) {
  await clearSession(page, baseUrl);
  await page.waitForSelector('input', { timeout: 20000 });

  const phoneInput = await page.$('input[placeholder="(00) 00000-0000"]');
  if (!phoneInput) throw new Error('Campo de celular não encontrado no login.');
  await phoneInput.click({ clickCount: 3 });
  await phoneInput.type(creds.phone.replace(/\D/g, ''), { delay: 30 });

  await page.evaluate(() => {
    const nodes = [...document.querySelectorAll('*')];
    const btn = nodes.find((el) => el.textContent?.trim() === 'Continuar');
    if (btn instanceof HTMLElement) btn.click();
  });

  await page.waitForFunction(
    () => document.body.innerText.includes('Código') || document.body.innerText.includes('senha'),
    { timeout: 20000 }
  );

  await page.waitForFunction(
    () => document.querySelectorAll('input').length > 0,
    { timeout: 20000 }
  );

  const pinInputs = await page.$$('input');
  if (!pinInputs.length) {
    throw new Error(
      'Campo de PIN indisponível (primeiro acesso exige WhatsApp). Use conta com PIN cadastrado ou MANUAL_SCREEN_MEMBER_PHONE.'
    );
  }
  const pinInput = pinInputs[pinInputs.length - 1];
  await pinInput.click({ clickCount: 3 });
  await pinInput.type(creds.pin, { delay: 80 });

  await page.waitForFunction(
    () =>
      document.body.innerText.includes('Boas-Vindas')
      || document.body.innerText.includes('Índice do Aplicativo')
      || document.body.innerText.includes('Agenda da Família'),
    { timeout: 45000 }
  ).catch(() => undefined);

  await new Promise((r) => setTimeout(r, 2500));
}

/**
 * @param {import('puppeteer').Page} page
 * @param {string} url
 */
async function gotoAndSettle(page, url) {
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 2200));
}

/**
 * @param {{ file: string, run: (ctx: object) => Promise<void> }[]} jobs
 * @param {string} outDir
 */
export async function captureAppScreens(jobs, outDir) {
  if (!fs.existsSync(path.join(DIST_DIR, 'index.html'))) {
    throw new Error('dist/ não encontrado. Execute: npm run build:web');
  }

  const { baseUrl, close } = await startDistServer(8765);
  const maintCreds = await fetchMaintCredentials();
  const memberCreds = await fetchMemberCredentials();
  const redactionReplacements = await loadRedactionReplacements();
  console.log(`Conta membro: ${memberCreds.phone} · Conta manutenção: ${maintCreds.phone}`);
  console.log(`Redação LGPD: ${redactionReplacements.length} substituições`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ ...VIEWPORT, deviceScaleFactor: DEVICE_SCALE });

    const ctx = {
      page,
      baseUrl,
      outDir,
      member: memberCreds,
      maint: maintCreds,
      redactionReplacements,
      gotoAndSettle,
      resolveCallouts,
      loginMember,
      centerOfText,
    };
    ctx.saveScreenshot = (pg, outfile, callouts = []) => saveScreenshot(pg, outfile, callouts, ctx);

    for (const job of jobs) {
      process.stdout.write(`Capturando ${job.file} ... `);
      try {
        await job.run(ctx);
        console.log('ok');
      } catch (err) {
        console.log('erro');
        throw err;
      }
    }
  } finally {
    await browser.close();
    await close();
  }
}

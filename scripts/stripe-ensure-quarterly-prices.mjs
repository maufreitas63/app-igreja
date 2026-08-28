/**
 * Cria (ou reaproveita) Prices trimestrais no Stripe e imprime os IDs
 * para STRIPE_PRICE_* no Cloudflare.
 *
 * Uso:
 *   node scripts/stripe-ensure-quarterly-prices.mjs
 *
 * Requer STRIPE_SECRET_KEY em .env.local (sk_test_… ou sk_live_…).
 * Não altere intervalo de um Price existente — o Stripe não permite.
 * Preço trimestral = 3 × o unit_amount do Price mensal ativo do mesmo produto,
 * ou o valor de teste documentado se ainda não houver mensal.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function loadEnvLocal() {
  const envPath = resolve(process.cwd(), '.env.local');
  if (!existsSync(envPath)) return;
  const text = readFileSync(envPath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvLocal();

const secret = process.env.STRIPE_SECRET_KEY?.trim();
if (!secret || !secret.startsWith('sk_')) {
  console.error(
    'Defina STRIPE_SECRET_KEY no .env.local (não cole a chave no chat). Depois rode de novo: npm run stripe:quarterly-prices'
  );
  process.exit(1);
}

const PLANS = [
  { code: 'semente', name: 'Semente', env: 'STRIPE_PRICE_SEMENTE', fallbackCents: 2990 },
  { code: 'crescimento', name: 'Crescimento', env: 'STRIPE_PRICE_CRESCIMENTO', fallbackCents: 7990 },
  { code: 'expansao', name: 'Expansão', env: 'STRIPE_PRICE_EXPANSAO', fallbackCents: 14990 },
  { code: 'ministerio', name: 'Ministério', env: 'STRIPE_PRICE_MINISTERIO', fallbackCents: 29990 },
];

const stripeGet = async (path) => {
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  const data = await response.json();
  if (!response.ok) {
    const message =
      data?.error?.message || `GET ${path} falhou (${response.status})`;
    throw new Error(message);
  }
  return data;
};

const stripePost = async (path, params) => {
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(params),
  });
  const data = await response.json();
  if (!response.ok) {
    const message =
      data?.error?.message || `POST ${path} falhou (${response.status})`;
    throw new Error(message);
  }
  return data;
};

const normalize = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim()
    .toLowerCase();

const isQuarterly = (price) =>
  price?.recurring?.interval === 'month' && Number(price?.recurring?.interval_count) === 3;

const isMonthly = (price) =>
  price?.recurring?.interval === 'month' && Number(price?.recurring?.interval_count || 1) === 1;

const products = await stripeGet('products?limit=100&active=true');
const productList = Array.isArray(products.data) ? products.data : [];

const results = [];

for (const plan of PLANS) {
  const product = productList.find((item) => normalize(item.name) === normalize(plan.name));
  if (!product) {
    throw new Error(
      `Produto Stripe "${plan.name}" não encontrado. Crie o produto no catálogo (modo Test) e rode de novo.`
    );
  }

  const prices = await stripeGet(`prices?product=${product.id}&limit=100&active=true`);
  const priceList = Array.isArray(prices.data) ? prices.data : [];
  const existingQuarterly = priceList.find(isQuarterly);
  const monthly = priceList.find(isMonthly);
  const unitAmount = monthly?.unit_amount
    ? Number(monthly.unit_amount) * 3
    : plan.fallbackCents * 3;
  const currency = String(monthly?.currency || 'brl').toLowerCase();

  let price = existingQuarterly;
  let created = false;
  if (!price) {
    price = await stripePost('prices', {
      product: product.id,
      currency,
      unit_amount: String(unitAmount),
      'recurring[interval]': 'month',
      'recurring[interval_count]': '3',
      nickname: 'Trimestral',
      'metadata[plan_code]': plan.code,
      'metadata[billing_interval]': 'quarterly',
    });
    created = true;
  }

  results.push({
    plan: plan.code,
    env: plan.env,
    product_id: product.id,
    price_id: price.id,
    amount_brl: (Number(price.unit_amount) / 100).toLocaleString('pt-BR', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }),
    interval: 'every 3 months',
    created,
  });
}

console.log(JSON.stringify({ ok: true, mode: secret.startsWith('sk_live_') ? 'live' : 'test', results }, null, 2));
console.log('\nCloudflare Pages → Settings → Variables and Secrets → Production:\n');
for (const row of results) {
  console.log(`${row.env}=${row.price_id}`);
}
console.log('\nDepois: Retry deployment. Não cole as chaves secretas no chat.');

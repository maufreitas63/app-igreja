/** Helpers compartilhados das Pages Functions de billing (Stripe + Supabase). */

/** Product IDs do catálogo Stripe de produção (checkout live resolve o price_ trimestral). */
export const STRIPE_PRODUCTION_PRODUCT_IDS: Record<string, string> = {
  semente: 'prod_VHJyIji7BiDXMN',
  crescimento: 'prod_VHK0NV797cK5v2',
  expansao: 'prod_VHK1R5xL6SKUm5',
  ministerio: 'prod_VHK29Q00ifpUrw',
};

export type BillingEnv = {
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  EXPO_PUBLIC_SUPABASE_URL?: string;
  EXPO_PUBLIC_APP_URL?: string;
  STRIPE_PRICE_SEMENTE?: string;
  STRIPE_PRICE_CRESCIMENTO?: string;
  STRIPE_PRICE_EXPANSAO?: string;
  STRIPE_PRICE_MINISTERIO?: string;
  STRIPE_PRODUCT_SEMENTE?: string;
  STRIPE_PRODUCT_CRESCIMENTO?: string;
  STRIPE_PRODUCT_EXPANSAO?: string;
  STRIPE_PRODUCT_MINISTERIO?: string;
};

export const isStripeSecretKey = (value: string | undefined): value is string => {
  const secret = value?.trim() ?? '';
  return secret.startsWith('sk_test_') || secret.startsWith('sk_live_');
};

export const billingCorsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'content-type, authorization, apikey, x-client-info, x-profile-id, x-session-token, x-tenant-id',
};

export const jsonResponse = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: { ...billingCorsHeaders, 'Content-Type': 'application/json' },
  });

export const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : null;

export const unixToIso = (value: unknown): string | null => {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return new Date(n * 1000).toISOString();
};

/** Stripe API recente: current_period_* vive no item, não no topo da subscription. */
export const stripeSubscriptionPeriod = (
  subscription: Record<string, unknown>
): { start: string | null; end: string | null } => {
  const items = asRecord(subscription.items);
  const data = Array.isArray(items?.data) ? items.data : [];
  const firstItem = asRecord(data[0]);
  return {
    start:
      unixToIso(subscription.current_period_start) || unixToIso(firstItem?.current_period_start),
    end: unixToIso(subscription.current_period_end) || unixToIso(firstItem?.current_period_end),
  };
};

export const planCodeFromPriceEnv = (env: BillingEnv, planCode: string): string | null => {
  const code = planCode.trim().toLowerCase();
  const map: Record<string, string | undefined> = {
    semente: env.STRIPE_PRICE_SEMENTE,
    crescimento: env.STRIPE_PRICE_CRESCIMENTO,
    expansao: env.STRIPE_PRICE_EXPANSAO,
    ministerio: env.STRIPE_PRICE_MINISTERIO,
  };
  const price = map[code]?.trim();
  return price || null;
};

export const planCodeFromProductEnv = (env: BillingEnv, planCode: string): string | null => {
  const code = planCode.trim().toLowerCase();
  const map: Record<string, string | undefined> = {
    semente: env.STRIPE_PRODUCT_SEMENTE,
    crescimento: env.STRIPE_PRODUCT_CRESCIMENTO,
    expansao: env.STRIPE_PRODUCT_EXPANSAO,
    ministerio: env.STRIPE_PRODUCT_MINISTERIO,
  };
  const productId = map[code]?.trim() || STRIPE_PRODUCTION_PRODUCT_IDS[code];
  return productId?.startsWith('prod_') ? productId : null;
};

function stripePriceIdFromPlanRow(row: Record<string, unknown> | null): string | null {
  const id = String(row?.stripe_price_id ?? '').trim();
  return id.startsWith('price_') ? id : null;
}

function stripeProductIdFromPlanRow(row: Record<string, unknown> | null): string | null {
  const id = String(row?.stripe_product_id ?? '').trim();
  return id.startsWith('prod_') ? id : null;
}

function isQuarterlyStripePrice(row: Record<string, unknown> | null): boolean {
  const recurring = asRecord(row?.recurring);
  return recurring?.interval === 'month' && Number(recurring?.interval_count) === 3;
}

async function resolveQuarterlyPriceFromProduct(
  secret: string,
  productId: string
): Promise<string | null> {
  const listed = await stripeGet(secret, `prices?product=${encodeURIComponent(productId)}&active=true&limit=100`);
  if (!listed.ok) return null;

  const rows = Array.isArray(listed.data.data) ? listed.data.data : [];
  const asPriceRows = rows
    .map((item) => asRecord(item))
    .filter((row): row is Record<string, unknown> => row != null);

  const quarterly = asPriceRows.find(
    (row) => isQuarterlyStripePrice(row) && typeof row.id === 'string' && row.id.startsWith('price_')
  );
  if (typeof quarterly?.id === 'string') return quarterly.id;

  const product = await stripeGet(secret, `products/${encodeURIComponent(productId)}`);
  if (product.ok) {
    const defaultPrice = product.data.default_price;
    if (typeof defaultPrice === 'string' && defaultPrice.startsWith('price_')) {
      return defaultPrice;
    }
    const nested = asRecord(defaultPrice);
    if (typeof nested?.id === 'string' && nested.id.startsWith('price_')) {
      return nested.id;
    }
  }

  const first = asPriceRows.find((row) => typeof row.id === 'string' && row.id.startsWith('price_'));
  return typeof first?.id === 'string' ? first.id : null;
}

function planRowFromList(data: unknown, planCode: string): Record<string, unknown> | null {
  const rows = Array.isArray(data) ? data : [];
  const code = planCode.trim().toLowerCase();
  for (const item of rows) {
    const row = asRecord(item);
    if (String(row?.code ?? '').trim().toLowerCase() === code) {
      return row;
    }
  }
  return null;
}

/** Price ID do plano: em live, a partir do product_id; em test, stripe_price_id / env. */
export async function resolveCheckoutPriceId(
  env: BillingEnv,
  planCode: string
): Promise<string | null> {
  const listed = await supabaseServiceRpc(env, 'list_billing_plans', {});
  const row = listed.ok ? planRowFromList(listed.data, planCode) : null;
  const secret = env.STRIPE_SECRET_KEY?.trim() || '';
  const productId =
    stripeProductIdFromPlanRow(row)
    || planCodeFromProductEnv(env, planCode);

  if (secret.startsWith('sk_live_') && productId) {
    const fromProduct = await resolveQuarterlyPriceFromProduct(secret, productId);
    if (fromProduct) return fromProduct;
  }

  const fromDb = stripePriceIdFromPlanRow(row);
  if (fromDb) return fromDb;
  return planCodeFromPriceEnv(env, planCode);
}

export const planCodeFromStripePriceId = (env: BillingEnv, priceId: string): string | null => {
  const id = priceId.trim();
  if (!id) return null;
  const entries: Array<[string, string | undefined]> = [
    ['semente', env.STRIPE_PRICE_SEMENTE],
    ['crescimento', env.STRIPE_PRICE_CRESCIMENTO],
    ['expansao', env.STRIPE_PRICE_EXPANSAO],
    ['ministerio', env.STRIPE_PRICE_MINISTERIO],
  ];
  for (const [code, configured] of entries) {
    if (configured?.trim() === id) return code;
  }
  return null;
};

export async function resolvePlanCodeFromStripePriceId(
  env: BillingEnv,
  priceId: string
): Promise<string | null> {
  const fromEnv = planCodeFromStripePriceId(env, priceId);
  if (fromEnv) return fromEnv;

  const listed = await supabaseServiceRpc(env, 'list_billing_plans', {});
  if (!listed.ok || !priceId.trim()) return null;

  const rows = Array.isArray(listed.data) ? listed.data : [];
  const id = priceId.trim();
  for (const item of rows) {
    const row = asRecord(item);
    if (String(row?.stripe_price_id ?? '').trim() === id) {
      const code = String(row?.code ?? '').trim().toLowerCase();
      return code || null;
    }
  }
  return null;
}

export function readStripeMeta(obj: Record<string, unknown> | null, key: string): string {
  const meta = asRecord(obj?.metadata);
  const value = meta?.[key];
  return typeof value === 'string' ? value.trim() : '';
}

export const STRIPE_SUBSCRIPTION_STATUSES = [
  'inactive',
  'incomplete',
  'incomplete_expired',
  'trialing',
  'active',
  'past_due',
  'canceled',
  'unpaid',
  'paused',
] as const;

export type StripeSubscriptionStatus = (typeof STRIPE_SUBSCRIPTION_STATUSES)[number];

export function normalizeStripeSubscriptionStatus(raw: unknown): StripeSubscriptionStatus {
  const status = String(raw || '').trim().toLowerCase();
  return (STRIPE_SUBSCRIPTION_STATUSES as readonly string[]).includes(status)
    ? (status as StripeSubscriptionStatus)
    : 'inactive';
}

export function isRealStripeSubscriptionId(value: unknown): boolean {
  const id = String(value || '').trim();
  return /^sub_[A-Za-z0-9]+$/.test(id) && !id.toLowerCase().startsWith('sub_test');
}

export function isPaidCheckoutSession(session: Record<string, unknown> | null): boolean {
  if (!session) return false;
  const status = String(session.status || '').trim().toLowerCase();
  const payment = String(session.payment_status || '').trim().toLowerCase();
  return status === 'complete' && (payment === 'paid' || payment === 'no_payment_required');
}

export function checkoutSessionSubscriptionId(session: Record<string, unknown>): string {
  if (typeof session.subscription === 'string') return session.subscription.trim();
  const nested = asRecord(session.subscription);
  return typeof nested?.id === 'string' ? nested.id.trim() : '';
}

export function readCheckoutTenantId(session: Record<string, unknown>): string {
  return readStripeMeta(session, 'tenant_id') || String(session.client_reference_id || '').trim();
}

export type PersistStripeResult =
  | { ok: true; data: unknown; status: string; accessAllowed: boolean }
  | { ok: false; message: string; retry?: boolean };

function persistStatusFromRpc(data: unknown, fallback: string): string {
  const record = Array.isArray(data) ? asRecord(data[0]) : asRecord(data);
  return normalizeStripeSubscriptionStatus(record?.status ?? fallback);
}

export async function persistStripeSubscription(
  env: BillingEnv,
  subscription: Record<string, unknown>,
  options?: {
    tenantId?: string;
    planCode?: string;
    checkoutSessionId?: string | null;
    emitContract?: boolean;
  }
): Promise<PersistStripeResult> {
  const tenantId = (options?.tenantId || readStripeMeta(subscription, 'tenant_id')).trim();
  if (!tenantId) {
    return { ok: false, message: 'Assinatura Stripe sem tenant_id.', retry: false };
  }

  const subscriptionId = typeof subscription.id === 'string' ? subscription.id.trim() : '';
  if (!isRealStripeSubscriptionId(subscriptionId)) {
    return {
      ok: false,
      message: 'Assinatura Stripe inválida. Contrato e acesso não foram liberados.',
      retry: false,
    };
  }

  const items = asRecord(subscription.items);
  const data = Array.isArray(items?.data) ? items.data : [];
  const firstItem = asRecord(data[0]);
  const price = asRecord(firstItem?.price);
  const priceId = typeof price?.id === 'string' ? price.id : '';
  const planCode =
    options?.planCode?.trim()
    || readStripeMeta(subscription, 'plan_code')
    || (await resolvePlanCodeFromStripePriceId(env, priceId))
    || 'semente';

  const status = normalizeStripeSubscriptionStatus(subscription.status);
  const period = stripeSubscriptionPeriod(subscription);

  const result = await supabaseServiceRpc(env, 'upsert_tenant_subscription_from_stripe', {
    p_tenant_id: tenantId,
    p_plan_code: planCode,
    p_status: status,
    p_stripe_customer_id:
      typeof subscription.customer === 'string' ? subscription.customer : null,
    p_stripe_subscription_id: subscriptionId,
    p_stripe_checkout_session_id: options?.checkoutSessionId ?? null,
    p_current_period_start: period.start,
    p_current_period_end: period.end,
    p_cancel_at_period_end: subscription.cancel_at_period_end === true,
    p_raw_stripe: subscription,
    p_emit_contract: options?.emitContract === true,
  });
  if (!result.ok) {
    return result;
  }
  const storedStatus = persistStatusFromRpc(result.data, status);
  return {
    ok: true,
    data: result.data,
    status: storedStatus,
    accessAllowed: stripeStatusGrantsAccess(storedStatus),
  };
}

export type PersistCheckoutSessionResult =
  | {
      ok: true;
      persisted: boolean;
      paymentConfirmed: boolean;
      accessAllowed: boolean;
      status: string;
      retry?: boolean;
      message: string;
    }
  | {
      ok: false;
      persisted: false;
      paymentConfirmed: boolean;
      accessAllowed: false;
      status: string;
      retry?: boolean;
      message: string;
    };

/**
 * Grava assinatura só a partir de uma Checkout Session real da API Stripe.
 * Nunca promove `active` por URL, metadata de cliente ou sessão não paga.
 */
export async function persistFromCheckoutSession(
  env: BillingEnv,
  secret: string,
  session: Record<string, unknown>,
  options?: { expectedTenantId?: string }
): Promise<PersistCheckoutSessionResult> {
  const expectedTenantId = options?.expectedTenantId?.trim() || '';
  const sessionTenant = readCheckoutTenantId(session);
  if (expectedTenantId) {
    if (!sessionTenant) {
      return {
        ok: false,
        persisted: false,
        paymentConfirmed: false,
        accessAllowed: false,
        status: 'inactive',
        retry: false,
        message: 'Sessão Stripe sem tenant_id. O acesso não foi liberado.',
      };
    }
    if (sessionTenant !== expectedTenantId) {
      return {
        ok: false,
        persisted: false,
        paymentConfirmed: false,
        accessAllowed: false,
        status: 'inactive',
        retry: false,
        message: 'Sessão Stripe não pertence a esta igreja.',
      };
    }
  }

  const tenantId = sessionTenant || expectedTenantId;
  if (!tenantId) {
    return {
      ok: false,
      persisted: false,
      paymentConfirmed: false,
      accessAllowed: false,
      status: 'inactive',
      retry: false,
      message: 'Webhook sem metadata.tenant_id.',
    };
  }

  const paymentConfirmed = isPaidCheckoutSession(session);
  if (!paymentConfirmed) {
    return {
      ok: true,
      persisted: false,
      paymentConfirmed: false,
      accessAllowed: false,
      status: String(session.status || '').trim().toLowerCase() === 'expired'
        ? 'incomplete_expired'
        : 'incomplete',
      message:
        'Pagamento não confirmado no Stripe. Nenhum contrato foi emitido e o acesso não foi liberado.',
    };
  }

  const planCode = readStripeMeta(session, 'plan_code') || undefined;
  const sessionId = typeof session.id === 'string' ? session.id : null;
  const subId = checkoutSessionSubscriptionId(session);

  let subscription: Record<string, unknown> | null = asRecord(
    typeof session.subscription === 'object' ? session.subscription : null
  );
  if (subId.startsWith('sub_')) {
    const loaded = await stripeGet(secret, `subscriptions/${subId}?expand[]=items.data.price`);
    if (loaded.ok) {
      subscription = loaded.data;
    }
  }

  if (subscription) {
    const result = await persistStripeSubscription(env, subscription, {
      tenantId,
      planCode,
      checkoutSessionId: sessionId,
      emitContract: true,
    });
    if (!result.ok) {
      return {
        ok: false,
        persisted: false,
        paymentConfirmed,
        accessAllowed: false,
        status: normalizeStripeSubscriptionStatus(subscription.status),
        retry: result.retry,
        message: result.message,
      };
    }
    return {
      ok: true,
      persisted: true,
      paymentConfirmed,
      accessAllowed: paymentConfirmed && result.accessAllowed,
      status: result.status,
      message: paymentConfirmed && result.accessAllowed
        ? 'Pagamento confirmado no Stripe.'
        : paymentConfirmed
          ? `Pagamento registrado, mas a assinatura está ${result.status}. O acesso ainda não foi liberado.`
          : 'Pagamento não confirmado no Stripe. O acesso não foi liberado.',
    };
  }

  return {
    ok: false,
    persisted: false,
    paymentConfirmed: true,
    accessAllowed: false,
    status: 'incomplete',
    retry: true,
    message: 'Pagamento Stripe ok, mas a assinatura ainda não veio. Sem emitir contrato nem liberar acesso.',
  };
}

export async function stripeGet(
  secretKey: string,
  path: string
): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; message: string; status: number }> {
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  const data = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    const err =
      data.error && typeof data.error === 'object'
        ? String((data.error as { message?: string }).message || 'Stripe error')
        : 'Stripe error';
    return { ok: false, message: err, status: response.status };
  }
  return { ok: true, data };
}

const DEFAULT_SUPABASE_URL = 'https://bldbrsuiwctoaxzcrjoc.supabase.co';

function isUsableSupabaseUrl(value: string): boolean {
  const base = value.trim().replace(/\/$/, '');
  if (!base.startsWith('https://') || /\s/.test(base)) return false;
  try {
    const parsed = new URL(base);
    return parsed.protocol === 'https:' && Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

/** Ignora placeholder tipo "URL do projeto" e usa a URL https válida. */
export function resolveSupabaseBaseUrl(env: BillingEnv): string {
  const candidates = [env.SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_URL, DEFAULT_SUPABASE_URL];
  for (const raw of candidates) {
    const base = String(raw || '').trim().replace(/\/$/, '');
    if (isUsableSupabaseUrl(base)) return base;
  }
  return '';
}

export async function supabaseServiceRpc(
  env: BillingEnv,
  fn: string,
  args: Record<string, unknown>
): Promise<{ ok: true; data: unknown } | { ok: false; message: string }> {
  const base = resolveSupabaseBaseUrl(env);
  const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!base || !key) {
    return { ok: false, message: 'Supabase service role não configurada no Cloudflare.' };
  }

  let response: Response;
  try {
    response = await fetch(`${base}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify(args),
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'falha de rede';
    return {
      ok: false,
      message: `Não foi possível chamar o Supabase (${detail}). Confira SUPABASE_URL no Cloudflare.`,
    };
  }

  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    const message =
      typeof data === 'object' && data && 'message' in data
        ? String((data as { message: unknown }).message)
        : text || `RPC ${fn} falhou (${response.status})`;
    return { ok: false, message };
  }

  return { ok: true, data };
}

export async function stripeFormPost(
  secretKey: string,
  path: string,
  params: Record<string, string>
): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; message: string; status: number }> {
  const body = new URLSearchParams(params);
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  const data = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    const err =
      data.error && typeof data.error === 'object'
        ? String((data.error as { message?: string }).message || 'Stripe error')
        : 'Stripe error';
    return { ok: false, message: err, status: response.status };
  }
  return { ok: true, data };
}

/** Verifica assinatura Stripe (v1) — Test Keys / Live Keys. */
export async function verifyStripeWebhookSignature(
  payload: string,
  signatureHeader: string | null,
  secret: string,
  toleranceSec = 3600
): Promise<boolean> {
  if (!signatureHeader || !secret) return false;

  const pairs = signatureHeader.split(',').map((item) => {
    const eq = item.indexOf('=');
    return {
      key: eq >= 0 ? item.slice(0, eq).trim() : '',
      value: eq >= 0 ? item.slice(eq + 1).trim() : '',
    };
  });
  const timestamp = pairs.find((item) => item.key === 't')?.value;
  const signatures = pairs.filter((item) => item.key === 'v1').map((item) => item.value);
  if (!timestamp || signatures.length === 0) return false;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - ts) > toleranceSec) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signed = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(`${timestamp}.${payload}`)
  );
  const digest = [...new Uint8Array(signed)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return signatures.some((expected) => {
    if (digest.length !== expected.length) return false;
    let mismatch = 0;
    for (let i = 0; i < digest.length; i += 1) {
      mismatch |= digest.charCodeAt(i) ^ expected.charCodeAt(i);
    }
    return mismatch === 0;
  });
}

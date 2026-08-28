/** Helpers compartilhados das Pages Functions de billing (Stripe + Supabase). */

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

export async function supabaseServiceRpc(
  env: BillingEnv,
  fn: string,
  args: Record<string, unknown>
): Promise<{ ok: true; data: unknown } | { ok: false; message: string }> {
  const base = (env.SUPABASE_URL || env.EXPO_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
  const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!base || !key) {
    return { ok: false, message: 'Supabase service role não configurada no Cloudflare.' };
  }

  const response = await fetch(`${base}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(args),
  });

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
  toleranceSec = 300
): Promise<boolean> {
  if (!signatureHeader || !secret) return false;

  const parts = Object.fromEntries(
    signatureHeader.split(',').map((item) => {
      const [k, v] = item.split('=');
      return [k.trim(), v?.trim() ?? ''];
    })
  );
  const timestamp = parts.t;
  const expected = parts.v1;
  if (!timestamp || !expected) return false;

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

  if (digest.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < digest.length; i += 1) {
    mismatch |= digest.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return mismatch === 0;
}

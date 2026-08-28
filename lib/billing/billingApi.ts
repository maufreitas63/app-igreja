import type { BillingPlan, TenantBillingStatus } from '@/lib/billing/types';
import { isSupabaseRpcMissingError } from '@/lib/supabaseRpc';
import { supabase } from '@/lib/supabase';
import { getStoredTenantId } from '@/lib/tenantSession';

const mapPlan = (row: Record<string, unknown>): BillingPlan | null => {
  const id = String(row.id ?? '').trim();
  const code = String(row.code ?? '').trim();
  const name = String(row.name ?? '').trim();
  if (!id || !code || !name) return null;
  return {
    id,
    code,
    name,
    description: row.description != null ? String(row.description) : null,
    maxMembers: Number(row.max_members ?? row.maxMembers ?? 0) || 0,
    sortOrder: Number(row.sort_order ?? row.sortOrder ?? 100) || 100,
    stripePriceId:
      row.stripe_price_id != null
        ? String(row.stripe_price_id)
        : row.stripePriceId != null
          ? String(row.stripePriceId)
          : null,
  };
};

const emptyStatus = (message?: string): TenantBillingStatus => ({
  success: false,
  billingConfigured: false,
  tenantId: null,
  hasSubscription: false,
  status: 'inactive',
  accessAllowed: true,
  instanceActive: true,
  memberCount: 0,
  activeMembers: 0,
  activeCongregados: 0,
  maxMembers: null,
  canAddMember: true,
  cancelAtPeriodEnd: false,
  signedAt: null,
  currentPeriodStart: null,
  currentPeriodEnd: null,
  plan: null,
  message,
});

export async function listBillingPlans(): Promise<BillingPlan[]> {
  const { data, error } = await supabase.rpc('list_billing_plans');
  if (error) {
    if (isSupabaseRpcMissingError(error, 'list_billing_plans')) {
      return [];
    }
    console.warn('list_billing_plans:', error.message);
    return [];
  }
  if (!Array.isArray(data)) return [];
  return data
    .map((row) => mapPlan(row as Record<string, unknown>))
    .filter((row): row is BillingPlan => row !== null);
}

export async function getTenantBillingStatus(
  tenantId?: string | null
): Promise<TenantBillingStatus> {
  const resolvedTenant = tenantId?.trim() || (await getStoredTenantId());
  const { data, error } = await supabase.rpc('get_tenant_billing_status', {
    p_tenant_id: resolvedTenant,
  });

  if (error) {
    if (isSupabaseRpcMissingError(error, 'get_tenant_billing_status')) {
      return emptyStatus('Módulo de assinaturas ainda não instalado no Supabase.');
    }
    console.warn('get_tenant_billing_status:', error.message);
    return emptyStatus(error.message);
  }

  const record = (
    Array.isArray(data) ? data[0] : data ?? {}
  ) as Record<string, unknown>;
  const planRaw =
    record.plan && typeof record.plan === 'object'
      ? mapPlan(record.plan as Record<string, unknown>)
      : null;

  return {
    success: record.success === true,
    billingConfigured: record.billing_configured !== false,
    tenantId: record.tenant_id != null ? String(record.tenant_id) : resolvedTenant,
    hasSubscription: record.has_subscription === true,
    status: String(record.status ?? 'inactive'),
    accessAllowed: record.access_allowed === true,
    memberCount: Number(record.member_count ?? 0) || 0,
    activeMembers: Number(record.active_members ?? 0) || 0,
    activeCongregados: Number(record.active_congregados ?? 0) || 0,
    maxMembers:
      record.max_members == null || record.max_members === ''
        ? null
        : Number(record.max_members),
    canAddMember: record.can_add_member === true,
    instanceActive: record.instance_active !== false,
    cancelAtPeriodEnd: record.cancel_at_period_end === true,
    signedAt: record.signed_at != null ? String(record.signed_at) : null,
    currentPeriodStart:
      record.current_period_start != null ? String(record.current_period_start) : null,
    currentPeriodEnd:
      record.current_period_end != null ? String(record.current_period_end) : null,
    plan: planRaw,
    message: typeof record.message === 'string' ? record.message : undefined,
  };
}

export async function assertTenantCanAddMember(tenantId?: string | null): Promise<void> {
  const resolvedTenant = tenantId?.trim() || (await getStoredTenantId());
  const { error } = await supabase.rpc('assert_tenant_can_add_member', {
    p_tenant_id: resolvedTenant,
  });
  if (!error) return;
  if (isSupabaseRpcMissingError(error, 'assert_tenant_can_add_member')) {
    return;
  }
  throw new Error(error.message || 'Não é possível adicionar membros neste plano.');
}

const DEFAULT_BILLING_API_ORIGIN = 'https://app-igreja.pages.dev';

function resolveBillingApiEndpoint(path: string): string {
  const configured = String(process.env.EXPO_PUBLIC_APP_URL || '')
    .trim()
    .replace(/\/$/, '');
  const configuredOk =
    configured.startsWith('https://') && !configured.includes('seu-dominio');

  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    const isLocal = host === 'localhost' || host === '127.0.0.1';
    if (!isLocal) {
      return path;
    }
  }

  const origin = configuredOk ? configured : DEFAULT_BILLING_API_ORIGIN;
  return `${origin}${path}`;
}

function resolveStripeCheckoutEndpoint(): string {
  return resolveBillingApiEndpoint('/api/stripe-create-checkout');
}

async function readBillingApiPayload(response: Response): Promise<{
  success?: boolean;
  url?: string;
  session_id?: string;
  message?: string;
  cancel_at_period_end?: boolean;
  action?: string;
  synced?: boolean;
}> {
  const text = await response.text();
  try {
    return text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    if (/not found/i.test(text) || response.status === 404) {
      throw new Error(
        'A API Stripe não roda no Metro local. Recarregue a página; o app chama a Function no Cloudflare.'
      );
    }
    throw new Error(`API de assinaturas indisponível (${response.status}).`);
  }
}

export async function createStripeCheckoutSession(input: {
  tenantId: string;
  planCode: string;
  successUrl?: string;
  cancelUrl?: string;
  customerEmail?: string;
}): Promise<{ url: string; sessionId: string | null }> {
  const response = await fetch(resolveStripeCheckoutEndpoint(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenant_id: input.tenantId,
      plan_code: input.planCode,
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      customer_email: input.customerEmail,
    }),
  });
  const payload = await readBillingApiPayload(response);
  if (!response.ok || !payload.success || !payload.url) {
    throw new Error(payload.message || 'Não foi possível iniciar o checkout Stripe.');
  }
  return { url: payload.url, sessionId: payload.session_id ?? null };
}

export async function syncTenantSubscriptionFromStripe(input: {
  tenantId: string;
  sessionId?: string | null;
}): Promise<{ synced: boolean; message: string }> {
  const response = await fetch(resolveBillingApiEndpoint('/api/stripe-sync-subscription'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenant_id: input.tenantId,
      session_id: input.sessionId || undefined,
    }),
  });
  const payload = await readBillingApiPayload(response);
  if (!response.ok || !payload.success) {
    throw new Error(payload.message || 'Não foi possível sincronizar a contratação.');
  }
  return {
    synced: payload.synced === true,
    message: payload.message || 'Contratação sincronizada.',
  };
}

export async function manageTenantSubscription(input: {
  tenantId: string;
  action: 'cancel' | 'resume';
}): Promise<{ message: string; cancelAtPeriodEnd: boolean }> {
  const response = await fetch(resolveBillingApiEndpoint('/api/stripe-manage-subscription'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenant_id: input.tenantId,
      action: input.action,
    }),
  });
  const payload = await readBillingApiPayload(response);
  if (!response.ok || !payload.success) {
    throw new Error(payload.message || 'Não foi possível atualizar a contratação.');
  }
  return {
    message: payload.message || 'Contratação atualizada.',
    cancelAtPeriodEnd: payload.cancel_at_period_end === true,
  };
}

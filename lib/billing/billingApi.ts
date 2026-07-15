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
  memberCount: 0,
  activeMembers: 0,
  activeCongregados: 0,
  maxMembers: null,
  canAddMember: true,
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

  const record = (data ?? {}) as Record<string, unknown>;
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
    cancelAtPeriodEnd: record.cancel_at_period_end === true,
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

export async function createStripeCheckoutSession(input: {
  tenantId: string;
  planCode: string;
  successUrl?: string;
  cancelUrl?: string;
  customerEmail?: string;
}): Promise<{ url: string; sessionId: string | null }> {
  const response = await fetch('/api/stripe-create-checkout', {
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
  const payload = (await response.json()) as {
    success?: boolean;
    url?: string;
    session_id?: string;
    message?: string;
  };
  if (!response.ok || !payload.success || !payload.url) {
    throw new Error(payload.message || 'Não foi possível iniciar o checkout Stripe.');
  }
  return { url: payload.url, sessionId: payload.session_id ?? null };
}

/**
 * Cloudflare Pages Function — webhook Stripe (assinaturas).
 * POST /api/stripe-webhook
 * Atualiza tenant_subscriptions no Supabase por tenant_id (nunca cruza igrejas).
 */

import {
  asRecord,
  jsonResponse,
  persistStripeSubscription,
  readStripeMeta,
  stripeGet,
  supabaseServiceRpc,
  unixToIso,
  verifyStripeWebhookSignature,
  type BillingEnv,
} from './_billingShared';

type PagesContext = {
  request: Request;
  env: BillingEnv;
};

type PersistResult = { ok: true; data: unknown } | { ok: false; message: string; retry?: boolean };

function invoiceParentDetails(invoice: Record<string, unknown>): Record<string, unknown> | null {
  return asRecord(asRecord(invoice.parent)?.subscription_details);
}

function invoiceSubscriptionId(invoice: Record<string, unknown>): string {
  if (typeof invoice.subscription === 'string') return invoice.subscription;
  const nested = asRecord(invoice.subscription);
  if (typeof nested?.id === 'string') return nested.id;
  const parentSub = invoiceParentDetails(invoice)?.subscription;
  if (typeof parentSub === 'string') return parentSub;
  const nestedParent = asRecord(parentSub);
  return typeof nestedParent?.id === 'string' ? nestedParent.id : '';
}

function readEventTenantId(object: Record<string, unknown>): string {
  return (
    readStripeMeta(object, 'tenant_id')
    || readStripeMeta(invoiceParentDetails(object), 'tenant_id')
    || String(object.client_reference_id || '').trim()
  );
}

function isRetryablePersistFailure(result: PersistResult): boolean {
  if (result.ok) return false;
  if (result.retry === false) return false;
  const message = result.message;
  if (
    /sem tenant_id|não encontrada|Plano inválido|tenant_id obrigatório/i.test(message)
  ) {
    return false;
  }
  return true;
}

function persistHttpResponse(result: PersistResult) {
  if (result.ok) {
    return jsonResponse({ received: true, updated: true });
  }
  if (isRetryablePersistFailure(result)) {
    return jsonResponse({ received: false, message: result.message }, 500);
  }
  return jsonResponse({ received: true, skipped: true, message: result.message });
}

async function resolveInvoiceTenantId(
  stripeKey: string,
  invoice: Record<string, unknown>,
  fallbackTenantId: string
): Promise<string> {
  const fromInvoice = readEventTenantId(invoice) || fallbackTenantId;
  if (fromInvoice) return fromInvoice;
  const subId = invoiceSubscriptionId(invoice);
  if (!subId.startsWith('sub_')) return '';
  const loaded = await stripeGet(stripeKey, `subscriptions/${subId}`);
  if (!loaded.ok) return '';
  return readEventTenantId(loaded.data);
}

async function processAliancaInvoiceEvent(
  env: BillingEnv,
  stripeKey: string,
  type: string,
  invoice: Record<string, unknown>,
  fallbackTenantId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const invoiceId = typeof invoice.id === 'string' ? invoice.id : '';
  if (!invoiceId.startsWith('in_')) {
    return { ok: true };
  }

  const tenantId = await resolveInvoiceTenantId(stripeKey, invoice, fallbackTenantId);
  if (!tenantId) {
    return { ok: true };
  }

  const subscriptionId = invoiceSubscriptionId(invoice) || null;
  const billingReason = typeof invoice.billing_reason === 'string' ? invoice.billing_reason : '';

  if (type === 'invoice.payment_failed') {
    const result = await supabaseServiceRpc(env, 'process_alianca_invoice_failed', {
      p_stripe_invoice_id: invoiceId,
      p_tenant_id: tenantId,
      p_stripe_subscription_id: subscriptionId,
    });
    return result.ok ? { ok: true } : { ok: false, message: result.message };
  }

  const amountPaid = Number(invoice.amount_paid ?? 0);
  const transitions = asRecord(invoice.status_transitions);
  const paidAt =
    unixToIso(transitions?.paid_at)
    || unixToIso(invoice.created)
    || new Date().toISOString();

  const result = await supabaseServiceRpc(env, 'process_alianca_invoice_paid', {
    p_stripe_invoice_id: invoiceId,
    p_tenant_id: tenantId,
    p_amount_paid_cents: Number.isFinite(amountPaid) ? Math.round(amountPaid) : 0,
    p_currency: typeof invoice.currency === 'string' ? invoice.currency : 'brl',
    p_paid_at: paidAt,
    p_billing_reason: billingReason,
    p_stripe_subscription_id: subscriptionId,
  });
  return result.ok ? { ok: true } : { ok: false, message: result.message };
}

async function upsertFromSubscription(
  env: BillingEnv,
  secret: string,
  subscription: Record<string, unknown>,
  fallbackTenantId?: string,
  fallbackPlanCode?: string,
  checkoutSessionId?: string | null
): Promise<PersistResult> {
  const tenantId = readEventTenantId(subscription) || fallbackTenantId || '';
  if (!tenantId) {
    return { ok: false, message: 'Webhook sem metadata.tenant_id.', retry: false };
  }

  let full = subscription;
  const subId = typeof subscription.id === 'string' ? subscription.id : '';
  if (subId.startsWith('sub_') && secret) {
    const loaded = await stripeGet(secret, `subscriptions/${subId}?expand[]=items.data.price`);
    if (loaded.ok) full = loaded.data;
  }

  return persistStripeSubscription(env, full, {
    tenantId,
    planCode: fallbackPlanCode,
    checkoutSessionId: checkoutSessionId ?? null,
  });
}

export const onRequestGet = async () =>
  jsonResponse({ ok: true, endpoint: 'stripe-webhook' });

export const onRequestPost = async (context: PagesContext) => {
  try {
    const secret = context.env.STRIPE_WEBHOOK_SECRET?.trim();
    const stripeKey = context.env.STRIPE_SECRET_KEY?.trim();
    if (!secret || !stripeKey?.startsWith('sk_test_')) {
      return jsonResponse(
        { received: false, message: 'Webhook Stripe (test) não configurado.' },
        503
      );
    }

    const payload = await context.request.text();
    const signature = context.request.headers.get('stripe-signature');
    const valid = await verifyStripeWebhookSignature(payload, signature, secret);
    if (!valid) {
      return jsonResponse({ received: false, message: 'Assinatura inválida.' }, 400);
    }

    const event = JSON.parse(payload) as {
      type?: string;
      data?: { object?: Record<string, unknown> };
    };
    const type = event.type || '';
    const object = asRecord(event.data?.object) || {};

    if (type === 'checkout.session.completed') {
      const tenantId = readEventTenantId(object);
      const planCode = readStripeMeta(object, 'plan_code') || 'semente';
      const subscriptionId =
        typeof object.subscription === 'string'
          ? object.subscription
          : typeof asRecord(object.subscription)?.id === 'string'
            ? String(asRecord(object.subscription)?.id)
            : null;
      const customerId = typeof object.customer === 'string' ? object.customer : null;
      const sessionId = typeof object.id === 'string' ? object.id : null;

      if (subscriptionId) {
        const subRes = await stripeGet(
          stripeKey,
          `subscriptions/${subscriptionId}?expand[]=items.data.price`
        );
        if (subRes.ok) {
          return persistHttpResponse(
            await persistStripeSubscription(context.env, subRes.data, {
              tenantId,
              planCode,
              checkoutSessionId: sessionId,
            })
          );
        }
      }

      if (!tenantId) {
        return jsonResponse({ received: true, skipped: true, message: 'Checkout sem tenant_id.' });
      }

      const result = await supabaseServiceRpc(context.env, 'upsert_tenant_subscription_from_stripe', {
        p_tenant_id: tenantId,
        p_plan_code: planCode,
        p_status: 'active',
        p_stripe_customer_id: customerId,
        p_stripe_subscription_id: subscriptionId,
        p_stripe_checkout_session_id: sessionId,
        p_current_period_start: new Date().toISOString(),
        p_current_period_end: null,
        p_cancel_at_period_end: false,
        p_raw_stripe: object,
      });
      return persistHttpResponse(result);
    }

    if (
      type.startsWith('customer.subscription.')
      || type === 'invoice.payment_failed'
      || type === 'invoice.paid'
    ) {
      const subscription =
        type.startsWith('customer.subscription.')
          ? object
          : asRecord(typeof object.subscription === 'object' ? object.subscription : null);
      const subscriptionId =
        typeof object.subscription === 'string' ? object.subscription : invoiceSubscriptionId(object);

      let persistResult: PersistResult | null = null;
      let tenantId = readEventTenantId(object);

      if (subscription) {
        persistResult = await upsertFromSubscription(context.env, stripeKey, subscription, tenantId);
        if (persistResult.ok) {
          tenantId = tenantId || readEventTenantId(subscription);
        }
      } else if (subscriptionId.startsWith('sub_')) {
        const subRes = await stripeGet(
          stripeKey,
          `subscriptions/${subscriptionId}?expand[]=items.data.price`
        );
        if (subRes.ok) {
          persistResult = await persistStripeSubscription(context.env, subRes.data, { tenantId });
          if (persistResult.ok) {
            tenantId = tenantId || readEventTenantId(subRes.data);
          }
        }
      }

      if (persistResult && !persistResult.ok && isRetryablePersistFailure(persistResult)) {
        return persistHttpResponse(persistResult);
      }

      if (type === 'invoice.paid' || type === 'invoice.payment_failed') {
        await processAliancaInvoiceEvent(
          context.env,
          stripeKey,
          type,
          object,
          tenantId
        );
      }

      if (persistResult && !persistResult.ok) {
        return persistHttpResponse(persistResult);
      }

      return jsonResponse({ received: true, updated: true });
    }

    return jsonResponse({ received: true, ignored: type });
  } catch (error) {
    return jsonResponse(
      {
        received: false,
        message: error instanceof Error ? error.message : 'Webhook error',
      },
      500
    );
  }
};

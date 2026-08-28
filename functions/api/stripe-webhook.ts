/**
 * Cloudflare Pages Function — webhook Stripe (assinaturas).
 * POST /api/stripe-webhook
 * Atualiza tenant_subscriptions no Supabase por tenant_id (nunca cruza igrejas).
 */

import {
  asRecord,
  jsonResponse,
  planCodeFromStripePriceId,
  stripeSubscriptionPeriod,
  supabaseServiceRpc,
  verifyStripeWebhookSignature,
  type BillingEnv,
} from './_billingShared';

type PagesContext = {
  request: Request;
  env: BillingEnv;
};

const readMeta = (obj: Record<string, unknown> | null, key: string) => {
  const meta = asRecord(obj?.metadata);
  const value = meta?.[key];
  return typeof value === 'string' ? value.trim() : '';
};

async function upsertFromSubscription(
  env: BillingEnv,
  subscription: Record<string, unknown>,
  fallbackTenantId?: string,
  fallbackPlanCode?: string
) {
  const tenantId = readMeta(subscription, 'tenant_id') || fallbackTenantId || '';
  if (!tenantId) {
    return { ok: false as const, message: 'Webhook sem metadata.tenant_id.' };
  }

  const items = asRecord(subscription.items);
  const data = Array.isArray(items?.data) ? items?.data : [];
  const firstItem = asRecord(data[0]);
  const price = asRecord(firstItem?.price);
  const priceId = typeof price?.id === 'string' ? price.id : '';
  const planCode =
    readMeta(subscription, 'plan_code')
    || fallbackPlanCode
    || planCodeFromStripePriceId(env, priceId)
    || 'semente';

  const status = typeof subscription.status === 'string' ? subscription.status : 'inactive';
  const period = stripeSubscriptionPeriod(subscription);

  return supabaseServiceRpc(env, 'upsert_tenant_subscription_from_stripe', {
    p_tenant_id: tenantId,
    p_plan_code: planCode,
    p_status: status,
    p_stripe_customer_id:
      typeof subscription.customer === 'string' ? subscription.customer : null,
    p_stripe_subscription_id:
      typeof subscription.id === 'string' ? subscription.id : null,
    p_stripe_checkout_session_id: null,
    p_current_period_start: period.start,
    p_current_period_end: period.end,
    p_cancel_at_period_end: subscription.cancel_at_period_end === true,
    p_raw_stripe: subscription,
  });
}

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
      const tenantId = readMeta(object, 'tenant_id') || String(object.client_reference_id || '');
      const planCode = readMeta(object, 'plan_code') || 'semente';
      const subscriptionId =
        typeof object.subscription === 'string' ? object.subscription : null;
      const customerId = typeof object.customer === 'string' ? object.customer : null;
      const sessionId = typeof object.id === 'string' ? object.id : null;

      if (subscriptionId) {
        // Busca assinatura completa na API Stripe (test)
        const subRes = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
          headers: { Authorization: `Bearer ${stripeKey}` },
        });
        const subJson = (await subRes.json()) as Record<string, unknown>;
        if (subRes.ok) {
          const result = await upsertFromSubscription(context.env, subJson, tenantId, planCode);
          if (!result.ok) {
            return jsonResponse({ received: false, message: result.message }, 500);
          }
          return jsonResponse({ received: true, updated: true });
        }
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
      if (!result.ok) {
        return jsonResponse({ received: false, message: result.message }, 500);
      }
      return jsonResponse({ received: true, updated: true });
    }

    if (
      type.startsWith('customer.subscription.')
      || type === 'invoice.payment_failed'
      || type === 'invoice.paid'
    ) {
      const subscription =
        type.startsWith('customer.subscription.')
          ? object
          : asRecord(
              typeof object.subscription === 'object'
                ? object.subscription
                : null
            );

      if (subscription) {
        const result = await upsertFromSubscription(context.env, subscription);
        if (!result.ok) {
          return jsonResponse({ received: false, message: result.message }, 500);
        }
        return jsonResponse({ received: true, updated: true });
      }

      if (typeof object.subscription === 'string') {
        const subRes = await fetch(
          `https://api.stripe.com/v1/subscriptions/${object.subscription}`,
          { headers: { Authorization: `Bearer ${stripeKey}` } }
        );
        const subJson = (await subRes.json()) as Record<string, unknown>;
        if (subRes.ok) {
          const result = await upsertFromSubscription(context.env, subJson);
          if (!result.ok) {
            return jsonResponse({ received: false, message: result.message }, 500);
          }
          return jsonResponse({ received: true, updated: true });
        }
      }
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

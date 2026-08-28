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
  verifyStripeWebhookSignature,
  type BillingEnv,
} from './_billingShared';

type PagesContext = {
  request: Request;
  env: BillingEnv;
};

async function upsertFromSubscription(
  env: BillingEnv,
  secret: string,
  subscription: Record<string, unknown>,
  fallbackTenantId?: string,
  fallbackPlanCode?: string,
  checkoutSessionId?: string | null
) {
  const tenantId = readStripeMeta(subscription, 'tenant_id') || fallbackTenantId || '';
  if (!tenantId) {
    return { ok: false as const, message: 'Webhook sem metadata.tenant_id.' };
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
      const tenantId = readStripeMeta(object, 'tenant_id') || String(object.client_reference_id || '');
      const planCode = readStripeMeta(object, 'plan_code') || 'semente';
      const subscriptionId =
        typeof object.subscription === 'string' ? object.subscription : null;
      const customerId = typeof object.customer === 'string' ? object.customer : null;
      const sessionId = typeof object.id === 'string' ? object.id : null;

      if (subscriptionId) {
        const subRes = await stripeGet(
          stripeKey,
          `subscriptions/${subscriptionId}?expand[]=items.data.price`
        );
        if (subRes.ok) {
          const result = await persistStripeSubscription(context.env, subRes.data, {
            tenantId,
            planCode,
            checkoutSessionId: sessionId,
          });
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
          : asRecord(typeof object.subscription === 'object' ? object.subscription : null);

      if (subscription) {
        const result = await upsertFromSubscription(context.env, stripeKey, subscription);
        if (!result.ok) {
          return jsonResponse({ received: false, message: result.message }, 500);
        }
        return jsonResponse({ received: true, updated: true });
      }

      if (typeof object.subscription === 'string') {
        const subRes = await stripeGet(
          stripeKey,
          `subscriptions/${object.subscription}?expand[]=items.data.price`
        );
        if (subRes.ok) {
          const result = await persistStripeSubscription(context.env, subRes.data);
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

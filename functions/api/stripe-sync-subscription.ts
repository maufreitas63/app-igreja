/**
 * Cloudflare Pages Function — grava no banco a assinatura Stripe já paga.
 * POST /api/stripe-sync-subscription
 * body: { tenant_id, session_id? }
 *
 * Usado na volta do Checkout (session_id) e ao abrir Assinaturas, porque o
 * webhook pode falhar sem o card da contratação atualizar.
 */

import {
  asRecord,
  billingCorsHeaders,
  jsonResponse,
  persistStripeSubscription,
  readStripeMeta,
  stripeGet,
  type BillingEnv,
} from './_billingShared';

type PagesContext = {
  request: Request;
  env: BillingEnv;
};

const SUB_EXPAND = 'expand[]=items.data.price';

export const onRequestOptions = async () =>
  new Response(null, { status: 204, headers: billingCorsHeaders });

async function loadSubscription(secret: string, id: string) {
  return stripeGet(secret, `subscriptions/${id}?${SUB_EXPAND}`);
}

function subscriptionScore(sub: Record<string, unknown>) {
  const status = typeof sub.status === 'string' ? sub.status : '';
  const created = Number(sub.created) || 0;
  const rank = status === 'active' || status === 'trialing' ? 2 : status === 'past_due' ? 1 : 0;
  return rank * 1_000_000_000 + created;
}

export const onRequestPost = async (context: PagesContext) => {
  try {
    const secret = context.env.STRIPE_SECRET_KEY?.trim();
    if (!secret || !secret.startsWith('sk_test_')) {
      return jsonResponse(
        { success: false, message: 'Stripe Test Key ausente no Cloudflare.' },
        503
      );
    }

    const body = (await context.request.json()) as {
      tenant_id?: string;
      session_id?: string;
    };
    const tenantId = body.tenant_id?.trim() || '';
    const sessionId = body.session_id?.trim() || '';
    if (!tenantId) {
      return jsonResponse({ success: false, message: 'tenant_id é obrigatório.' }, 400);
    }

    let persisted = false;
    let source = 'none';

    if (sessionId.startsWith('cs_')) {
      const sessionRes = await stripeGet(
        secret,
        `checkout/sessions/${sessionId}?expand[]=subscription`
      );
      if (sessionRes.ok) {
        const session = sessionRes.data;
        const sessionTenant =
          readStripeMeta(session, 'tenant_id') || String(session.client_reference_id || '').trim();
        const planCode = readStripeMeta(session, 'plan_code');
        const subRaw = session.subscription;
        let subscription = asRecord(typeof subRaw === 'object' ? subRaw : null);
        const subId = typeof subRaw === 'string' ? subRaw : typeof subscription?.id === 'string' ? subscription.id : '';
        if (subId.startsWith('sub_')) {
          const full = await loadSubscription(secret, subId);
          if (full.ok) subscription = full.data;
        }
        const targetTenant = sessionTenant || tenantId;
        if (subscription && targetTenant === tenantId) {
          const result = await persistStripeSubscription(context.env, subscription, {
            tenantId,
            planCode: planCode || undefined,
            checkoutSessionId: sessionId,
          });
          if (!result.ok) {
            return jsonResponse({ success: false, message: result.message }, 500);
          }
          persisted = true;
          source = 'checkout_session';
        }
      }
    }

    if (!persisted) {
      const listed = await stripeGet(secret, `subscriptions?status=all&limit=30&${SUB_EXPAND}`);
      if (listed.ok) {
        const rows = Array.isArray(listed.data.data) ? listed.data.data : [];
        const matches = rows
          .map((row) => asRecord(row))
          .filter((row): row is Record<string, unknown> => {
            if (!row) return false;
            return readStripeMeta(row, 'tenant_id') === tenantId;
          })
          .sort((a, b) => subscriptionScore(b) - subscriptionScore(a));
        const best = matches[0];
        if (best) {
          const subId = typeof best.id === 'string' ? best.id : '';
          const full = subId.startsWith('sub_') ? await loadSubscription(secret, subId) : null;
          const subscription = full?.ok ? full.data : best;
          const result = await persistStripeSubscription(context.env, subscription, {
            tenantId,
            checkoutSessionId: sessionId.startsWith('cs_') ? sessionId : null,
          });
          if (!result.ok) {
            return jsonResponse({ success: false, message: result.message }, 500);
          }
          persisted = true;
          source = 'subscription_list';
        }
      }
    }

    return jsonResponse({
      success: true,
      synced: persisted,
      source,
      message: persisted
        ? 'Contratação sincronizada com o Stripe.'
        : 'Nenhuma assinatura Stripe encontrada para esta igreja.',
    });
  } catch (error) {
    return jsonResponse(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Falha ao sincronizar a contratação.',
      },
      500
    );
  }
};

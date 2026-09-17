/**
 * Cloudflare Pages Function — confirma no Stripe e grava a assinatura paga.
 * POST /api/stripe-sync-subscription
 * body: { tenant_id, session_id? }
 *
 * Com session_id (volta do Checkout): só libera se a sessão Stripe estiver
 * complete + paid. Nunca usa query string nem lista antiga como prova de pagamento.
 */

import {
  asRecord,
  billingCorsHeaders,
  isStripeSecretKey,
  jsonResponse,
  persistFromCheckoutSession,
  persistStripeSubscription,
  readStripeMeta,
  stripeGet,
  stripeStatusGrantsAccess,
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
    if (!isStripeSecretKey(secret)) {
      return jsonResponse(
        { success: false, message: 'Stripe Secret Key ausente no Cloudflare.' },
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

    if (sessionId.startsWith('cs_')) {
      const sessionRes = await stripeGet(
        secret,
        `checkout/sessions/${sessionId}?expand[]=subscription`
      );
      if (!sessionRes.ok) {
        return jsonResponse({
          success: true,
          synced: false,
          payment_confirmed: false,
          access_allowed: false,
          status: 'inactive',
          source: 'checkout_session',
          message:
            'Não foi possível confirmar a sessão no Stripe. O acesso não foi liberado.',
        });
      }

      const checkout = await persistFromCheckoutSession(context.env, secret, sessionRes.data, {
        expectedTenantId: tenantId,
      });
      if (!checkout.ok && checkout.retry) {
        return jsonResponse(
          {
            success: false,
            synced: false,
            payment_confirmed: checkout.paymentConfirmed,
            access_allowed: false,
            status: checkout.status,
            source: 'checkout_session',
            message: checkout.message,
          },
          503
        );
      }
      if (!checkout.ok) {
        return jsonResponse(
          {
            success: false,
            synced: false,
            payment_confirmed: false,
            access_allowed: false,
            status: checkout.status,
            source: 'checkout_session',
            message: checkout.message,
          },
          checkout.message.includes('não pertence') ? 403 : 400
        );
      }

      return jsonResponse({
        success: true,
        synced: checkout.persisted,
        payment_confirmed: checkout.paymentConfirmed,
        access_allowed: checkout.accessAllowed,
        status: checkout.status,
        source: 'checkout_session',
        message: checkout.message,
      });
    }

    const listed = await stripeGet(secret, `subscriptions?status=all&limit=30&${SUB_EXPAND}`);
    if (!listed.ok) {
      return jsonResponse({
        success: true,
        synced: false,
        payment_confirmed: false,
        access_allowed: false,
        status: 'inactive',
        source: 'none',
        message: 'Nenhuma assinatura Stripe encontrada para esta igreja.',
      });
    }

    const rows = Array.isArray(listed.data.data) ? listed.data.data : [];
    const matches = rows
      .map((row) => asRecord(row))
      .filter((row): row is Record<string, unknown> => {
        if (!row) return false;
        return readStripeMeta(row, 'tenant_id') === tenantId;
      })
      .sort((a, b) => subscriptionScore(b) - subscriptionScore(a));
    const best = matches[0];
    if (!best) {
      return jsonResponse({
        success: true,
        synced: false,
        payment_confirmed: false,
        access_allowed: false,
        status: 'inactive',
        source: 'none',
        message: 'Nenhuma assinatura Stripe encontrada para esta igreja.',
      });
    }

    const subId = typeof best.id === 'string' ? best.id : '';
    const full = subId.startsWith('sub_') ? await loadSubscription(secret, subId) : null;
    const subscription = full?.ok ? full.data : best;
    const result = await persistStripeSubscription(context.env, subscription, { tenantId });
    if (!result.ok) {
      return jsonResponse({ success: false, message: result.message }, 500);
    }

    return jsonResponse({
      success: true,
      synced: true,
      payment_confirmed: result.accessAllowed,
      access_allowed: stripeStatusGrantsAccess(result.status),
      status: result.status,
      source: 'subscription_list',
      message: 'Contratação sincronizada com o Stripe.',
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

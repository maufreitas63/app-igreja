/**
 * Cloudflare Pages Function — confirma no Stripe e grava a assinatura paga.
 * POST /api/stripe-sync-subscription
 * body: { tenant_id, session_id }
 *
 * Só persiste e emite contrato se a sessão Stripe estiver complete + paid.
 */

import {
  billingCorsHeaders,
  isStripeSecretKey,
  jsonResponse,
  persistFromCheckoutSession,
  stripeGet,
  type BillingEnv,
} from './_billingShared';

type PagesContext = {
  request: Request;
  env: BillingEnv;
};

export const onRequestOptions = async () =>
  new Response(null, { status: 204, headers: billingCorsHeaders });

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

    if (!sessionId.startsWith('cs_')) {
      return jsonResponse({
        success: true,
        synced: false,
        payment_confirmed: false,
        access_allowed: false,
        status: 'incomplete',
        source: 'none',
        message:
          'Informe a sessão Stripe do checkout. Sem sessão paga, nenhum contrato é emitido.',
      });
    }

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

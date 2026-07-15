/**
 * Cloudflare Pages Function — cria Stripe Checkout Session (Test Keys).
 * POST /api/stripe-create-checkout
 * body: { tenant_id, plan_code, success_url?, cancel_url? }
 */

import {
  billingCorsHeaders,
  jsonResponse,
  planCodeFromPriceEnv,
  stripeFormPost,
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
    if (!secret || !secret.startsWith('sk_test_')) {
      return jsonResponse(
        {
          success: false,
          message:
            'Stripe Test Key ausente. Defina STRIPE_SECRET_KEY=sk_test_... nas variáveis do Cloudflare Pages.',
        },
        503
      );
    }

    const body = (await context.request.json()) as {
      tenant_id?: string;
      plan_code?: string;
      success_url?: string;
      cancel_url?: string;
      customer_email?: string;
    };

    const tenantId = body.tenant_id?.trim();
    const planCode = body.plan_code?.trim().toLowerCase();
    if (!tenantId || !planCode) {
      return jsonResponse(
        { success: false, message: 'tenant_id e plan_code são obrigatórios.' },
        400
      );
    }

    const priceId = planCodeFromPriceEnv(context.env, planCode);
    if (!priceId || !priceId.startsWith('price_')) {
      return jsonResponse(
        {
          success: false,
          message: `Price ID de teste não configurado para o plano "${planCode}".`,
        },
        400
      );
    }

    const appUrl = (context.env.EXPO_PUBLIC_APP_URL || 'https://app-igreja.pages.dev').replace(
      /\/$/,
      ''
    );
    const successUrl =
      body.success_url?.trim()
      || `${appUrl}/billing?checkout=success&igreja=IBEP`;
    const cancelUrl =
      body.cancel_url?.trim() || `${appUrl}/billing?checkout=cancel&igreja=IBEP`;

    const params: Record<string, string> = {
      mode: 'subscription',
      success_url: `${successUrl}${successUrl.includes('?') ? '&' : '?'}session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': '1',
      client_reference_id: tenantId,
      'metadata[tenant_id]': tenantId,
      'metadata[plan_code]': planCode,
      'subscription_data[metadata][tenant_id]': tenantId,
      'subscription_data[metadata][plan_code]': planCode,
    };

    if (body.customer_email?.trim()) {
      params.customer_email = body.customer_email.trim();
    }

    const created = await stripeFormPost(secret, 'checkout/sessions', params);
    if (!created.ok) {
      return jsonResponse({ success: false, message: created.message }, created.status || 502);
    }

    const url = typeof created.data.url === 'string' ? created.data.url : null;
    const id = typeof created.data.id === 'string' ? created.data.id : null;
    if (!url) {
      return jsonResponse({ success: false, message: 'Checkout Session sem URL.' }, 502);
    }

    return jsonResponse({
      success: true,
      url,
      session_id: id,
      tenant_id: tenantId,
      plan_code: planCode,
    });
  } catch (error) {
    return jsonResponse(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Falha ao criar checkout.',
      },
      500
    );
  }
};

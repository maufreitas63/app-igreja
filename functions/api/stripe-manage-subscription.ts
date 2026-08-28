/**
 * Cloudflare Pages Function — cancela na renovação ou retoma a assinatura Stripe.
 * POST /api/stripe-manage-subscription
 * body: { tenant_id, action: 'cancel' | 'resume' }
 */

import {
  billingCorsHeaders,
  jsonResponse,
  stripeFormPost,
  stripeSubscriptionPeriod,
  supabaseServiceRpc,
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
        { success: false, message: 'Stripe Test Key ausente no Cloudflare.' },
        503
      );
    }

    const body = (await context.request.json()) as {
      tenant_id?: string;
      action?: string;
    };
    const tenantId = body.tenant_id?.trim();
    const action = body.action?.trim().toLowerCase();
    if (!tenantId || (action !== 'cancel' && action !== 'resume')) {
      return jsonResponse(
        { success: false, message: 'tenant_id e action (cancel|resume) são obrigatórios.' },
        400
      );
    }

    const statusRes = await supabaseServiceRpc(context.env, 'get_tenant_billing_status', {
      p_tenant_id: tenantId,
    });
    if (!statusRes.ok) {
      return jsonResponse({ success: false, message: statusRes.message }, 400);
    }

    const raw = Array.isArray(statusRes.data) ? statusRes.data[0] : statusRes.data;
    const record = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
    const subscriptionId =
      typeof record.stripe_subscription_id === 'string'
        ? record.stripe_subscription_id.trim()
        : '';
    if (!subscriptionId.startsWith('sub_')) {
      return jsonResponse(
        {
          success: false,
          message: 'Não há assinatura Stripe vinculada. Conclua o checkout antes de renovar ou rescindir.',
        },
        400
      );
    }

    const updated = await stripeFormPost(secret, `subscriptions/${subscriptionId}`, {
      cancel_at_period_end: action === 'cancel' ? 'true' : 'false',
    });
    if (!updated.ok) {
      return jsonResponse({ success: false, message: updated.message }, updated.status || 502);
    }

    const plan =
      record.plan && typeof record.plan === 'object'
        ? (record.plan as { code?: string })
        : null;
    const planCode = String(plan?.code || 'semente');
    const sub = updated.data;
    const status = typeof sub.status === 'string' ? sub.status : 'active';
    const cancelAtEnd = sub.cancel_at_period_end === true;

    const period = stripeSubscriptionPeriod(sub);
    const persist = await supabaseServiceRpc(context.env, 'upsert_tenant_subscription_from_stripe', {
      p_tenant_id: tenantId,
      p_plan_code: planCode,
      p_status: status,
      p_stripe_customer_id: typeof sub.customer === 'string' ? sub.customer : null,
      p_stripe_subscription_id: typeof sub.id === 'string' ? sub.id : subscriptionId,
      p_stripe_checkout_session_id: null,
      p_current_period_start: period.start,
      p_current_period_end: period.end,
      p_cancel_at_period_end: cancelAtEnd,
      p_raw_stripe: sub,
    });
    if (!persist.ok) {
      return jsonResponse({ success: false, message: persist.message }, 500);
    }

    return jsonResponse({
      success: true,
      action,
      cancel_at_period_end: cancelAtEnd,
      message:
        action === 'cancel'
          ? 'Rescisão agendada para a próxima renovação. Até lá a instância permanece ativa.'
          : 'Contratação renovada. A cobrança segue na próxima data.',
    });
  } catch (error) {
    return jsonResponse(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Falha ao atualizar a assinatura.',
      },
      500
    );
  }
};

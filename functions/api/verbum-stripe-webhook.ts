/**
 * Webhook Stripe só do Verbum. Não altera a assinatura da igreja.
 * POST /api/verbum-stripe-webhook
 * O evento precisa trazer metadata.verbum = "1" e client_reference_id = profile id.
 */
import {
  jsonResponse,
  supabaseServiceRpc,
  verifyStripeWebhookSignature,
  type BillingEnv,
} from './_billingShared';

type PagesContext = {
  request: Request;
  env: BillingEnv;
};

const FAMILY_TIERS = new Set(['FIDELIS_FAMILY', 'ALIANCA_FAMILY']);
const PAID_TIERS = new Set(['FIDELIS', 'FIDELIS_FAMILY', 'ALIANCA', 'ALIANCA_FAMILY']);

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function tierOf(metadata: Record<string, unknown> | null): string {
  const tier = typeof metadata?.verbum_tier === 'string' ? metadata.verbum_tier : 'FREE';
  return PAID_TIERS.has(tier) || FAMILY_TIERS.has(tier) ? tier : 'FREE';
}

export const onRequestPost = async (context: PagesContext) => {
  const secret = context.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return jsonResponse({ received: false, message: 'Webhook do Verbum não configurado.' }, 503);
  }

  const payload = await context.request.text();
  const valid = await verifyStripeWebhookSignature(
    payload,
    context.request.headers.get('stripe-signature'),
    secret
  );
  if (!valid) {
    return jsonResponse({ received: false, message: 'Assinatura inválida.' }, 400);
  }

  const event = JSON.parse(payload) as { type?: string; data?: { object?: unknown } };
  const object = asRecord(event.data?.object);
  const metadata = asRecord(object?.metadata);
  if (metadata?.verbum !== '1') {
    return jsonResponse({ received: true, ignored: true });
  }

  const profileId =
    (typeof object?.client_reference_id === 'string' && object.client_reference_id) ||
    (typeof metadata?.profile_id === 'string' && metadata.profile_id) ||
    null;
  if (!profileId) {
    return jsonResponse({ received: false, message: 'Perfil do Verbum ausente.' }, 400);
  }

  const type = event.type ?? '';
  const active = type !== 'customer.subscription.deleted';
  const status =
    type === 'customer.subscription.deleted'
      ? 'INACTIVE'
      : typeof object?.status === 'string'
        ? object.status.toUpperCase()
        : 'ACTIVE';
  const periodEnd =
    typeof object?.current_period_end === 'number'
      ? new Date(object.current_period_end * 1000).toISOString()
      : null;

  const saved = await supabaseServiceRpc(context.env, 'verbum_apply_stripe_event', {
    p_profile_id: profileId,
    p_tier: active ? tierOf(metadata) : 'FREE',
    p_status: status,
    p_cycle: typeof metadata?.cycle === 'string' ? metadata.cycle : null,
    p_customer: typeof object?.customer === 'string' ? object.customer : null,
    p_subscription: typeof object?.subscription === 'string' ? object.subscription : typeof object?.id === 'string' ? object.id : null,
    p_period_end: periodEnd,
    p_active: active && type !== 'customer.subscription.updated' ? status === 'ACTIVE' || status === 'TRIALING' || type === 'checkout.session.completed' : active && (status === 'ACTIVE' || status === 'TRIALING'),
  });

  if (!saved.ok) {
    return jsonResponse({ received: false, message: saved.message }, 500);
  }
  return jsonResponse({ received: true });
};

/** Ciclo comercial dos planos SaaS. O Price no Stripe deve ter o mesmo intervalo. */
export const BILLING_INTERVAL_MONTHS = 3;

export const BILLING_INTERVAL_LABEL = 'trimestral';

export const BILLING_INTERVAL_LINE = 'Cobrança trimestral';

export const BILLING_SCREEN_SUBTITLE =
  'Escolha o plano da sua igreja. A cobrança é trimestral e o pagamento é processado com segurança pelo Stripe.';

/** Fallback de vitrine (centavos BRL / trimestre) se o RPC ainda não devolver o valor. */
export const PLAN_QUARTERLY_AMOUNT_CENTS: Record<string, number> = {
  semente: 8970,
  crescimento: 23970,
  expansao: 44970,
  ministerio: 89970,
};

export function formatBillingBrl(amountCents: number): string {
  return (amountCents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

/** Ex.: R$ 89,70 por trimestre (equivalente a R$ 29,90 por mês) */
export function formatPlanQuarterlyPriceLine(quarterlyCents: number): string {
  const monthlyCents = Math.round(quarterlyCents / BILLING_INTERVAL_MONTHS);
  return `${formatBillingBrl(quarterlyCents)} por trimestre (equivalente a ${formatBillingBrl(monthlyCents)} por mês)`;
}

export function resolvePlanQuarterlyAmountCents(
  planCode: string,
  quarterlyAmountCents?: number | null
): number | null {
  if (quarterlyAmountCents != null && Number.isFinite(quarterlyAmountCents) && quarterlyAmountCents > 0) {
    return Math.round(quarterlyAmountCents);
  }
  const fallback = PLAN_QUARTERLY_AMOUNT_CENTS[planCode.trim().toLowerCase()];
  return fallback ?? null;
}

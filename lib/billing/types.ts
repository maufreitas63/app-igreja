export type BillingPlanCode = 'semente' | 'crescimento' | 'expansao' | 'ministerio';

export type BillingPlan = {
  id: string;
  code: BillingPlanCode | string;
  name: string;
  description: string | null;
  maxMembers: number;
  sortOrder: number;
  stripePriceId: string | null;
  /** Valor cobrado no Stripe a cada trimestre, em centavos BRL. */
  quarterlyAmountCents?: number | null;
};

export type TenantBillingStatus = {
  success: boolean;
  billingConfigured: boolean;
  tenantId: string | null;
  hasSubscription: boolean;
  status: string;
  accessAllowed: boolean;
  instanceActive: boolean;
  memberCount: number;
  /** Membros ativos (papel member). */
  activeMembers: number;
  /** Congregados ativos. */
  activeCongregados: number;
  maxMembers: number | null;
  canAddMember: boolean;
  cancelAtPeriodEnd?: boolean;
  signedAt?: string | null;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  plan: BillingPlan | null;
  message?: string;
};

export type BillingPlanCode = 'semente' | 'crescimento' | 'expansao' | 'ministerio';

export type BillingPlan = {
  id: string;
  code: BillingPlanCode | string;
  name: string;
  description: string | null;
  maxMembers: number;
  sortOrder: number;
  stripePriceId: string | null;
};

export type TenantBillingStatus = {
  success: boolean;
  billingConfigured: boolean;
  tenantId: string | null;
  hasSubscription: boolean;
  status: string;
  accessAllowed: boolean;
  memberCount: number;
  maxMembers: number | null;
  canAddMember: boolean;
  cancelAtPeriodEnd?: boolean;
  currentPeriodEnd?: string | null;
  plan: BillingPlan | null;
  message?: string;
};

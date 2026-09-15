export const ALIANCA_REWARD_PCT = 0.4;
export const ALIANCA_MAX_CICLOS = 4;
export const ALIANCA_PAYOUT_CATEGORY = 'Oferta de Apoio Ministerial - Aliança';

export type AliancaPartnershipStatus = 'Ativo' | 'Encerrado' | 'Suspenso_Inadimplencia';
export type AliancaPayoutStatus = 'A_Pagar' | 'Pago';

export type AliancaDaughterRow = {
  filha_tenant_id: string;
  filha_code: string;
  filha_name: string;
  partnership_id: string | null;
  status_global: AliancaPartnershipStatus | string;
  status_label: string;
  ciclos_pagos: number;
  data_inicio: string | null;
  data_fim: string | null;
  next_due_at: string | null;
  next_amount_cents: number | null;
};

export type AliancaMaePayoutRow = {
  id: string;
  filha_code: string;
  filha_name: string;
  gross_amount_cents: number;
  reward_amount_cents: number;
  due_at: string | null;
  status: AliancaPayoutStatus | string;
  paid_at: string | null;
  ciclo_number: number | null;
  created_at: string | null;
  category: string;
};

export type AliancaMaePanel = {
  success: boolean;
  message?: string;
  tenant_id?: string;
  daughters: AliancaDaughterRow[];
  payouts: AliancaMaePayoutRow[];
};

export type AliancaAdminPayoutRow = {
  id: string;
  mae_code: string;
  mae_name: string;
  filha_code: string;
  filha_name: string;
  gross_amount_cents: number;
  reward_amount_cents: number;
  due_at: string | null;
  status: AliancaPayoutStatus | string;
  paid_at: string | null;
  ciclo_number: number | null;
  ciclos_pagos: number;
  status_global: AliancaPartnershipStatus | string;
  created_at: string | null;
};

export type AliancaAdminStatement = {
  success: boolean;
  message?: string;
  gross_revenue_cents: number;
  payout_pending_cents: number;
  payout_paid_cents: number;
  net_realized_cents: number;
  net_after_pending_cents: number;
  reward_pct: number;
  payouts: AliancaAdminPayoutRow[];
};

export type AliancaPartnerLead = {
  id: string;
  indicatedName: string;
  indicatedRole: string;
  indicatedPhone: string;
  indicatedChurchName: string;
  city: string;
  uf: string;
  estimatedMembers: number | null;
  currentSystems: string;
  governanceNotes: string;
  tiNotes: string;
  priority: string;
  lastContactAt: string | null;
  nextActionAt: string | null;
  lostReason: string;
  stage: string;
  subStage: number;
  enteredStageAt: string | null;
  referrerName: string;
  instanceCode: string;
  instanceName: string;
  tenantId: string;
  createdAt: string | null;
  updatedAt: string | null;
};

export type AliancaPartnerLeadMovement = {
  id: string;
  fromStage: string | null;
  fromSubStage: number | null;
  toStage: string;
  toSubStage: number;
  actorProfileId: string;
  actorName: string;
  createdAt: string | null;
};

export type AliancaPartnerLeadNotification = {
  id: string;
  leadId: string;
  title: string;
  body: string;
  createdAt: string | null;
};

export function formatAliancaCents(cents: number | null | undefined): string {
  const value = (Number(cents) || 0) / 100;
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatAliancaDate(value: string | null | undefined): string {
  if (!value) return '—';
  const raw = String(value).slice(0, 10);
  const [y, m, d] = raw.split('-');
  if (!y || !m || !d) return raw;
  return `${d}/${m}/${y}`;
}

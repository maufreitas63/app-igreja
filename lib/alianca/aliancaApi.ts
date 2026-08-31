import { supabase } from '@/lib/supabase';
import { isSupabaseRpcMissingError } from '@/lib/supabaseRpc';
import type { AliancaAdminStatement, AliancaMaePanel } from '@/lib/alianca/types';

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asNumber(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function asText(value: unknown): string {
  return value == null ? '' : String(value).trim();
}

function asTextOrNull(value: unknown): string | null {
  const text = asText(value);
  return text || null;
}

function mapMaePanel(raw: unknown): AliancaMaePanel {
  const row = asRecord(raw) || {};
  const daughters = Array.isArray(row.daughters) ? row.daughters : [];
  const payouts = Array.isArray(row.payouts) ? row.payouts : [];
  return {
    success: row.success === true,
    message: asTextOrNull(row.message) ?? undefined,
    tenant_id: asTextOrNull(row.tenant_id) ?? undefined,
    daughters: daughters.map((item) => {
      const d = asRecord(item) || {};
      return {
        filha_tenant_id: asText(d.filha_tenant_id),
        filha_code: asText(d.filha_code),
        filha_name: asText(d.filha_name),
        partnership_id: asTextOrNull(d.partnership_id),
        status_global: asText(d.status_global) || 'Ativo',
        status_label: asText(d.status_label) || 'Apta',
        ciclos_pagos: asNumber(d.ciclos_pagos),
        data_inicio: asTextOrNull(d.data_inicio),
        data_fim: asTextOrNull(d.data_fim),
        next_due_at: asTextOrNull(d.next_due_at),
        next_amount_cents: d.next_amount_cents == null ? null : asNumber(d.next_amount_cents),
      };
    }),
    payouts: payouts.map((item) => {
      const p = asRecord(item) || {};
      return {
        id: asText(p.id),
        filha_code: asText(p.filha_code),
        filha_name: asText(p.filha_name),
        gross_amount_cents: asNumber(p.gross_amount_cents),
        reward_amount_cents: asNumber(p.reward_amount_cents),
        due_at: asTextOrNull(p.due_at),
        status: asText(p.status) || 'A_Pagar',
        paid_at: asTextOrNull(p.paid_at),
        ciclo_number: p.ciclo_number == null ? null : asNumber(p.ciclo_number),
        created_at: asTextOrNull(p.created_at),
        category: asText(p.category) || 'Oferta de Apoio Ministerial - Aliança',
      };
    }),
  };
}

function mapAdminStatement(raw: unknown): AliancaAdminStatement {
  const row = asRecord(raw) || {};
  const payouts = Array.isArray(row.payouts) ? row.payouts : [];
  return {
    success: row.success === true,
    message: asTextOrNull(row.message) ?? undefined,
    gross_revenue_cents: asNumber(row.gross_revenue_cents),
    payout_pending_cents: asNumber(row.payout_pending_cents),
    payout_paid_cents: asNumber(row.payout_paid_cents),
    net_realized_cents: asNumber(row.net_realized_cents),
    net_after_pending_cents: asNumber(row.net_after_pending_cents),
    reward_pct: asNumber(row.reward_pct) || 0.4,
    payouts: payouts.map((item) => {
      const p = asRecord(item) || {};
      return {
        id: asText(p.id),
        mae_code: asText(p.mae_code),
        mae_name: asText(p.mae_name),
        filha_code: asText(p.filha_code),
        filha_name: asText(p.filha_name),
        gross_amount_cents: asNumber(p.gross_amount_cents),
        reward_amount_cents: asNumber(p.reward_amount_cents),
        due_at: asTextOrNull(p.due_at),
        status: asText(p.status) || 'A_Pagar',
        paid_at: asTextOrNull(p.paid_at),
        ciclo_number: p.ciclo_number == null ? null : asNumber(p.ciclo_number),
        ciclos_pagos: asNumber(p.ciclos_pagos),
        status_global: asText(p.status_global) || 'Ativo',
        created_at: asTextOrNull(p.created_at),
      };
    }),
  };
}

const MISSING_SQL = 'RPC Aliança ausente. Execute scripts/alianca-conecta-reino.sql.';

export async function getAliancaMaePanel(): Promise<AliancaMaePanel> {
  const { data, error } = await supabase.rpc('get_alianca_mae_panel');
  if (error) {
    if (isSupabaseRpcMissingError(error, 'get_alianca_mae_panel')) {
      return { success: false, message: MISSING_SQL, daughters: [], payouts: [] };
    }
    return {
      success: false,
      message: error.message || 'Não foi possível carregar a Aliança.',
      daughters: [],
      payouts: [],
    };
  }
  return mapMaePanel(data);
}

export async function getAliancaAdminStatement(): Promise<AliancaAdminStatement> {
  const { data, error } = await supabase.rpc('get_alianca_admin_statement');
  if (error) {
    if (isSupabaseRpcMissingError(error, 'get_alianca_admin_statement')) {
      return {
        success: false,
        message: MISSING_SQL,
        gross_revenue_cents: 0,
        payout_pending_cents: 0,
        payout_paid_cents: 0,
        net_realized_cents: 0,
        net_after_pending_cents: 0,
        reward_pct: 0.4,
        payouts: [],
      };
    }
    return {
      success: false,
      message: error.message || 'Não foi possível carregar o demonstrativo.',
      gross_revenue_cents: 0,
      payout_pending_cents: 0,
      payout_paid_cents: 0,
      net_realized_cents: 0,
      net_after_pending_cents: 0,
      reward_pct: 0.4,
      payouts: [],
    };
  }
  return mapAdminStatement(data);
}

export async function settleAliancaPayoutAdmin(
  payoutId: string
): Promise<{ success: boolean; message: string }> {
  const { data, error } = await supabase.rpc('settle_alianca_payout_admin', {
    p_payout_id: payoutId,
  });
  if (error) {
    return { success: false, message: error.message || 'Falha ao baixar o repasse.' };
  }
  const row = asRecord(data) || {};
  return {
    success: row.success === true,
    message: asText(row.message) || (row.success === true ? 'Oferta efetivada.' : 'Falha.'),
  };
}

export async function setIgrejaMaeTenantAdmin(
  filhaTenantId: string,
  maeTenantId: string | null
): Promise<{ success: boolean; message: string }> {
  const { data, error } = await supabase.rpc('set_igreja_mae_tenant_admin', {
    p_filha_tenant_id: filhaTenantId,
    p_mae_tenant_id: maeTenantId,
  });
  if (error) {
    return { success: false, message: error.message || 'Falha ao vincular a igreja mãe.' };
  }
  const row = asRecord(data) || {};
  return {
    success: row.success === true,
    message: asText(row.message) || (row.success === true ? 'Salvo.' : 'Falha.'),
  };
}

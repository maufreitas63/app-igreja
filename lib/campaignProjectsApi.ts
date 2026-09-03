/**
 * Campanhas e projetos (metas financeiras com conciliação por centavos).
 * SQL: scripts/campaign-projects-schema.sql
 */

import { pickChurchLogoFromGallery, uploadChurchPublicImage } from '@/lib/churchLogo';
import { normalizePixAccountSlot, type PixAccountSlot } from '@/lib/pixAccountsApi';
import { supabase } from '@/lib/supabase';
import { isSupabaseRpcMissingError } from '@/lib/supabaseRpc';
import { getStoredTenantId } from '@/lib/tenantSession';

export const CAMPAIGN_PROJECTS_SQL_HINT =
  'Execute no Supabase: scripts/campaign-projects-schema.sql';

export const CAMPAIGN_STATUSES = ['rascunho', 'ativo', 'concluido'] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const CAMPAIGN_STATUS_LABEL: Record<CampaignStatus, string> = {
  rascunho: 'Rascunho',
  ativo: 'Ativo',
  concluido: 'Concluído',
};

export type CampaignProject = {
  id: string;
  titulo: string;
  descricao: string;
  meta_financeira: number | null;
  valor_arrecadado: number;
  data_inicio: string;
  data_fim: string | null;
  status: CampaignStatus;
  centavos_referencia: number;
  chave_pix_selecionada: PixAccountSlot;
  pix_key: string | null;
  pix_institution: string | null;
  cover_url: string | null;
  progress_pct: number;
  donations_count: number;
  unique_donors: number;
  velocity_per_day: number;
};

export type CampaignFinancialSummary = {
  ordinaryRevenue: number;
  campaignRevenue: number;
};

export type CampaignNotice = {
  id: string;
  title: string;
  body: string;
  created_at: string;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

const throwIfMissing = (error: { message?: string }, name: string) => {
  if (isSupabaseRpcMissingError(error, name)) {
    throw new Error(CAMPAIGN_PROJECTS_SQL_HINT);
  }
};

const rpcJson = async (name: string, args?: Record<string, unknown>) => {
  const { data, error } = await supabase.rpc(name, args ?? {});

  if (error) {
    throwIfMissing(error, name);
    throw new Error(error.message || 'Falha nas campanhas.');
  }

  return asRecord(data);
};

const parseStatus = (value: unknown): CampaignStatus => {
  if (value === 'ativo' || value === 'concluido' || value === 'rascunho') {
    return value;
  }

  return 'rascunho';
};

const parseOptionalAmount = (value: unknown): number | null => {
  if (value == null || value === '') {
    return null;
  }

  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
};

const parseCampaign = (value: unknown): CampaignProject | null => {
  const row = asRecord(value);
  const id = String(row.id ?? '').trim();
  const titulo = String(row.titulo ?? '').trim();

  if (!id || !titulo) {
    return null;
  }

  return {
    id,
    titulo,
    descricao: String(row.descricao ?? '').trim(),
    meta_financeira: parseOptionalAmount(row.meta_financeira),
    valor_arrecadado: Number(row.valor_arrecadado ?? 0),
    data_inicio: String(row.data_inicio ?? ''),
    data_fim: row.data_fim != null ? String(row.data_fim) : null,
    status: parseStatus(row.status),
    centavos_referencia: Number(row.centavos_referencia ?? 0),
    chave_pix_selecionada: normalizePixAccountSlot(row.chave_pix_selecionada),
    pix_key: row.pix_key != null && String(row.pix_key).trim() ? String(row.pix_key).trim() : null,
    pix_institution:
      row.pix_institution != null && String(row.pix_institution).trim()
        ? String(row.pix_institution).trim()
        : null,
    cover_url: row.cover_url ? String(row.cover_url) : null,
    progress_pct: Number(row.progress_pct ?? 0),
    donations_count: Number(row.donations_count ?? 0),
    unique_donors: Number(row.unique_donors ?? 0),
    velocity_per_day: Number(row.velocity_per_day ?? 0),
  };
};

export function formatCampaignBrl(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number.isFinite(value) ? value : 0);
}

export function formatCampaignGoal(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value) || value <= 0) {
    return 'sem meta definida';
  }

  return formatCampaignBrl(value);
}

export function formatCampaignProgressLabel(
  arrecadado: number,
  meta: number | null | undefined,
  progressPct: number
) {
  const raised = formatCampaignBrl(arrecadado);

  if (meta == null || !Number.isFinite(meta) || meta <= 0) {
    return raised;
  }

  return `${Math.max(0, Math.min(100, progressPct)).toFixed(0)}% · ${raised} de ${formatCampaignBrl(meta)}`;
}

export function formatCampaignCentsHint(centavos: number) {
  const cents = Math.round((Number.isFinite(centavos) ? centavos : 0) * 100);
  const padded = String(Math.max(1, Math.min(99, cents))).padStart(2, '0');
  return `Os centavos ,${padded} são adicionados automaticamente ao valor para identificar este projeto`;
}

export function formatCampaignCentsShort(centavos: number) {
  const cents = Math.round((Number.isFinite(centavos) ? centavos : 0) * 100);
  return `,${String(Math.max(1, Math.min(99, cents))).padStart(2, '0')}`;
}

const parseCampaignList = (payload: Record<string, unknown>) => {
  if (payload.success === false) {
    throw new Error(String(payload.message ?? 'Sem permissão para campanhas.'));
  }

  const rows = Array.isArray(payload.campaigns) ? payload.campaigns : [];
  return rows.map(parseCampaign).filter((row): row is CampaignProject => row !== null);
};

export async function fetchActiveCampaignProjects(): Promise<CampaignProject[]> {
  return parseCampaignList(await rpcJson('list_active_campaign_projects'));
}

export async function fetchCampaignProjectsAdmin(): Promise<CampaignProject[]> {
  return parseCampaignList(await rpcJson('list_campaign_projects_admin'));
}

export async function fetchCampaignProject(id: string): Promise<CampaignProject | null> {
  const payload = await rpcJson('get_campaign_project', { p_id: id });

  if (payload.success === false) {
    return null;
  }

  return parseCampaign(payload.campaign);
}

export async function saveCampaignProject(input: {
  id?: string | null;
  titulo: string;
  descricao: string;
  metaFinanceira: number | null;
  dataInicio: string;
  dataFim: string | null;
  status: CampaignStatus;
  centavosReferencia: number;
  coverUrl?: string | null;
  chavePixSelecionada?: PixAccountSlot;
}) {
  const payload = await rpcJson('upsert_campaign_project', {
    p_id: input.id ?? null,
    p_titulo: input.titulo,
    p_descricao: input.descricao,
    p_meta_financeira: input.metaFinanceira,
    p_data_inicio: input.dataInicio || null,
    p_data_fim: input.dataFim || null,
    p_status: input.status,
    p_centavos_referencia: input.centavosReferencia,
    p_cover_url: input.coverUrl ?? null,
    p_chave_pix_selecionada: input.chavePixSelecionada ?? '1',
  });

  return {
    success: payload.success === true,
    message: String(
      payload.message ?? (payload.success === true ? 'Campanha salva.' : 'Falha ao salvar.')
    ),
    id: payload.id ? String(payload.id) : null,
    campaign: parseCampaign(payload.campaign),
  };
}

export async function registerCampaignContributionIntent(campaignId: string) {
  try {
    await rpcJson('register_campaign_contribution_intent', { p_campaign_id: campaignId });
  } catch {
    // Intenção é telemetria de doador único — não bloqueia o PIX.
  }
}

export async function fetchCampaignFinancialSummary(): Promise<CampaignFinancialSummary> {
  try {
    const payload = await rpcJson('list_campaign_financial_summary');
    return {
      ordinaryRevenue: Number(payload.ordinary_revenue ?? 0),
      campaignRevenue: Number(payload.campaign_revenue ?? 0),
    };
  } catch {
    return { ordinaryRevenue: 0, campaignRevenue: 0 };
  }
}

export async function fetchMyCampaignNotices(): Promise<CampaignNotice[]> {
  try {
    const payload = await rpcJson('list_my_campaign_notices');
    const rows = Array.isArray(payload.notices) ? payload.notices : [];

    return rows
      .map((item) => {
        const row = asRecord(item);
        const id = String(row.id ?? '').trim();
        const body = String(row.body ?? '').trim();

        if (!id || !body) {
          return null;
        }

        return {
          id,
          title: String(row.title ?? 'Campanha'),
          body,
          created_at: String(row.created_at ?? ''),
        } satisfies CampaignNotice;
      })
      .filter((row): row is CampaignNotice => row !== null);
  } catch {
    return [];
  }
}

export async function pickAndUploadCampaignCover(campaignId?: string | null) {
  const image = await pickChurchLogoFromGallery();

  if (!image) {
    return null;
  }

  const tenantId = (await getStoredTenantId())?.trim();

  if (!tenantId) {
    throw new Error('Igreja não identificada para o upload da capa.');
  }

  const suffix = campaignId?.trim() || `draft-${Date.now()}`;
  return uploadChurchPublicImage(tenantId, `campaigns/${suffix}`, image);
}

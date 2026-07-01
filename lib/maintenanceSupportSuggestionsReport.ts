import type { MaintenanceReportRow } from '@/lib/maintenanceReportsApi';
import { formatReportDateTime } from '@/lib/maintenanceReportFormatting';

export const SUPPORT_SUGGESTIONS_REPORT_PDF_FILENAME = 'Sugestões e Melhorias.pdf';

export type SupportSuggestionHistoricoEntry = {
  data_hora: string;
  tipo: string;
  canal: string;
  autor: string;
  papel: string;
  mensagem: string;
};

export type SupportSuggestionReportRow = {
  solicitante: string;
  telefone: string;
  tipo: string;
  tema: string;
  status: string;
  abertura_em: string;
  atualizado_em: string;
  respondido_em: string | null;
  descricao: string;
  acao_desenvolvedor: string | null;
  orientacoes: string | null;
  previsao_conclusao: string | null;
  anexos: number;
  anexos_nomes: string[];
  whatsapp_autorizado: boolean;
  notificar_app: boolean;
  historico: SupportSuggestionHistoricoEntry[];
};

const parseStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => String(entry ?? '').trim())
    .filter((entry) => entry.length > 0);
};

const parseHistorico = (value: unknown): SupportSuggestionHistoricoEntry[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }

      const record = entry as Record<string, unknown>;

      return {
        data_hora: String(record.data_hora ?? ''),
        tipo: String(record.tipo ?? ''),
        canal: String(record.canal ?? ''),
        autor: String(record.autor ?? ''),
        papel: String(record.papel ?? ''),
        mensagem: String(record.mensagem ?? ''),
      };
    })
    .filter((entry): entry is SupportSuggestionHistoricoEntry => entry !== null);
};

export const parseSupportSuggestionReportRow = (
  row: MaintenanceReportRow
): SupportSuggestionReportRow => ({
  solicitante: String(row.solicitante ?? ''),
  telefone: String(row.telefone ?? ''),
  tipo: String(row.tipo ?? ''),
  tema: String(row.tema ?? ''),
  status: String(row.status ?? ''),
  abertura_em: String(row.abertura_em ?? ''),
  atualizado_em: String(row.atualizado_em ?? ''),
  respondido_em: row.respondido_em ? String(row.respondido_em) : null,
  descricao: String(row.descricao ?? ''),
  acao_desenvolvedor: row.acao_desenvolvedor ? String(row.acao_desenvolvedor) : null,
  orientacoes: row.orientacoes ? String(row.orientacoes) : null,
  previsao_conclusao: row.previsao_conclusao ? String(row.previsao_conclusao) : null,
  anexos: Number(row.anexos ?? 0) || 0,
  anexos_nomes: parseStringArray(row.anexos_nomes),
  whatsapp_autorizado: Boolean(row.whatsapp_autorizado),
  notificar_app: Boolean(row.notificar_app),
  historico: parseHistorico(row.historico),
});

export const formatSupportSuggestionHistoricoTitle = (entry: SupportSuggestionHistoricoEntry) => {
  if (entry.tipo === 'Comunicação') {
    return entry.canal;
  }

  if (entry.tipo === 'Abertura') {
    return 'Abertura';
  }

  if (entry.papel === 'Desenvolvedor') {
    return 'Desenvolvedor';
  }

  if (entry.papel === 'Sistema') {
    return 'Sistema';
  }

  return entry.tipo || 'Interação';
};

export const formatSupportSuggestionHistoricoMeta = (entry: SupportSuggestionHistoricoEntry) => {
  const parts = [entry.autor, entry.canal].map((part) => part.trim()).filter(Boolean);
  return parts.join(' · ');
};

export const formatSupportSuggestionDateTime = formatReportDateTime;

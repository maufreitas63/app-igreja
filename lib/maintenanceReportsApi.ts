import { resolveActorProfileId } from '@/lib/maintenanceAccessControlApi';
import { supabase } from '@/lib/supabase';
import { isSupabaseRpcMissingError } from '@/lib/supabaseRpc';

export const MAINTENANCE_REPORTS_SQL_HINT =
  'Execute no Supabase: scripts/maintenance-reports-access.sql e scripts/maintenance-reports-rpc.sql.';

export type MaintenanceReportRow = Record<string, unknown>;

export type MaintenanceReportResult = {
  success: boolean;
  reportCode: string;
  message?: string;
  generatedAt?: string;
  columns: string[];
  rows: MaintenanceReportRow[];
  summary?: Record<string, unknown>;
};

const parseReportResult = (data: unknown, reportCode: string): MaintenanceReportResult => {
  if (!data || typeof data !== 'object') {
    return {
      success: false,
      reportCode,
      message: 'Resposta inválida do servidor.',
      columns: [],
      rows: [],
    };
  }

  const record = data as Record<string, unknown>;
  const success = record.success === true;
  const columns = Array.isArray(record.columns)
    ? record.columns.map((value) => String(value))
    : [];
  const rows = Array.isArray(record.rows)
    ? (record.rows as MaintenanceReportRow[])
    : [];
  const summary =
    record.summary && typeof record.summary === 'object'
      ? (record.summary as Record<string, unknown>)
      : undefined;

  return {
    success,
    reportCode: String(record.report_code ?? reportCode),
    message: record.message ? String(record.message) : undefined,
    generatedAt: record.generated_at ? String(record.generated_at) : undefined,
    columns,
    rows,
    summary,
  };
};

export async function generateMaintenanceReport(
  reportCode: string,
  params: Record<string, string>
): Promise<MaintenanceReportResult> {
  const actorProfileId = await resolveActorProfileId();

  if (!actorProfileId) {
    throw new Error('Sessão inválida. Saia e entre novamente.');
  }

  const { data, error } = await supabase.rpc('gerar_relatorio_manutencao', {
    p_actor_profile_id: actorProfileId,
    p_report_code: reportCode,
    p_params: params,
  });

  if (error) {
    if (isSupabaseRpcMissingError(error, 'gerar_relatorio_manutencao')) {
      throw new Error(MAINTENANCE_REPORTS_SQL_HINT);
    }

    throw error;
  }

  return parseReportResult(data, reportCode);
}

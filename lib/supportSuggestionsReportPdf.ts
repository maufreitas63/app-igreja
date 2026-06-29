import type { MaintenanceReportResult } from '@/lib/maintenanceReportsApi';

export async function buildSupportSuggestionsReportPdfBlob(
  _result: MaintenanceReportResult
): Promise<Blob> {
  throw new Error('A geração de PDF está disponível apenas na versão web.');
}

export async function buildSupportSuggestionsReportPdfObjectUrl(
  _result: MaintenanceReportResult
): Promise<string> {
  throw new Error('A geração de PDF está disponível apenas na versão web.');
}

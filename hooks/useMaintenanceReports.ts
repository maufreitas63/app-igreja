import {
  generateMaintenanceReport,
  type MaintenanceReportResult,
} from '@/lib/maintenanceReportsApi';
import {
  buildDefaultReportParams,
  MAINTENANCE_REPORT_DEFINITIONS,
  type MaintenanceReportDefinition,
} from '@/lib/maintenanceReportsCatalog';
import { useCallback, useMemo, useState } from 'react';

export { MAINTENANCE_REPORT_DEFINITIONS };

export function useMaintenanceReports() {
  const [expandedCode, setExpandedCode] = useState<string | null>(null);
  const [paramsByCode, setParamsByCode] = useState<Record<string, Record<string, string>>>(() =>
    Object.fromEntries(
      MAINTENANCE_REPORT_DEFINITIONS.map((definition) => [
        definition.code,
        buildDefaultReportParams(definition),
      ])
    )
  );
  const [loadingCode, setLoadingCode] = useState<string | null>(null);
  const [resultsByCode, setResultsByCode] = useState<Record<string, MaintenanceReportResult>>({});
  const [errorsByCode, setErrorsByCode] = useState<Record<string, string>>({});

  const definitions = useMemo(() => MAINTENANCE_REPORT_DEFINITIONS, []);

  const toggleExpanded = useCallback((code: string) => {
    setExpandedCode((current) => (current === code ? null : code));
  }, []);

  const updateParam = useCallback((code: string, key: string, value: string) => {
    setParamsByCode((current) => ({
      ...current,
      [code]: {
        ...(current[code] ?? {}),
        [key]: value,
      },
    }));
  }, []);

  const resetParams = useCallback((definition: MaintenanceReportDefinition) => {
    setParamsByCode((current) => ({
      ...current,
      [definition.code]: buildDefaultReportParams(definition),
    }));
  }, []);

  const runReport = useCallback(async (definition: MaintenanceReportDefinition) => {
    setLoadingCode(definition.code);
    setErrorsByCode((current) => {
      const next = { ...current };
      delete next[definition.code];
      return next;
    });

    try {
      const params = paramsByCode[definition.code] ?? buildDefaultReportParams(definition);
      const result = await generateMaintenanceReport(definition.code, params);

      if (!result.success) {
        setErrorsByCode((current) => ({
          ...current,
          [definition.code]: result.message ?? 'Não foi possível gerar o relatório.',
        }));
        return result;
      }

      setResultsByCode((current) => ({
        ...current,
        [definition.code]: result,
      }));

      return result;
    } catch (runError) {
      const message =
        runError instanceof Error ? runError.message : 'Não foi possível gerar o relatório.';
      setErrorsByCode((current) => ({
        ...current,
        [definition.code]: message,
      }));
      return null;
    } finally {
      setLoadingCode(null);
    }
  }, [paramsByCode]);

  return {
    definitions,
    expandedCode,
    toggleExpanded,
    paramsByCode,
    updateParam,
    resetParams,
    loadingCode,
    resultsByCode,
    errorsByCode,
    runReport,
  };
}

import { sessionHasAccess } from '@/lib/accessControl';
import {
  attachMaintenanceFinancialReceipt,
  deleteMaintenanceFinancialEntriesForPeriod,
  fetchMaintenanceFinancialEntries,
  importMaintenanceFinancialBulk,
  MAINTENANCE_FINANCIALS_RPC_MISSING,
  MAINTENANCE_FINANCIALS_SQL_HINT,
  removeMaintenanceFinancialReceipt,
  toFinancialMonthReferenceDate,
  updateMaintenanceFinancialEntry,
  updateMaintenanceFinancialEntryComment,
} from '@/lib/maintenanceFinancialApi';
import type { FinancialEntryEditDraft } from '@/lib/maintenanceFinancialEntryForm';
import { parseFinancialBulkCsv } from '@/lib/maintenanceFinancialBulk';
import {
  filterPlannedFinancialEntries,
  filterRealizedFinancialEntries,
  isFinancialPlanejado,
  isFinancialRealizado,
  signedFinancialAmount,
  sortMaintenanceFinancialEntries,
  type FinancialEntry,
} from '@/lib/financialEntry';
import {
  buildFinancialMaintenanceYearOptions,
  formatFinancialMonthLabel,
  getPreviousCalendarMonth,
  type FinancialMonthKey,
} from '@/lib/financialMonth';
import {
  FINANCIAL_BUDGET_VERSION_PLANNED,
  FINANCIAL_BUDGET_VERSION_REALIZED,
} from '@/lib/financialEntry';
import { MAINTENANCE_FINANCIAL_BUDGET_VERSIONS } from '@/lib/maintenanceFinancialApi';
import { useMaintenanceRpcMissing } from '@/hooks/useMaintenanceRpcMissing';
import { useCallback, useEffect, useMemo, useState } from 'react';

export { MAINTENANCE_FINANCIALS_SQL_HINT };

const FINANCIAL_PERIOD_MODE = 'month' as const;

export function useMaintenanceFinancials(enabled: boolean) {
  const [selectedMonth, setSelectedMonth] = useState<FinancialMonthKey>(getPreviousCalendarMonth());
  const [entries, setEntries] = useState<FinancialEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [emptyingMonth, setEmptyingMonth] = useState(false);
  const [savingCommentEntryId, setSavingCommentEntryId] = useState<string | null>(null);
  const [savingEntryId, setSavingEntryId] = useState<string | null>(null);
  const [uploadingReceiptEntryId, setUploadingReceiptEntryId] = useState<string | null>(null);
  const [deletingReceiptEntryId, setDeletingReceiptEntryId] = useState<string | null>(null);
  const [canUpdateFinancials, setCanUpdateFinancials] = useState<boolean | null>(null);
  const [bulkBudgetVersion, setBulkBudgetVersion] = useState(FINANCIAL_BUDGET_VERSION_REALIZED);
  const [error, setError] = useState<string | null>(null);
  const { rpcMissing, beginMaintenanceRequest, resolveMaintenanceRpcError } = useMaintenanceRpcMissing();

  const referenceIsoDate = useMemo(
    () => toFinancialMonthReferenceDate(selectedMonth),
    [selectedMonth]
  );

  const periodLabel = useMemo(() => formatFinancialMonthLabel(selectedMonth), [selectedMonth]);

  const periodSummary = useMemo(() => {
    const realizedEntries = filterRealizedFinancialEntries(entries);
    const plannedEntries = entries.filter(
      (entry) => entry.budget_version === FINANCIAL_BUDGET_VERSION_PLANNED
    );
    const realizedTotal = realizedEntries.reduce(
      (sum, entry) => sum + signedFinancialAmount(entry),
      0
    );
    const plannedTotal = plannedEntries.reduce(
      (sum, entry) => sum + signedFinancialAmount(entry),
      0
    );

    return {
      realizedCount: realizedEntries.length,
      plannedCount: plannedEntries.length,
      realizedTotal,
      plannedTotal,
      count: realizedEntries.length,
      total: realizedTotal,
    };
  }, [entries]);

  const reload = useCallback(async () => {
    if (!enabled) {
      setEntries([]);
      return;
    }

    setLoading(true);
    setError(null);
    beginMaintenanceRequest();

    try {
      const rows = await fetchMaintenanceFinancialEntries(FINANCIAL_PERIOD_MODE, referenceIsoDate);
      setEntries(sortMaintenanceFinancialEntries(rows));
    } catch (err) {
      console.error('Erro ao listar lançamentos financeiros:', err);
      setEntries([]);

      const rpcHint = resolveMaintenanceRpcError(
        err,
        MAINTENANCE_FINANCIALS_RPC_MISSING,
        MAINTENANCE_FINANCIALS_SQL_HINT
      );

      if (rpcHint) {
        setError(rpcHint);
        return;
      }

      setError('Não foi possível carregar os lançamentos do mês.');
    } finally {
      setLoading(false);
    }
  }, [enabled, referenceIsoDate]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!enabled) {
      setCanUpdateFinancials(null);
      return;
    }

    void sessionHasAccess('table', 'financials', 'update').then(setCanUpdateFinancials);
  }, [enabled]);

  const parseBulkCsv = useCallback(
    (csvText: string) => parseFinancialBulkCsv(csvText, selectedMonth),
    [selectedMonth]
  );

  const versionEntryCount = useMemo(() => {
    const matchesVersion = (entry: FinancialEntry) => {
      if (bulkBudgetVersion === FINANCIAL_BUDGET_VERSION_REALIZED) {
        return isFinancialRealizado(entry.budget_version);
      }

      if (bulkBudgetVersion === FINANCIAL_BUDGET_VERSION_PLANNED) {
        return isFinancialPlanejado(entry.budget_version);
      }

      return entry.budget_version.trim().toUpperCase() === bulkBudgetVersion.trim().toUpperCase();
    };

    return entries.filter(matchesVersion).length;
  }, [bulkBudgetVersion, entries]);

  const importBulk = useCallback(
    async (csvText: string, replacePeriod: boolean) => {
      const parsed = parseFinancialBulkCsv(csvText, selectedMonth);

      if (!parsed.validRows.length) {
        const firstError = parsed.errors[0]?.message ?? 'Nenhuma linha válida no arquivo.';
        return {
          success: false as const,
          message: `Carga não enviada: ${firstError}`,
        };
      }

      setImporting(true);
      setError(null);

      try {
        const result = await importMaintenanceFinancialBulk(
          FINANCIAL_PERIOD_MODE,
          referenceIsoDate,
          parsed.validRows,
          replacePeriod,
          bulkBudgetVersion
        );

        if (!result.success) {
          return {
            success: false as const,
            message: result.message ?? 'Não foi possível importar a carga em lote.',
          };
        }

        await reload();

        const errorSuffix =
          parsed.errors.length > 0
            ? ` (${parsed.errors.length} linha(s) ignorada(s): data inválida ou fora do mês.)`
            : '';

        return {
          success: true as const,
          message: `${result.message ?? 'Carga importada.'}${errorSuffix}`,
        };
      } catch (err) {
        console.error('Erro na carga em lote financeira:', err);

        const rpcHint = resolveMaintenanceRpcError(
          err,
          MAINTENANCE_FINANCIALS_RPC_MISSING,
          MAINTENANCE_FINANCIALS_SQL_HINT
        );

        if (rpcHint) {
          return { success: false as const, message: rpcHint };
        }

        return { success: false as const, message: 'Não foi possível importar a carga em lote.' };
      } finally {
        setImporting(false);
      }
    },
    [bulkBudgetVersion, referenceIsoDate, reload, selectedMonth]
  );

  const emptyMonth = useCallback(async () => {
    setEmptyingMonth(true);
    setError(null);

    try {
      const result = await deleteMaintenanceFinancialEntriesForPeriod(
        FINANCIAL_PERIOD_MODE,
        referenceIsoDate,
        bulkBudgetVersion
      );

      if (!result.success) {
        return {
          success: false as const,
          message: result.message ?? 'Não foi possível esvaziar o mês.',
        };
      }

      await reload();
      return {
        success: true as const,
        message: result.message ?? 'Mês esvaziado.',
      };
    } catch (err) {
      console.error('Erro ao esvaziar mês financeiro:', err);

      const rpcHint = resolveMaintenanceRpcError(
        err,
        MAINTENANCE_FINANCIALS_RPC_MISSING,
        MAINTENANCE_FINANCIALS_SQL_HINT
      );

      if (rpcHint) {
        return { success: false as const, message: rpcHint };
      }

      return {
        success: false as const,
        message: 'Não foi possível esvaziar o mês.',
      };
    } finally {
      setEmptyingMonth(false);
    }
  }, [bulkBudgetVersion, referenceIsoDate, reload]);

  const saveEntryFields = useCallback(
    async (entryId: string, draft: FinancialEntryEditDraft) => {
      setSavingEntryId(entryId);
      setError(null);

      try {
        const result = await updateMaintenanceFinancialEntry(entryId, {
          transactionDateIso: draft.transactionDateIso,
          account: draft.account,
          amount: draft.amount,
          ministry: draft.ministry,
          transactionKind: draft.transactionKind,
          movement: draft.movement,
          budgetVersion: draft.budgetVersion,
        });

        if (!result.success) {
          return {
            success: false as const,
            message: result.message ?? 'Não foi possível atualizar o lançamento.',
          };
        }

        setEntries((current) =>
          sortMaintenanceFinancialEntries(
            current.map((entry) =>
              entry.id === entryId
                ? {
                    ...entry,
                    transaction_date: draft.transactionDateIso,
                    account: draft.account.trim(),
                    amount: draft.amount,
                    ministry: draft.ministry.trim(),
                    transaction_kind: draft.transactionKind,
                    movement: draft.movement,
                    budget_version: draft.budgetVersion,
                  }
                : entry
            )
          )
        );

        return {
          success: true as const,
          message: result.message ?? 'Lançamento atualizado.',
        };
      } catch (err) {
        console.error('Erro ao atualizar lançamento financeiro:', err);

        const rpcHint = resolveMaintenanceRpcError(
          err,
          MAINTENANCE_FINANCIALS_RPC_MISSING,
          MAINTENANCE_FINANCIALS_SQL_HINT
        );

        if (rpcHint) {
          return { success: false as const, message: rpcHint };
        }

        return { success: false as const, message: 'Não foi possível atualizar o lançamento.' };
      } finally {
        setSavingEntryId(null);
      }
    },
    [resolveMaintenanceRpcError]
  );

  const saveEntryComment = useCallback(
    async (entryId: string, comments: string | null) => {
      setSavingCommentEntryId(entryId);
      setError(null);

      try {
        const result = await updateMaintenanceFinancialEntryComment(entryId, comments);

        if (!result.success) {
          return {
            success: false as const,
            message: result.message ?? 'Não foi possível salvar o comentário.',
          };
        }

        const normalizedComments = comments?.trim() || null;

        setEntries((current) =>
          current.map((entry) =>
            entry.id === entryId ? { ...entry, comments: normalizedComments } : entry
          )
        );

        return {
          success: true as const,
          message:
            result.message ?? (normalizedComments ? 'Comentário salvo.' : 'Comentário removido.'),
        };
      } catch (err) {
        console.error('Erro ao salvar comentário financeiro:', err);

        const rpcHint = resolveMaintenanceRpcError(
          err,
          MAINTENANCE_FINANCIALS_RPC_MISSING,
          MAINTENANCE_FINANCIALS_SQL_HINT
        );

        if (rpcHint) {
          return { success: false as const, message: rpcHint };
        }

        return { success: false as const, message: 'Não foi possível salvar o comentário.' };
      } finally {
        setSavingCommentEntryId(null);
      }
    },
    [resolveMaintenanceRpcError]
  );

  const updateEntryReceiptUrl = useCallback((entryId: string, receiptUrl: string | null) => {
    setEntries((current) =>
      current.map((entry) =>
        entry.id === entryId ? { ...entry, receipt_url: receiptUrl } : entry
      )
    );
  }, []);

  const attachReceipt = useCallback(
    async (entryId: string, imageInput: string) => {
      const previousReceiptUrl =
        entries.find((entry) => entry.id === entryId)?.receipt_url ?? null;

      setUploadingReceiptEntryId(entryId);
      setError(null);

      try {
        const result = await attachMaintenanceFinancialReceipt(
          entryId,
          imageInput,
          previousReceiptUrl
        );

        if (!result.success) {
          return {
            success: false as const,
            message: result.message ?? 'Não foi possível anexar o comprovante.',
          };
        }

        const nextReceiptUrl = result.receipt_url ?? null;
        updateEntryReceiptUrl(entryId, nextReceiptUrl);

        return {
          success: true as const,
          message: result.message ?? 'Comprovante anexado.',
          receipt_url: nextReceiptUrl,
        };
      } catch (err) {
        console.error('Erro ao anexar comprovante financeiro:', err);

        const rpcHint = resolveMaintenanceRpcError(
          err,
          MAINTENANCE_FINANCIALS_RPC_MISSING,
          MAINTENANCE_FINANCIALS_SQL_HINT
        );

        if (rpcHint) {
          return { success: false as const, message: rpcHint };
        }

        return {
          success: false as const,
          message:
            err instanceof Error ? err.message : 'Não foi possível anexar o comprovante.',
        };
      } finally {
        setUploadingReceiptEntryId(null);
      }
    },
    [entries, resolveMaintenanceRpcError, updateEntryReceiptUrl]
  );

  const deleteReceipt = useCallback(
    async (entryId: string, receiptUrl: string | null | undefined) => {
      setDeletingReceiptEntryId(entryId);
      setError(null);

      try {
        const result = await removeMaintenanceFinancialReceipt(entryId, receiptUrl);

        if (!result.success) {
          return {
            success: false as const,
            message: result.message ?? 'Não foi possível remover o comprovante.',
          };
        }

        updateEntryReceiptUrl(entryId, null);

        return {
          success: true as const,
          message: result.message ?? 'Comprovante removido.',
        };
      } catch (err) {
        console.error('Erro ao remover comprovante financeiro:', err);

        const rpcHint = resolveMaintenanceRpcError(
          err,
          MAINTENANCE_FINANCIALS_RPC_MISSING,
          MAINTENANCE_FINANCIALS_SQL_HINT
        );

        if (rpcHint) {
          return { success: false as const, message: rpcHint };
        }

        return {
          success: false as const,
          message:
            err instanceof Error ? err.message : 'Não foi possível remover o comprovante.',
        };
      } finally {
        setDeletingReceiptEntryId(null);
      }
    },
    [resolveMaintenanceRpcError, updateEntryReceiptUrl]
  );

  const yearOptions = useMemo(
    () => buildFinancialMaintenanceYearOptions(undefined, { yearsForward: 0 }),
    []
  );

  return {
    selectedMonth,
    setSelectedMonth,
    yearOptions,
    bulkBudgetVersion,
    setBulkBudgetVersion,
    budgetVersionOptions: MAINTENANCE_FINANCIAL_BUDGET_VERSIONS,
    versionEntryCount,
    periodLabel,
    periodSummary,
    entries,
    loading,
    importing,
    emptyingMonth,
    savingCommentEntryId,
    savingEntryId,
    uploadingReceiptEntryId,
    deletingReceiptEntryId,
    canUpdateFinancials,
    error,
    rpcMissing,
    reload,
    parseBulkCsv,
    importBulk,
    emptyMonth,
    saveEntryComment,
    saveEntryFields,
    attachReceipt,
    deleteReceipt,
  };
}

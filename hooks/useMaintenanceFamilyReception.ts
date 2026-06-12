import {
  listPendingFamilyReceptionSubmissions,
  processFamilyReceptionBatch,
  rejectFamilyReceptionBatch,
  type FamilyReceptionSubmission,
} from '@/lib/familyReceptionApi';
import { useCallback, useEffect, useState } from 'react';

export function useMaintenanceFamilyReception(isActive: boolean) {
  const [submissions, setSubmissions] = useState<FamilyReceptionSubmission[]>([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [selectedSubmissionIds, setSelectedSubmissionIds] = useState<string[]>([]);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const rows = await listPendingFamilyReceptionSubmissions(50, { forceRefresh: true });
      setSubmissions(rows);
      setSelectedSubmissionIds((current) =>
        current.filter((id) => rows.some((row) => row.submissionId === id))
      );
    } catch (fetchError) {
      console.error('Erro ao carregar recepção familiar:', fetchError);
      setSubmissions([]);
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : 'Não foi possível carregar a fila de recepção.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    void refetch();
  }, [isActive, refetch]);

  const toggleSubmissionSelection = useCallback((submissionId: string) => {
    setSelectedSubmissionIds((current) =>
      current.includes(submissionId)
        ? current.filter((id) => id !== submissionId)
        : [...current, submissionId]
    );
  }, []);

  const selectAllSubmissions = useCallback(() => {
    setSelectedSubmissionIds(submissions.map((row) => row.submissionId));
  }, [submissions]);

  const clearSubmissionSelection = useCallback(() => {
    setSelectedSubmissionIds([]);
  }, []);

  const processSelected = useCallback(async () => {
    setProcessing(true);
    setError(null);
    setStatusMessage(null);

    try {
      const result = await processFamilyReceptionBatch(
        selectedSubmissionIds.length > 0 ? selectedSubmissionIds : undefined
      );

      const summary = [
        `${result.processedSubmissions} lote(s) processado(s).`,
        `${result.processedMembers} integrante(s) gravado(s) em profiles/members.`,
        result.skippedConflicts > 0
          ? `${result.skippedConflicts} lote(s) com conflito de família ignorado(s).`
          : null,
        ...result.messages,
      ]
        .filter(Boolean)
        .join(' ');

      setStatusMessage(summary);
      setSelectedSubmissionIds([]);
      await refetch();
      return { success: true as const, message: summary };
    } catch (processError) {
      const message =
        processError instanceof Error
          ? processError.message
          : 'Não foi possível processar a recepção.';
      setError(message);
      return { success: false as const, message };
    } finally {
      setProcessing(false);
    }
  }, [refetch, selectedSubmissionIds]);

  const rejectSelected = useCallback(async () => {
    if (selectedSubmissionIds.length === 0) {
      return { success: false as const, message: 'Selecione ao menos um lote.' };
    }

    setProcessing(true);
    setError(null);
    setStatusMessage(null);

    try {
      const result = await rejectFamilyReceptionBatch(selectedSubmissionIds);
      const message = `${result.rejectedMembers} registro(s) rejeitado(s).`;
      setStatusMessage(message);
      setSelectedSubmissionIds([]);
      await refetch();
      return { success: true as const, message };
    } catch (rejectError) {
      const message =
        rejectError instanceof Error
          ? rejectError.message
          : 'Não foi possível rejeitar o lote.';
      setError(message);
      return { success: false as const, message };
    } finally {
      setProcessing(false);
    }
  }, [refetch, selectedSubmissionIds]);

  return {
    submissions,
    loading,
    processing,
    error,
    statusMessage,
    selectedSubmissionIds,
    refetch,
    toggleSubmissionSelection,
    selectAllSubmissions,
    clearSubmissionSelection,
    processSelected,
    rejectSelected,
  };
}

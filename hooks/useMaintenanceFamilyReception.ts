import {
  inspectFamilyReceptionLote,
  listPendingFamilyReceptionSubmissions,
  processFamilyReceptionBatch,
  rejectFamilyReceptionBatch,
  rejectFamilyReceptionMember,
  updateRecepcionPendingBirthDate,
  updateRecepcionPendingCep,
  type FamilyReceptionLoteInspect,
  type FamilyReceptionSubmission,
} from '@/lib/familyReceptionApi';
import { useCallback, useEffect, useState } from 'react';

export function useMaintenanceFamilyReception(isActive: boolean) {
  const [submissions, setSubmissions] = useState<FamilyReceptionSubmission[]>([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [expandedSubmissionId, setExpandedSubmissionId] = useState<string | null>(null);
  const [inspectBySubmissionId, setInspectBySubmissionId] = useState<
    Record<string, FamilyReceptionLoteInspect>
  >({});
  const [inspectLoadingId, setInspectLoadingId] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const rows = await listPendingFamilyReceptionSubmissions(50, { forceRefresh: true });
      setSubmissions(rows);
      setExpandedSubmissionId((current) =>
        current && rows.some((row) => row.submissionId === current) ? current : null
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

  const loadInspect = useCallback(async (submissionId: string) => {
    setInspectLoadingId(submissionId);
    try {
      const inspect = await inspectFamilyReceptionLote(submissionId);
      setInspectBySubmissionId((current) => ({ ...current, [submissionId]: inspect }));
      return inspect;
    } catch (inspectError) {
      const message =
        inspectError instanceof Error
          ? inspectError.message
          : 'Não foi possível analisar a família deste lote.';
      setError(message);
      return null;
    } finally {
      setInspectLoadingId((current) => (current === submissionId ? null : current));
    }
  }, []);

  const toggleExpanded = useCallback(
    (submissionId: string) => {
      setExpandedSubmissionId((current) => {
        const next = current === submissionId ? null : submissionId;
        if (next) {
          void loadInspect(next);
        }
        return next;
      });
    },
    [loadInspect]
  );

  const processSubmission = useCallback(
    async (submissionId: string) => {
      setProcessing(true);
      setError(null);
      setStatusMessage(null);

      try {
        const result = await processFamilyReceptionBatch([submissionId]);
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
        setExpandedSubmissionId(null);
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
    },
    [refetch]
  );

  const rejectSubmission = useCallback(
    async (submissionId: string) => {
      setProcessing(true);
      setError(null);
      setStatusMessage(null);

      try {
        const result = await rejectFamilyReceptionBatch([submissionId]);
        const message = `${result.rejectedMembers} registro(s) rejeitado(s).`;
        setStatusMessage(message);
        setExpandedSubmissionId(null);
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
    },
    [refetch]
  );

  const discardMember = useCallback(
    async (memberId: string, submissionId: string) => {
      setProcessing(true);
      setError(null);
      try {
        const result = await rejectFamilyReceptionMember(
          memberId,
          'Integrante identificado já consta no cadastro — descartado na triagem.'
        );
        setStatusMessage(result.message);
        if (!result.loteRejected) {
          await loadInspect(submissionId);
        }
        await refetch();
        return { success: true as const, message: result.message };
      } catch (discardError) {
        const message =
          discardError instanceof Error
            ? discardError.message
            : 'Não foi possível descartar o integrante.';
        setError(message);
        return { success: false as const, message };
      } finally {
        setProcessing(false);
      }
    },
    [loadInspect, refetch]
  );

  const updatePendingBirthDate = useCallback(
    async (memberId: string, birthDateIso: string) => {
      setError(null);
      try {
        const result = await updateRecepcionPendingBirthDate(memberId, birthDateIso);
        if (expandedSubmissionId) {
          await loadInspect(expandedSubmissionId);
        }
        await refetch();
        return { success: true as const, message: result.message };
      } catch (updateError) {
        const message =
          updateError instanceof Error
            ? updateError.message
            : 'Não foi possível atualizar a data de nascimento.';
        setError(message);
        return { success: false as const, message };
      }
    },
    [expandedSubmissionId, loadInspect, refetch]
  );

  const updatePendingCep = useCallback(
    async (memberId: string, cep: string) => {
      setError(null);
      try {
        const result = await updateRecepcionPendingCep(memberId, cep);
        if (expandedSubmissionId) {
          await loadInspect(expandedSubmissionId);
        }
        await refetch();
        return { success: true as const, message: result.message };
      } catch (updateError) {
        const message =
          updateError instanceof Error
            ? updateError.message
            : 'Não foi possível atualizar o CEP.';
        setError(message);
        return { success: false as const, message };
      }
    },
    [expandedSubmissionId, loadInspect, refetch]
  );

  return {
    submissions,
    loading,
    processing,
    error,
    statusMessage,
    expandedSubmissionId,
    inspectBySubmissionId,
    inspectLoadingId,
    refetch,
    toggleExpanded,
    processSubmission,
    rejectSubmission,
    discardMember,
    updatePendingBirthDate,
    updatePendingCep,
  };
}

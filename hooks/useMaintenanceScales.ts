import { applyCicloCompleto, fetchScaleCycleContext } from '@/lib/maintenanceScaleCycleApi';
import { gerarCicloCompleto, type ScaleCyclePreviewEntry } from '@/lib/maintenanceScaleCycle';
import {
  fetchMaintenanceScaleLogs,
  fetchMaintenanceScaleTypes,
  fetchMaintenanceScaleVolunteers,
  MAINTENANCE_SCALES_RPC_MISSING,
  deleteMaintenanceScale,
  registerMaintenanceScaleManual,
} from '@/lib/maintenanceScalesApi';
import {
  isUpcomingScaleServiceDate,
  type MaintenanceScaleLogEntry,
  type MaintenanceScaleType,
  type MaintenanceScaleVolunteer,
} from '@/lib/maintenanceScales';
import { useMaintenanceRpcMissing } from '@/hooks/useMaintenanceRpcMissing';
import { useCallback, useEffect, useMemo, useState } from 'react';

export function useMaintenanceScales(enabled: boolean) {
  const [scaleTypes, setScaleTypes] = useState<MaintenanceScaleType[]>([]);
  const [allLogs, setAllLogs] = useState<MaintenanceScaleLogEntry[]>([]);
  const [volunteers, setVolunteers] = useState<MaintenanceScaleVolunteer[]>([]);
  const [selectedScaleTypeId, setSelectedScaleTypeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingVolunteers, setLoadingVolunteers] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removingScaleId, setRemovingScaleId] = useState<string | null>(null);
  const [buildingBatch, setBuildingBatch] = useState(false);
  const [batchPreview, setBatchPreview] = useState<ScaleCyclePreviewEntry[] | null>(null);
  const [batchPreviewMessage, setBatchPreviewMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { rpcMissing, beginMaintenanceRequest, resolveMaintenanceRpcError } = useMaintenanceRpcMissing();

  const reload = useCallback(async () => {
    if (!enabled) {
      return;
    }

    setLoading(true);
    setError(null);
    beginMaintenanceRequest();

    try {
      const [types, logs] = await Promise.all([
        fetchMaintenanceScaleTypes(),
        fetchMaintenanceScaleLogs(),
      ]);

      const permittedTypeIds = new Set(types.map((type) => type.id));

      setScaleTypes(types);
      setAllLogs(logs.filter((log) => permittedTypeIds.has(log.scaleTypeId)));

      setSelectedScaleTypeId((current) => {
        if (current && types.some((type) => type.id === current)) {
          return current;
        }

        return types[0]?.id ?? null;
      });
    } catch (err) {
      console.error('Erro ao carregar escalas (manutenção):', err);
      setScaleTypes([]);
      setAllLogs([]);
      setSelectedScaleTypeId(null);
      setError('Não foi possível carregar os tipos de escala.');
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  const reloadVolunteers = useCallback(async (scaleTypeId: string | null) => {
    if (!enabled || !scaleTypeId) {
      setVolunteers([]);
      return;
    }

    setLoadingVolunteers(true);
    setError(null);
    beginMaintenanceRequest();

    try {
      const rows = await fetchMaintenanceScaleVolunteers(scaleTypeId);
      setVolunteers(rows);
    } catch (err) {
      console.error('Erro ao carregar voluntários da escala:', err);
      setVolunteers([]);

      const rpcHint = resolveMaintenanceRpcError(
        err,
        MAINTENANCE_SCALES_RPC_MISSING,
        'Execute scripts/escalas-maintenance-rpc.sql no Supabase.'
      );

      if (rpcHint) {
        setError('Funções de manutenção de escalas não encontradas no Supabase.');
        return;
      }

      setError('Não foi possível carregar os servos deste tipo de escala.');
    } finally {
      setLoadingVolunteers(false);
    }
  }, [enabled]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    void reloadVolunteers(selectedScaleTypeId);
    setBatchPreview(null);
    setBatchPreviewMessage(null);
  }, [reloadVolunteers, selectedScaleTypeId]);

  const historyForSelectedType = useMemo(() => {
    if (!selectedScaleTypeId) {
      return [];
    }

    return allLogs
      .filter(
        (entry) =>
          entry.scaleTypeId === selectedScaleTypeId && isUpcomingScaleServiceDate(entry.serviceDate)
      )
      .sort((left, right) => left.serviceDate.localeCompare(right.serviceDate));
  }, [allLogs, selectedScaleTypeId]);

  const activeVolunteers = useMemo(
    () => volunteers.filter((volunteer) => volunteer.isActive),
    [volunteers]
  );

  const registerScale = useCallback(
    async (volunteerId: string, serviceDate: string) => {
      if (!selectedScaleTypeId) {
        return { success: false as const, message: 'Selecione um tipo de escala.' };
      }

      setSaving(true);
      setError(null);

      try {
        const result = await registerMaintenanceScaleManual(
          selectedScaleTypeId,
          volunteerId,
          serviceDate
        );

        if (!result.success) {
          return {
            success: false as const,
            message: result.message ?? 'Não foi possível registrar a escala.',
          };
        }

        await reload();
        await reloadVolunteers(selectedScaleTypeId);

        return { success: true as const, message: result.message ?? 'Escala registrada.' };
      } catch (err) {
        console.error('Erro ao registrar escala:', err);

        const rpcHint = resolveMaintenanceRpcError(
          err,
          MAINTENANCE_SCALES_RPC_MISSING,
          'Execute scripts/escalas-maintenance-rpc.sql no Supabase.'
        );

        if (rpcHint) {
          return {
            success: false as const,
            message: rpcHint,
          };
        }

        const message =
          err instanceof Error ? err.message : 'Não foi possível registrar a escala.';

        return { success: false as const, message };
      } finally {
        setSaving(false);
      }
    },
    [reload, reloadVolunteers, selectedScaleTypeId]
  );

  const prepareBatchPreview = useCallback(async () => {
    if (!enabled) {
      return { success: false as const, message: 'Abra o card Escalas para gerar a escala em bloco.' };
    }

    if (!selectedScaleTypeId) {
      return { success: false as const, message: 'Selecione um tipo de escala.' };
    }

    setBuildingBatch(true);
    setError(null);
    setBatchPreview(null);
    setBatchPreviewMessage('Montando prévia…');

    try {
      const [volunteerRows, logs, cycleContext] = await Promise.all([
        Promise.resolve(volunteers),
        allLogs.length > 0 ? Promise.resolve(allLogs) : fetchMaintenanceScaleLogs(),
        fetchScaleCycleContext(selectedScaleTypeId),
      ]);

      if (allLogs.length === 0) {
        setAllLogs(logs);
      }
      beginMaintenanceRequest();

      const activeRows = volunteerRows.filter((volunteer) => volunteer.isActive);

      if (!activeRows.length) {
        const message = 'Nenhum servo ativo para este tipo de escala.';
        setBatchPreview(null);
        setBatchPreviewMessage(message);
        setError(message);
        return { success: false as const, message };
      }

      const preview = gerarCicloCompleto({
        scaleTypeId: selectedScaleTypeId,
        volunteers: volunteerRows,
        maxServiceDate: cycleContext.maxServiceDate,
        scheduledDates: cycleContext.scheduledDates,
        occupancyByDate: cycleContext.occupancyByDate,
        vagasPorServico: cycleContext.vagasPorServico,
        modoCiclo: cycleContext.modoCiclo,
      });

      if (!preview.success) {
        setBatchPreview(null);
        setBatchPreviewMessage(preview.message);
        setError(preview.message);
        return { success: false as const, message: preview.message };
      }

      setBatchPreview(preview.entries);
      setBatchPreviewMessage(preview.message);
      setError(null);

      return { success: true as const, message: preview.message, entries: preview.entries };
    } catch (err) {
      console.error('Erro ao gerar prévia em bloco:', err);

      const rpcHint = resolveMaintenanceRpcError(
        err,
        MAINTENANCE_SCALES_RPC_MISSING,
        'Execute scripts/escalas-maintenance-rpc.sql no Supabase.'
      );

      if (rpcHint) {
      }

      const message =
        err instanceof Error ? err.message : 'Não foi possível gerar a escala em bloco.';

      setBatchPreview(null);
      setBatchPreviewMessage(message);
      setError(message);

      return { success: false as const, message };
    } finally {
      setBuildingBatch(false);
    }
  }, [allLogs, enabled, selectedScaleTypeId, volunteers]);

  const cancelBatchPreview = useCallback(() => {
    setBatchPreview(null);
    setBatchPreviewMessage(null);
  }, []);

  const removeScale = useCallback(
    async (scaleLogId: string) => {
      if (!selectedScaleTypeId) {
        return { success: false as const, message: 'Selecione um tipo de escala.' };
      }

      setRemovingScaleId(scaleLogId);
      setError(null);

      try {
        const result = await deleteMaintenanceScale(scaleLogId);

        if (!result.success) {
          return {
            success: false as const,
            message: result.message ?? 'Não foi possível excluir a escala.',
          };
        }

        await reload();
        await reloadVolunteers(selectedScaleTypeId);

        return { success: true as const, message: result.message ?? 'Escala removida.' };
      } catch (err) {
        console.error('Erro ao excluir escala:', err);

        const rpcHint = resolveMaintenanceRpcError(
          err,
          MAINTENANCE_SCALES_RPC_MISSING,
          'Execute scripts/escalas-maintenance-rpc.sql no Supabase.'
        );

        if (rpcHint) {
          return {
            success: false as const,
            message: rpcHint,
          };
        }

        const message =
          err instanceof Error ? err.message : 'Não foi possível excluir a escala.';

        return { success: false as const, message };
      } finally {
        setRemovingScaleId(null);
      }
    },
    [reload, reloadVolunteers, selectedScaleTypeId]
  );

  const confirmBatchPreview = useCallback(async () => {
    if (!selectedScaleTypeId || !batchPreview?.length) {
      return { success: false as const, message: 'Nenhuma prévia para gravar.' };
    }

    setSaving(true);
    setError(null);

    try {
      const [volunteerRows, cycleContext] = await Promise.all([
        fetchMaintenanceScaleVolunteers(selectedScaleTypeId),
        fetchScaleCycleContext(selectedScaleTypeId),
      ]);

      const refreshedPreview = gerarCicloCompleto({
        scaleTypeId: selectedScaleTypeId,
        volunteers: volunteerRows,
        maxServiceDate: cycleContext.maxServiceDate,
        scheduledDates: cycleContext.scheduledDates,
        occupancyByDate: cycleContext.occupancyByDate,
        vagasPorServico: cycleContext.vagasPorServico,
        modoCiclo: cycleContext.modoCiclo,
      });

      if (!refreshedPreview.success) {
        setBatchPreview(null);
        setBatchPreviewMessage(refreshedPreview.message);
        setError(refreshedPreview.message);
        return { success: false as const, message: refreshedPreview.message };
      }

      if (!refreshedPreview.entries.length) {
        const message = 'Nenhuma escala para gravar após revalidar o calendário.';
        setError(message);
        return { success: false as const, message };
      }

      setBatchPreview(refreshedPreview.entries);
      setBatchPreviewMessage(refreshedPreview.message);

      const result = await applyCicloCompleto(selectedScaleTypeId, refreshedPreview.entries);

      if (!result.success) {
        return result;
      }

      setBatchPreview(null);
      setBatchPreviewMessage(null);
      await reload();
      await reloadVolunteers(selectedScaleTypeId);

      return result;
    } catch (err) {
      console.error('Erro ao gravar escala em bloco:', err);

      const rpcHint = resolveMaintenanceRpcError(
        err,
        MAINTENANCE_SCALES_RPC_MISSING,
        'Execute scripts/escalas-maintenance-rpc.sql no Supabase.'
      );

      if (rpcHint) {
        return {
          success: false as const,
          message: 'Execute scripts/escalas-apply-cycle-batch.sql no Supabase.',
        };
      }

      const message =
        err instanceof Error ? err.message : 'Não foi possível gravar a escala em bloco.';

      return { success: false as const, message };
    } finally {
      setSaving(false);
    }
  }, [batchPreview, reload, reloadVolunteers, selectedScaleTypeId]);

  return {
    scaleTypes,
    selectedScaleTypeId,
    setSelectedScaleTypeId,
    historyForSelectedType,
    activeVolunteers,
    loading,
    loadingVolunteers,
    saving,
    removingScaleId,
    buildingBatch,
    batchPreview,
    batchPreviewMessage,
    error,
    rpcMissing,
    reload,
    registerScale,
    removeScale,
    prepareBatchPreview,
    cancelBatchPreview,
    confirmBatchPreview,
  };
}

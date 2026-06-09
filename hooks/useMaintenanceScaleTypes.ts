import {
  createMaintenanceScaleType,
  deleteMaintenanceScaleType,
  listMaintenanceScaleTypes,
  MAINTENANCE_SCALE_TYPES_RPC_MISSING,
  MAINTENANCE_SCALE_TYPES_SQL_HINT,
  normalizeScaleTypeCode,
  updateMaintenanceScaleType,
  type MaintenanceScaleTypeRecord,
} from '@/lib/maintenanceScaleTypesApi';
import { useMaintenanceRpcMissing } from '@/hooks/useMaintenanceRpcMissing';
import { useCallback, useEffect, useState } from 'react';

export { MAINTENANCE_SCALE_TYPES_SQL_HINT };

export function useMaintenanceScaleTypes(enabled: boolean) {
  const [scaleTypes, setScaleTypes] = useState<MaintenanceScaleTypeRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { rpcMissing, beginMaintenanceRequest, resolveMaintenanceRpcError } = useMaintenanceRpcMissing();

  const reload = useCallback(async () => {
    if (!enabled) {
      setScaleTypes([]);
      return;
    }

    setLoading(true);
    setError(null);
    beginMaintenanceRequest();

    try {
      const rows = await listMaintenanceScaleTypes();
      setScaleTypes(rows);
    } catch (err) {
      console.error('Erro ao listar tipos de escala:', err);
      setScaleTypes([]);

      const rpcHint = resolveMaintenanceRpcError(
        err,
        MAINTENANCE_SCALE_TYPES_RPC_MISSING,
        MAINTENANCE_SCALE_TYPES_SQL_HINT
      );

      if (rpcHint) {
        setError(rpcHint);
        return;
      }

      setError('Não foi possível carregar os tipos de escala.');
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const startEdit = useCallback((row: MaintenanceScaleTypeRecord) => {
    setEditingId(row.id);
    setError(null);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
  }, []);

  const saveScaleType = useCallback(
    async (
      codeInput: string,
      nameInput: string,
      vagasPorServico = 1,
      modoCiclo: 'individual' | 'equipe' = 'individual'
    ) => {
      const code = normalizeScaleTypeCode(codeInput);
      const name = nameInput.trim();
      const vagas = Math.max(1, Math.min(vagasPorServico, 50));
      const modo = modoCiclo === 'equipe' ? 'equipe' : 'individual';

      if (!code) {
        return { success: false as const, message: 'Informe o código da escala.' };
      }

      if (!name) {
        return { success: false as const, message: 'Informe o nome da escala.' };
      }

      setSaving(true);
      setError(null);

      try {
        const editingRow = editingId
          ? scaleTypes.find((row) => row.id === editingId)
          : null;

        const result = editingId
          ? await updateMaintenanceScaleType(
              editingId,
              code,
              name,
              editingRow?.isActive ?? true,
              vagas,
              modo
            )
          : await createMaintenanceScaleType(code, name, vagas, modo);

        if (!result.success) {
          setError(result.message ?? 'Não foi possível salvar o tipo de escala.');
          return result;
        }

        setEditingId(null);
        await reload();
        beginMaintenanceRequest();

        return result;
      } catch (err) {
        console.error('Erro ao salvar tipo de escala:', err);

        const rpcHint = resolveMaintenanceRpcError(
          err,
          MAINTENANCE_SCALE_TYPES_RPC_MISSING,
          MAINTENANCE_SCALE_TYPES_SQL_HINT
        );

        if (rpcHint) {
          setError(rpcHint);
          return { success: false as const, message: rpcHint };
        }

        const message =
          err instanceof Error ? err.message : 'Não foi possível salvar o tipo de escala.';

        setError(message);
        return { success: false as const, message };
      } finally {
        setSaving(false);
      }
    },
    [editingId, reload, scaleTypes]
  );

  const removeScaleType = useCallback(
    async (id: string) => {
      setDeletingId(id);
      setError(null);

      try {
        const result = await deleteMaintenanceScaleType(id);

        if (!result.success) {
          setError(result.message ?? 'Não foi possível excluir o tipo de escala.');
          return result;
        }

        if (editingId === id) {
          setEditingId(null);
        }

        await reload();
        beginMaintenanceRequest();

        return result;
      } catch (err) {
        console.error('Erro ao excluir tipo de escala:', err);

        const rpcHint = resolveMaintenanceRpcError(
          err,
          MAINTENANCE_SCALE_TYPES_RPC_MISSING,
          MAINTENANCE_SCALE_TYPES_SQL_HINT
        );

        if (rpcHint) {
          setError(rpcHint);
          return { success: false as const, message: rpcHint };
        }

        const message =
          err instanceof Error ? err.message : 'Não foi possível excluir o tipo de escala.';

        setError(message);
        return { success: false as const, message };
      } finally {
        setDeletingId(null);
      }
    },
    [editingId, reload]
  );

  const editingRow = editingId ? scaleTypes.find((row) => row.id === editingId) ?? null : null;

  return {
    scaleTypes,
    loading,
    saving,
    deletingId,
    editingId,
    editingRow,
    error,
    rpcMissing,
    reload,
    startEdit,
    cancelEdit,
    saveScaleType,
    removeScaleType,
    normalizeScaleTypeCode,
  };
}

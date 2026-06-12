import {
  fetchMaintenancePastoralRequestsForProfile,
  fetchPastoralSubmitterOptions,
  fetchPastoralSubmitterProfile,
  MAINTENANCE_PASTORAL_RPC_MISSING,
  updatePastoralRequestFollowUpStage,
  type MaintenancePastoralRequestView,
  type PastoralSubmitterOption,
} from '@/lib/maintenancePastoralApi';
import {
  canUpdatePastoralRequestForSession,
  canViewPastoralRequestForSession,
  loadPastoralCareAccessContext,
  type PastoralCareAccessContext,
} from '@/lib/pastoralAccess';
import {
  canAdvanceToPastoralFollowUpStage,
  formatPastoralRequestDateTimeLabel,
  getPastoralFollowUpStageBlockedMessage,
  isPastoralFollowUpStageDone,
  normalizePastoralFollowUpStage,
  PASTORAL_FOLLOW_UP_STAGES,
  type PastoralFollowUpStage,
} from '@/lib/pastoralRequest';
import { useMaintenanceRpcMissing } from '@/hooks/useMaintenanceRpcMissing';
import { useCallback, useEffect, useMemo, useState } from 'react';

export const MAINTENANCE_PASTORAL_CARE_SQL_HINT =
  'Execute no Supabase: scripts/pastoral-requests-fields.sql, scripts/access-control-pastoral-intercessao.sql, scripts/pastoral-maintenance-rpc.sql e scripts/pastoral-request-handler.sql.';

const EMPTY_PROFILE_VALUE = '';

export function useMaintenancePastoralCare(enabled: boolean) {
  const [submitterOptions, setSubmitterOptions] = useState<PastoralSubmitterOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [requests, setRequests] = useState<MaintenancePastoralRequestView[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [isSavingFollowUpStage, setIsSavingFollowUpStage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessContext, setAccessContext] = useState<PastoralCareAccessContext>({
    profileId: null,
    operatorFullName: null,
    hasFullPastoralAccess: false,
    isIntercessionVolunteer: false,
  });
  const { rpcMissing, beginMaintenanceRequest, resolveMaintenanceRpcError } = useMaintenanceRpcMissing();

  const selectedSubmitter = useMemo(
    () => submitterOptions.find((row) => row.profileId === selectedProfileId) ?? null,
    [selectedProfileId, submitterOptions]
  );

  const selectedRequest = requests.find((row) => row.id === selectedRequestId) ?? requests[0] ?? null;

  const reloadSubmitters = useCallback(async () => {
    if (!enabled) {
      setSubmitterOptions([]);
      return;
    }

    setLoadingOptions(true);
    setError(null);
    beginMaintenanceRequest();

    try {
      const options = await fetchPastoralSubmitterOptions();
      setSubmitterOptions(options);
    } catch (err) {
      console.error('Erro ao listar solicitantes pastorais:', err);
      setSubmitterOptions([]);

      const rpcHint = resolveMaintenanceRpcError(
        err,
        MAINTENANCE_PASTORAL_RPC_MISSING,
        MAINTENANCE_PASTORAL_CARE_SQL_HINT
      );

      if (rpcHint) {
        setError(rpcHint);
        return;
      }

      setError('Não foi possível carregar quem enviou pedidos pastorais.');
    } finally {
      setLoadingOptions(false);
    }
  }, [enabled]);

  const loadRequestsForProfile = useCallback(async (profileId: string) => {
    setLoadingRequests(true);
    setError(null);

    try {
      const option = submitterOptions.find((row) => row.profileId === profileId);
      const profile =
        (await fetchPastoralSubmitterProfile(profileId)) ??
        (option
          ? {
              profileId: option.profileId,
              fullName: option.fullName,
              shortName: option.shortName,
              phone: option.phone,
            }
          : null);

      if (!profile) {
        setRequests([]);
        setSelectedRequestId(null);
        setError('Perfil não encontrado.');
        return;
      }

      const rows = await fetchMaintenancePastoralRequestsForProfile(
        profileId,
        profile.fullName,
        profile.phone,
        accessContext
      );

      setRequests(rows);
      setSelectedRequestId((current) => {
        if (current && rows.some((row) => row.id === current)) {
          return current;
        }

        return rows[0]?.id ?? null;
      });
      beginMaintenanceRequest();
    } catch (err) {
      console.error('Erro ao carregar pedidos pastorais:', err);
      setRequests([]);
      setSelectedRequestId(null);
      setError('Não foi possível carregar os pedidos deste usuário.');
    } finally {
      setLoadingRequests(false);
    }
  }, [accessContext, submitterOptions]);

  const refreshRequestsForSelectedProfile = useCallback(async () => {
    if (!selectedProfileId || !selectedSubmitter) {
      return;
    }

    try {
      const rows = await fetchMaintenancePastoralRequestsForProfile(
        selectedProfileId,
        selectedSubmitter.fullName,
        selectedSubmitter.phone,
        accessContext
      );

      setRequests((current) => {
        const previousById = new Map(current.map((row) => [row.id, row]));

        return rows.map((row) => {
          const previous = previousById.get(row.id);

          if (!previous) {
            return row;
          }

          const careStarted = Boolean(row.followUpStage);
          const shouldPreserveHandler =
            careStarted
            && !row.handler_name?.trim()
            && Boolean(previous.handler_name?.trim() || previous.handler_profile_id);

          if (!shouldPreserveHandler) {
            return row;
          }

          return {
            ...row,
            handler_profile_id: row.handler_profile_id ?? previous.handler_profile_id ?? null,
            handler_name: row.handler_name ?? previous.handler_name ?? null,
          };
        });
      });
      setSelectedRequestId((current) => {
        if (current && rows.some((row) => row.id === current)) {
          return current;
        }

        return rows[0]?.id ?? null;
      });
    } catch (err) {
      console.error('Erro ao atualizar lista de pedidos pastorais:', err);
    }
  }, [accessContext, selectedProfileId, selectedSubmitter]);

  const reloadAccessContext = useCallback(async () => {
    if (!enabled) {
      setAccessContext({
        profileId: null,
        operatorFullName: null,
        hasFullPastoralAccess: false,
        isIntercessionVolunteer: false,
      });
      return;
    }

    try {
      const context = await loadPastoralCareAccessContext();
      setAccessContext(context);
    } catch (err) {
      console.error('Erro ao carregar permissões do Cuidado Pastoral:', err);
      setAccessContext({
        profileId: null,
        operatorFullName: null,
        hasFullPastoralAccess: false,
        isIntercessionVolunteer: false,
      });
    }
  }, [enabled]);

  const setFollowUpStage = useCallback(
    async (requestId: string, stage: PastoralFollowUpStage) => {
      const request = requests.find((row) => row.id === requestId);
      const currentStage =
        normalizePastoralFollowUpStage(request?.status) ?? request?.followUpStage ?? null;

      if (!canAdvanceToPastoralFollowUpStage(currentStage, stage)) {
        const message = getPastoralFollowUpStageBlockedMessage(currentStage, stage);

        if (message) {
          setError(message);
        }

        return { success: false as const, message: message ?? undefined };
      }

      setIsSavingFollowUpStage(true);
      setError(null);

      try {
        const result = await updatePastoralRequestFollowUpStage(
          requestId,
          stage,
          currentStage
        );

        if (!result.success) {
          setError(result.message ?? 'Não foi possível atualizar o estágio.');
          return result;
        }

        const nextStatus = result.status ?? stage;
        const nextUpdatedAt = result.updatedAt ?? new Date().toISOString();
        const nextHandlerProfileId =
          result.handlerProfileId
          ?? (stage === 'Acolher' ? accessContext.profileId : null)
          ?? null;
        const nextHandlerName =
          result.handlerName
          ?? (stage === 'Acolher' ? accessContext.operatorFullName : null)
          ?? null;

        setRequests((current) =>
          current.map((row) =>
            row.id === requestId
              ? {
                  ...row,
                  status: nextStatus,
                  followUpStage: normalizePastoralFollowUpStage(nextStatus) ?? stage,
                  updated_at: nextUpdatedAt,
                  handler_profile_id: nextHandlerProfileId ?? row.handler_profile_id ?? null,
                  handler_name: nextHandlerName ?? row.handler_name ?? null,
                }
              : row
          )
        );
        await refreshRequestsForSelectedProfile();

        return result;
      } catch (err) {
        console.error('Erro ao atualizar estágio pastoral:', err);

        const rpcHint = resolveMaintenanceRpcError(
          err,
          MAINTENANCE_PASTORAL_RPC_MISSING,
          MAINTENANCE_PASTORAL_CARE_SQL_HINT
        );

        if (rpcHint) {
          setError(rpcHint);
          return { success: false as const, message: rpcHint };
        }

        const message =
          err instanceof Error ? err.message : 'Não foi possível atualizar o estágio.';

        setError(message);
        return { success: false as const, message };
      } finally {
        setIsSavingFollowUpStage(false);
      }
    },
    [accessContext.operatorFullName, accessContext.profileId, refreshRequestsForSelectedProfile, requests]
  );

  const selectProfileId = useCallback(
    async (profileId: string | null) => {
      if (!profileId) {
        setSelectedProfileId(null);
        setRequests([]);
        setSelectedRequestId(null);
        return;
      }

      setSelectedProfileId(profileId);
      await loadRequestsForProfile(profileId);
    },
    [loadRequestsForProfile]
  );

  useEffect(() => {
    void reloadAccessContext();
  }, [reloadAccessContext]);

  useEffect(() => {
    void reloadSubmitters();
  }, [reloadSubmitters]);

  useEffect(() => {
    if (!enabled || !selectedProfileId) {
      return;
    }

    void loadRequestsForProfile(selectedProfileId);
  }, [accessContext, enabled, loadRequestsForProfile, selectedProfileId]);

  useEffect(() => {
    if (!enabled) {
      setSelectedProfileId(null);
      setRequests([]);
      setSelectedRequestId(null);
    }
  }, [enabled]);

  return {
    submitterOptions,
    loadingOptions,
    selectedProfileId,
    selectedSubmitter,
    pickerValue: selectedProfileId ?? EMPTY_PROFILE_VALUE,
    allSubmittersFilterValue: EMPTY_PROFILE_VALUE,
    requests,
    selectedRequest,
    selectedRequestId,
    setSelectedRequestId,
    loadingRequests,
    isSavingFollowUpStage,
    followUpStages: PASTORAL_FOLLOW_UP_STAGES,
    error,
    rpcMissing,
    selectProfileId,
    setFollowUpStage,
    canAdvanceToFollowUpStage: canAdvanceToPastoralFollowUpStage,
    isFollowUpStageDone: isPastoralFollowUpStageDone,
    reloadSubmitters,
    accessContext,
    canViewPastoralRequestForSession,
    canUpdatePastoralRequestForSession,
    formatRequestDateTimeLabel: formatPastoralRequestDateTimeLabel,
  };
}

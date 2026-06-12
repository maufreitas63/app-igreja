import {
  approvePastoralCancellation,
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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export const MAINTENANCE_PASTORAL_CARE_SQL_HINT =
  'Execute no Supabase: scripts/pastoral-requests-fields.sql, scripts/access-control-pastoral-intercessao.sql, scripts/pastoral-maintenance-rpc.sql, scripts/pastoral-request-handler.sql e scripts/pastoral-request-cancellation.sql.';

const EMPTY_PROFILE_VALUE = '';

export function useMaintenancePastoralCare(enabled: boolean) {
  const [submitterOptions, setSubmitterOptions] = useState<PastoralSubmitterOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [requests, setRequests] = useState<MaintenancePastoralRequestView[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [isSavingFollowUpStage, setIsSavingFollowUpStage] = useState(false);
  const [isApprovingCancellation, setIsApprovingCancellation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessContext, setAccessContext] = useState<PastoralCareAccessContext>({
    profileId: null,
    operatorFullName: null,
    hasFullPastoralAccess: false,
    isIntercessionVolunteer: false,
    isSuperAdmin: false,
  });
  const [accessContextReady, setAccessContextReady] = useState(false);
  const submitterOptionsRef = useRef(submitterOptions);
  submitterOptionsRef.current = submitterOptions;
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
      const option = submitterOptionsRef.current.find((row) => row.profileId === profileId);
      const profileFromOption = option
        ? {
            profileId: option.profileId,
            fullName: option.fullName,
            shortName: option.shortName,
            phone: option.phone,
          }
        : null;
      const profile = profileFromOption ?? (await fetchPastoralSubmitterProfile(profileId));

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
  }, [accessContext]);

  const reloadAccessContext = useCallback(async () => {
    if (!enabled) {
      setAccessContextReady(false);
      setAccessContext({
        profileId: null,
        operatorFullName: null,
        hasFullPastoralAccess: false,
        isIntercessionVolunteer: false,
        isSuperAdmin: false,
      });
      return;
    }

    setAccessContextReady(false);

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
        isSuperAdmin: false,
      });
    } finally {
      setAccessContextReady(true);
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
    [accessContext.operatorFullName, accessContext.profileId, requests]
  );

  const approveCancellation = useCallback(
    async (requestId: string) => {
      setIsApprovingCancellation(true);
      setError(null);

      try {
        const result = await approvePastoralCancellation(requestId);

        if (!result.success) {
          setError(result.message ?? 'Não foi possível cancelar o pedido.');
          return result;
        }

        const remaining = requests.filter((row) => row.id !== requestId);
        const nextSelectedRequestId =
          selectedRequestId && selectedRequestId !== requestId
            ? selectedRequestId
            : remaining[0]?.id ?? null;

        setRequests(remaining);
        setSelectedRequestId(nextSelectedRequestId);
        await reloadSubmitters();

        return result;
      } catch (err) {
        console.error('Erro ao cancelar pedido pastoral:', err);

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
          err instanceof Error ? err.message : 'Não foi possível cancelar o pedido.';

        setError(message);
        return { success: false as const, message };
      } finally {
        setIsApprovingCancellation(false);
      }
    },
    [reloadSubmitters, requests, resolveMaintenanceRpcError, selectedRequestId]
  );

  const selectProfileId = useCallback((profileId: string | null) => {
    if (!profileId) {
      setSelectedProfileId(null);
      setRequests([]);
      setSelectedRequestId(null);
      return;
    }

    setSelectedProfileId(profileId);
  }, []);

  useEffect(() => {
    void reloadAccessContext();
  }, [reloadAccessContext]);

  useEffect(() => {
    void reloadSubmitters();
  }, [reloadSubmitters]);

  useEffect(() => {
    if (!enabled || !selectedProfileId || !accessContextReady) {
      return;
    }

    void loadRequestsForProfile(selectedProfileId);
  }, [accessContext, accessContextReady, enabled, loadRequestsForProfile, selectedProfileId]);

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
    isApprovingCancellation,
    approveCancellation,
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

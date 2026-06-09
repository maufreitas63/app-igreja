import {
  fetchMaintenanceScaleTypes,
  fetchVolunteersForScaleType,
  MAINTENANCE_SCALE_VOLUNTEERS_RPC_MISSING,
  registerScaleVolunteer,
  removeScaleVolunteer,
  searchProfilesForScaleVolunteer,
  type MaintenanceScaleType,
  type MaintenanceScaleVolunteer,
  type ProfileForScaleVolunteer,
} from '@/lib/maintenanceScaleVolunteersApi';
import { MAINTENANCE_SCALES_SQL_HINT } from '@/lib/maintenanceScales';
import { useMaintenanceRpcMissing } from '@/hooks/useMaintenanceRpcMissing';
import { useCallback, useEffect, useMemo, useState } from 'react';

export const MAINTENANCE_SCALE_VOLUNTEERS_SQL_HINT = `${MAINTENANCE_SCALES_SQL_HINT}\nTambém execute scripts/escalas-volunteers-rpc.sql.`;

export function useMaintenanceScaleVolunteers(enabled: boolean) {
  const [scaleTypes, setScaleTypes] = useState<MaintenanceScaleType[]>([]);
  const [registeredVolunteers, setRegisteredVolunteers] = useState<MaintenanceScaleVolunteer[]>([]);
  const [selectedScaleTypeId, setSelectedScaleTypeId] = useState<string | null>(null);
  const [profileSearchQuery, setProfileSearchQuery] = useState('');
  const [profileResults, setProfileResults] = useState<ProfileForScaleVolunteer[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchingProfiles, setSearchingProfiles] = useState(false);
  const [loadingVolunteers, setLoadingVolunteers] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removingVolunteerId, setRemovingVolunteerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { rpcMissing, beginMaintenanceRequest, resolveMaintenanceRpcError } = useMaintenanceRpcMissing();

  const reloadTypes = useCallback(async () => {
    if (!enabled) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const types = await fetchMaintenanceScaleTypes();
      setScaleTypes(types);

      setSelectedScaleTypeId((current) => {
        if (current && types.some((type) => type.id === current)) {
          return current;
        }

        return types[0]?.id ?? null;
      });
    } catch (err) {
      console.error('Erro ao carregar tipos de escala:', err);
      setScaleTypes([]);
      setSelectedScaleTypeId(null);
      setError('Não foi possível carregar os tipos de escala.');
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  const reloadVolunteers = useCallback(async (scaleTypeId: string | null) => {
    if (!enabled || !scaleTypeId) {
      setRegisteredVolunteers([]);
      return;
    }

    setLoadingVolunteers(true);

    try {
      const rows = await fetchVolunteersForScaleType(scaleTypeId);
      setRegisteredVolunteers(rows);
    } catch (err) {
      console.error('Erro ao carregar voluntários da escala:', err);
      setRegisteredVolunteers([]);
      setError('Não foi possível carregar os servos deste tipo de escala.');
    } finally {
      setLoadingVolunteers(false);
    }
  }, [enabled]);

  const reload = useCallback(async () => {
    await reloadTypes();
    await reloadVolunteers(selectedScaleTypeId);
  }, [reloadTypes, reloadVolunteers, selectedScaleTypeId]);

  useEffect(() => {
    void reloadTypes();
  }, [reloadTypes]);

  useEffect(() => {
    void reloadVolunteers(selectedScaleTypeId);
    setProfileSearchQuery('');
    setProfileResults([]);
  }, [reloadVolunteers, selectedScaleTypeId]);

  useEffect(() => {
    if (!enabled || profileSearchQuery.trim().length < 2) {
      setProfileResults([]);
      setSearchingProfiles(false);
      return;
    }

    let active = true;
    setSearchingProfiles(true);

    const timer = setTimeout(() => {
      void (async () => {
        try {
          const results = await searchProfilesForScaleVolunteer(profileSearchQuery);
          if (!active) {
            return;
          }

          setProfileResults(results);
          setError(null);
        } catch (err) {
          const detail =
            err && typeof err === 'object' && 'message' in err && typeof err.message === 'string'
              ? err.message
              : String(err);
          console.error('Erro ao buscar perfis em profiles:', detail, err);
          if (!active) {
            return;
          }

          setProfileResults([]);
          setError('Não foi possível buscar por nome em profiles.');
        } finally {
          if (active) {
            setSearchingProfiles(false);
          }
        }
      })();
    }, 350);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [enabled, profileSearchQuery]);

  const registeredNameKeys = useMemo(() => {
    const keys = new Set<string>();

    for (const volunteer of registeredVolunteers) {
      keys.add(volunteer.name.trim().toLocaleLowerCase('pt-BR'));
    }

    return keys;
  }, [registeredVolunteers]);

  const associateProfile = useCallback(
    async (profileId: string) => {
      if (!selectedScaleTypeId) {
        return { success: false as const, message: 'Selecione um tipo de escala.' };
      }

      setSaving(true);
      setError(null);
      beginMaintenanceRequest();

      try {
        const result = await registerScaleVolunteer(selectedScaleTypeId, profileId);

        if (!result.success) {
          const alreadyRegistered = (result.message ?? '')
            .toLowerCase()
            .includes('já está cadastrado');

          if (alreadyRegistered) {
            await reloadVolunteers(selectedScaleTypeId);
          }

          return {
            success: false as const,
            message: result.message ?? 'Não foi possível cadastrar o servo.',
          };
        }

        await reloadVolunteers(selectedScaleTypeId);
        setProfileSearchQuery('');
        setProfileResults([]);

        return { success: true as const, message: result.message ?? 'Servo cadastrado.' };
      } catch (err) {
        console.error('Erro ao cadastrar voluntário na escala:', err);

        const rpcHint = resolveMaintenanceRpcError(
          err,
          MAINTENANCE_SCALE_VOLUNTEERS_RPC_MISSING,
          MAINTENANCE_SCALE_VOLUNTEERS_SQL_HINT
        );

        if (rpcHint) {
          return {
            success: false as const,
            message: rpcHint,
          };
        }

        const message =
          err instanceof Error ? err.message : 'Não foi possível cadastrar o servo.';

        return { success: false as const, message };
      } finally {
        setSaving(false);
      }
    },
    [reloadVolunteers, selectedScaleTypeId]
  );

  const removeVolunteer = useCallback(
    async (volunteerId: string) => {
      if (!selectedScaleTypeId) {
        return { success: false as const, message: 'Selecione um tipo de escala.' };
      }

      setRemovingVolunteerId(volunteerId);
      setError(null);
      beginMaintenanceRequest();

      try {
        const result = await removeScaleVolunteer(selectedScaleTypeId, volunteerId);

        if (!result.success) {
          return {
            success: false as const,
            message: result.message ?? 'Não foi possível remover o servo.',
          };
        }

        setRegisteredVolunteers((current) =>
          current.filter((volunteer) => volunteer.id !== volunteerId)
        );
        await reloadVolunteers(selectedScaleTypeId);

        return { success: true as const, message: result.message ?? 'Servo removido.' };
      } catch (err) {
        console.error('Erro ao remover voluntário da escala:', err);

        const rpcHint = resolveMaintenanceRpcError(
          err,
          MAINTENANCE_SCALE_VOLUNTEERS_RPC_MISSING,
          MAINTENANCE_SCALE_VOLUNTEERS_SQL_HINT
        );

        if (rpcHint) {
          return {
            success: false as const,
            message: rpcHint,
          };
        }

        const message =
          err instanceof Error ? err.message : 'Não foi possível remover o servo.';

        return { success: false as const, message };
      } finally {
        setRemovingVolunteerId(null);
      }
    },
    [reloadVolunteers, selectedScaleTypeId]
  );

  return {
    scaleTypes,
    selectedScaleTypeId,
    setSelectedScaleTypeId,
    registeredVolunteers,
    registeredNameKeys,
    profileSearchQuery,
    setProfileSearchQuery,
    profileResults,
    searchingProfiles,
    loading,
    loadingVolunteers,
    saving,
    removingVolunteerId,
    error,
    rpcMissing,
    reload,
    associateProfile,
    removeVolunteer,
  };
}

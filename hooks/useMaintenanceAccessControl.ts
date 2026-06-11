import {
  assignProfileRole,
  checkSessionIsSuperAdmin,
  ensureAccessControlPanelResourceAdmin,
  listAccessRolesAdmin,
  listProfileRoleAssignments,
  ensureFinancialAccessResourcesAdmin,
  listProfilesForAccessAdmin,
  listRoleGrantsAdmin,
  MAINTENANCE_ACCESS_CONTROL_RPC_MISSING,
  EXPECTED_ACCESS_ROLE_CODES,
  MAINTENANCE_ACCESS_CONTROL_SQL_HINT,
  revokeProfileRole,
  saveRoleGrantAdmin,
  type AccessProfileSearchResult,
  type AccessResourceTypeFilter,
  type AccessRoleRecord,
  type ProfileRoleAssignment,
  type RoleGrantRecord,
} from '@/lib/maintenanceAccessControlApi';
import {
  listProfileScaleLeadershipAdmin,
  saveProfileScaleLeadershipAdmin,
  type ProfileScaleLeadershipAssignment,
} from '@/lib/scaleAccess';
import { useMaintenanceRpcMissing } from '@/hooks/useMaintenanceRpcMissing';
import { useCallback, useEffect, useState } from 'react';

export { MAINTENANCE_ACCESS_CONTROL_SQL_HINT };

export function useMaintenanceAccessControl(enabled: boolean) {
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean | null>(null);
  const [roles, setRoles] = useState<AccessRoleRecord[]>([]);
  const [allProfiles, setAllProfiles] = useState<AccessProfileSearchResult[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<AccessProfileSearchResult | null>(null);
  const [profileRoles, setProfileRoles] = useState<ProfileRoleAssignment[]>([]);
  const [profileScaleLeadership, setProfileScaleLeadership] = useState<ProfileScaleLeadershipAssignment[]>([]);
  const [selectedRoleCode, setSelectedRoleCode] = useState('member');
  const [resourceTypeFilter, setResourceTypeFilter] = useState<AccessResourceTypeFilter>('screen');
  const [roleGrants, setRoleGrants] = useState<RoleGrantRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [loadingProfileRoles, setLoadingProfileRoles] = useState(false);
  const [loadingScaleLeadership, setLoadingScaleLeadership] = useState(false);
  const [savingScaleLeadershipId, setSavingScaleLeadershipId] = useState<string | null>(null);
  const [loadingGrants, setLoadingGrants] = useState(false);
  const [savingRoleCode, setSavingRoleCode] = useState<string | null>(null);
  const [savingGrantKey, setSavingGrantKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { rpcMissing, beginMaintenanceRequest, resolveMaintenanceRpcError } = useMaintenanceRpcMissing();

  const handleRpcError = useCallback(
    (err: unknown, fallbackMessage: string) => {
      const rpcHint = resolveMaintenanceRpcError(
        err,
        MAINTENANCE_ACCESS_CONTROL_RPC_MISSING,
        MAINTENANCE_ACCESS_CONTROL_SQL_HINT
      );

      if (rpcHint) {
        setError(rpcHint);
        return;
      }

      const message = err instanceof Error ? err.message : fallbackMessage;
      setError(message);
    },
    [resolveMaintenanceRpcError]
  );

  const loadBootstrap = useCallback(async () => {
    if (!enabled) {
      setIsSuperAdmin(null);
      setRoles([]);
      return;
    }

    setLoading(true);
    setError(null);
    beginMaintenanceRequest();

    try {
      const allowed = await checkSessionIsSuperAdmin();
      setIsSuperAdmin(allowed);

      if (!allowed) {
        setRoles([]);
        return;
      }

      const roleRows = await listAccessRolesAdmin();
      setRoles(roleRows);

      if (!roleRows.some((row) => row.code === selectedRoleCode) && roleRows.length > 0) {
        setSelectedRoleCode(roleRows[0].code);
      }
    } catch (err) {
      console.error('Erro ao carregar controle de acesso:', err);
      setIsSuperAdmin(false);
      setRoles([]);
      handleRpcError(err, 'Não foi possível carregar o controle de acesso.');
    } finally {
      setLoading(false);
    }
  }, [enabled, handleRpcError, selectedRoleCode]);

  useEffect(() => {
    void loadBootstrap();
  }, [loadBootstrap]);

  const loadAllProfiles = useCallback(async () => {
    if (!enabled || !isSuperAdmin || rpcMissing) {
      if (!enabled || !isSuperAdmin) {
        setAllProfiles([]);
        setLoadingProfiles(false);
      }
      return;
    }

    setLoadingProfiles(true);
    setError(null);

    try {
      const rows = await listProfilesForAccessAdmin();
      setAllProfiles(rows);
    } catch (err) {
      console.error('Erro ao listar perfis:', err);
      setAllProfiles([]);
      handleRpcError(err, 'Não foi possível carregar a lista de perfis.');
    } finally {
      setLoadingProfiles(false);
    }
  }, [enabled, handleRpcError, isSuperAdmin, rpcMissing]);

  useEffect(() => {
    void loadAllProfiles();
  }, [loadAllProfiles]);

  const reloadProfileScaleLeadership = useCallback(async (profileId: string) => {
    setLoadingScaleLeadership(true);

    try {
      const rows = await listProfileScaleLeadershipAdmin(profileId);
      setProfileScaleLeadership(rows);
    } catch (err) {
      console.error('Erro ao carregar lideranças de escala:', err);
      setProfileScaleLeadership([]);
    } finally {
      setLoadingScaleLeadership(false);
    }
  }, []);

  const selectProfile = useCallback(async (profile: AccessProfileSearchResult) => {
    setSelectedProfile(profile);
    setLoadingProfileRoles(true);
    setError(null);

    try {
      const [roleRows] = await Promise.all([
        listProfileRoleAssignments(profile.id),
        reloadProfileScaleLeadership(profile.id),
      ]);
      setProfileRoles(roleRows);
    } catch (err) {
      console.error('Erro ao carregar papéis do perfil:', err);
      setProfileRoles([]);
      handleRpcError(err, 'Não foi possível carregar os papéis do perfil.');
    } finally {
      setLoadingProfileRoles(false);
    }
  }, [handleRpcError, reloadProfileScaleLeadership]);

  const selectProfileById = useCallback(
    async (profileId: string) => {
      if (!profileId) {
        setSelectedProfile(null);
        setProfileRoles([]);
        setProfileScaleLeadership([]);
        return;
      }

      const profile = allProfiles.find((row) => row.id === profileId);

      if (!profile) {
        setError('Perfil não encontrado na lista.');
        return;
      }

      await selectProfile(profile);
    },
    [allProfiles, selectProfile]
  );

  const reloadRoleGrants = useCallback(async () => {
    if (!enabled || !isSuperAdmin || !selectedRoleCode) {
      setRoleGrants([]);
      return;
    }

    setLoadingGrants(true);
    setError(null);

    try {
      if (resourceTypeFilter === 'screen') {
        await Promise.all([
          ensureFinancialAccessResourcesAdmin(),
          ensureAccessControlPanelResourceAdmin(),
        ]);
      }

      const rows = await listRoleGrantsAdmin(selectedRoleCode, resourceTypeFilter);
      setRoleGrants(rows);
    } catch (err) {
      console.error('Erro ao carregar grants:', err);
      setRoleGrants([]);
      handleRpcError(err, 'Não foi possível carregar as permissões do papel.');
    } finally {
      setLoadingGrants(false);
    }
  }, [enabled, handleRpcError, isSuperAdmin, resourceTypeFilter, selectedRoleCode]);

  useEffect(() => {
    void reloadRoleGrants();
  }, [reloadRoleGrants]);

  const toggleProfileRole = useCallback(
    async (roleCode: string, nextAssigned: boolean) => {
      if (!selectedProfile) {
        return { success: false as const, message: 'Selecione um perfil.' };
      }

      setSavingRoleCode(roleCode);
      setError(null);

      const previousRoles = profileRoles;

      setProfileRoles((current) =>
        current.map((row) =>
          row.roleCode === roleCode ? { ...row, assigned: nextAssigned } : row
        )
      );

      try {
        const result = nextAssigned
          ? await assignProfileRole(selectedProfile.id, roleCode)
          : await revokeProfileRole(selectedProfile.id, roleCode);

        if (!result.success) {
          setProfileRoles(previousRoles);
          setError(result.message);
          return result;
        }

        return result;
      } catch (err) {
        setProfileRoles(previousRoles);
        console.error('Erro ao alterar papel do perfil:', err);
        handleRpcError(err, 'Não foi possível alterar o papel.');
        return { success: false as const, message: error ?? 'Não foi possível alterar o papel.' };
      } finally {
        setSavingRoleCode(null);
      }
    },
    [error, handleRpcError, profileRoles, selectedProfile]
  );

  const toggleScaleLeadership = useCallback(
    async (scaleTypeId: string, nextAssigned: boolean) => {
      if (!selectedProfile) {
        return { success: false as const, message: 'Selecione um perfil.' };
      }

      setSavingScaleLeadershipId(scaleTypeId);
      setError(null);

      const previousLeadership = profileScaleLeadership;

      setProfileScaleLeadership((current) =>
        current.map((row) =>
          row.scaleTypeId === scaleTypeId ? { ...row, assigned: nextAssigned } : row
        )
      );

      try {
        const result = await saveProfileScaleLeadershipAdmin(
          selectedProfile.id,
          scaleTypeId,
          nextAssigned
        );

        if (!result.success) {
          setProfileScaleLeadership(previousLeadership);
          setError(result.message);
          return result;
        }

        return result;
      } catch (err) {
        setProfileScaleLeadership(previousLeadership);
        console.error('Erro ao alterar liderança de escala:', err);
        handleRpcError(err, 'Não foi possível alterar a liderança de escala.');
        return { success: false as const, message: error ?? 'Não foi possível alterar a liderança de escala.' };
      } finally {
        setSavingScaleLeadershipId(null);
      }
    },
    [error, handleRpcError, profileScaleLeadership, selectedProfile]
  );

  const updateRoleGrant = useCallback(
    async (
      grant: RoleGrantRecord,
      patch: Partial<Pick<RoleGrantRecord, 'canView' | 'canUpdate'>>
    ) => {
      const nextView = patch.canView ?? grant.canView;
      const nextUpdate = patch.canUpdate ?? grant.canUpdate;
      const previousView = grant.canView;
      const previousUpdate = grant.canUpdate;

      setSavingGrantKey(grant.resourceKey);
      setError(null);

      setRoleGrants((current) =>
        current.map((row) =>
          row.resourceKey === grant.resourceKey
            ? {
                ...row,
                canView: nextView,
                canUpdate: nextUpdate,
                grantId: nextView || nextUpdate ? row.grantId ?? 'local' : null,
              }
            : row
        )
      );

      try {
        const result = await saveRoleGrantAdmin(
          selectedRoleCode,
          grant.resourceType,
          grant.resourceKey,
          nextView,
          nextUpdate
        );

        if (!result.success) {
          setRoleGrants((current) =>
            current.map((row) =>
              row.resourceKey === grant.resourceKey
                ? {
                    ...row,
                    canView: previousView,
                    canUpdate: previousUpdate,
                    grantId: previousView || previousUpdate ? row.grantId : null,
                  }
                : row
            )
          );
          setError(result.message);
          return result;
        }

        return result;
      } catch (err) {
        setRoleGrants((current) =>
          current.map((row) =>
            row.resourceKey === grant.resourceKey
              ? {
                  ...row,
                  canView: previousView,
                  canUpdate: previousUpdate,
                  grantId: previousView || previousUpdate ? row.grantId : null,
                }
              : row
          )
        );
        console.error('Erro ao salvar grant:', err);
        handleRpcError(err, 'Não foi possível salvar a permissão.');
        return { success: false as const, message: error ?? 'Não foi possível salvar a permissão.' };
      } finally {
        setSavingGrantKey(null);
      }
    },
    [error, handleRpcError, selectedRoleCode]
  );

  const missingExpectedRoles = EXPECTED_ACCESS_ROLE_CODES.filter(
    (code) => !roles.some((role) => role.code === code)
  );

  return {
    isSuperAdmin,
    roles,
    missingExpectedRoles,
    allProfiles,
    loadingProfiles,
    selectedProfile,
    profileRoles,
    profileScaleLeadership,
    loadingScaleLeadership,
    savingScaleLeadershipId,
    selectedRoleCode,
    setSelectedRoleCode,
    resourceTypeFilter,
    setResourceTypeFilter,
    roleGrants,
    loading,
    loadingProfileRoles,
    loadingGrants,
    savingRoleCode,
    savingGrantKey,
    error,
    rpcMissing,
    selectProfile,
    selectProfileById,
    clearSelectedProfile: () => {
      setSelectedProfile(null);
      setProfileRoles([]);
      setProfileScaleLeadership([]);
    },
    toggleProfileRole,
    toggleScaleLeadership,
    updateRoleGrant,
    reloadRoleGrants,
  };
}

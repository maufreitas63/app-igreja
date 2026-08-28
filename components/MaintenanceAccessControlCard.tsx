import { CardLoadingState } from '@/components/ui/CardLoadingState';
import { DropdownSelect } from '@/components/ui/DropdownSelect';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { formatShortName } from '@/lib/formatShortName';
import { FINANCIAL_ACCESS_SCREEN_RESOURCE_KEYS } from '@/lib/accessControl';
import {
  ACCESS_CONTROL_PANEL_RESOURCE,
  compareRoleGrantScreenScope,
  getAccessGrantDashboardScope,
  listResourceGrantsAcrossRolesAdmin,
  MAINTENANCE_ACCESS_CONTROL_SQL_HINT,
  isSensitiveAccessResourceKey,
  type ResourceRoleGrantRecord,
  type RoleGrantRecord,
} from '@/lib/maintenanceAccessControlApi';
import {
  APP_ATIVO_PARAMETER,
  APP_INATIVO_MSG_PARAMETER,
  clearAppActiveStatusCache,
  resolveAppActiveFromParameter,
  resolveAppInactiveMessage,
} from '@/lib/appActiveStatus';
import {
  clearAppParameterCache,
  getAppParameterValue,
  LGPD_ATIVO_PARAMETER,
  resolveLgpdAtivoFromParameter,
  SALVAR_APP_PARAMETER_ADMIN_SQL_HINT,
  saveAppParameterValue,
} from '@/lib/appParameters';
import { useMaintenanceAccessControl } from '@/hooks/useMaintenanceAccessControl';
import { useShowAclTechnicalKeys } from '@/hooks/useShowAclTechnicalKeys';
import {
  computeMaintenanceContentHeight,
  MAINTENANCE_SCROLL_PROPS,
  maintenancePanelStyles,
} from '@/lib/maintenanceCardStyles';
import { CONTAIN_WIDTH } from '@/lib/minimalPresentation';
import { MINIMAL_SECTION_TITLE, MINIMAL_UI } from '@/lib/minimalUiTheme';
import { FontAwesome } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';

type Props = {
  isActive?: boolean;
  panelHeight: number;
  minimal?: boolean;
};

type AdminTab = 'profiles' | 'roles';
type ProfileDetailSection = 'roles' | 'scaleLeadership';

const RESOURCE_TYPE_OPTIONS = [
  { value: 'screen' as const, label: 'Telas' },
  { value: 'table' as const, label: 'Tabelas' },
  { value: 'column' as const, label: 'Colunas' },
];

const SCREEN_GRANT_SCOPE_HINT =
  'Azul celeste: telas do produto principal. Amarelo cobre: telas de manutenção. Toque no ponto colorido ou no nome do recurso para editar permissões por recurso (papéis como linhas).';

type AccessControlPanelHeaderProps = {
  lgpdAtivo: boolean;
  loadingLgpdAtivo: boolean;
  savingLgpdAtivo: boolean;
  appAtivo: boolean;
  loadingAppAtivo: boolean;
  savingAppAtivo: boolean;
  canEdit: boolean;
  onToggleLgpdAtivo: () => void;
  onToggleAppAtivo: () => void;
  minimal?: boolean;
};

function AccessControlPanelHeader({
  lgpdAtivo,
  loadingLgpdAtivo,
  savingLgpdAtivo,
  appAtivo,
  loadingAppAtivo,
  savingAppAtivo,
  canEdit,
  onToggleLgpdAtivo,
  onToggleAppAtivo,
  minimal = false,
}: AccessControlPanelHeaderProps) {
  const lgpdDisabled = !canEdit || loadingLgpdAtivo || savingLgpdAtivo;
  const appDisabled = !canEdit || loadingAppAtivo || savingAppAtivo;

  const lgpdToggle = (
    <TouchableOpacity
      style={[
        styles.lgpdRadioToggle,
        minimal && styles.lgpdRadioToggleMinimal,
        lgpdAtivo ? styles.lgpdRadioToggleActive : styles.lgpdRadioToggleInactive,
        minimal && lgpdAtivo && styles.lgpdRadioToggleActiveMinimal,
        minimal && !lgpdAtivo && styles.lgpdRadioToggleInactiveMinimal,
        lgpdDisabled && styles.lgpdRadioToggleDisabled,
      ]}
      onPress={() => {
        if (!lgpdDisabled) {
          onToggleLgpdAtivo();
        }
      }}
      disabled={lgpdDisabled}
      activeOpacity={0.85}
      accessibilityRole="radio"
      accessibilityState={{ selected: lgpdAtivo, disabled: lgpdDisabled }}
      accessibilityLabel={lgpdAtivo ? 'LGPD Ativo' : 'LGPD Inativo'}
    >
      {savingLgpdAtivo ? (
        <ActivityIndicator size="small" color={minimal ? MINIMAL_UI.accent : '#F8FAFC'} />
      ) : (
        <>
          <View
            style={[
              styles.lgpdRadioOuter,
              lgpdAtivo ? styles.lgpdRadioOuterActive : styles.lgpdRadioOuterInactive,
              minimal && lgpdAtivo && styles.lgpdRadioOuterActiveMinimal,
              minimal && !lgpdAtivo && styles.lgpdRadioOuterInactiveMinimal,
            ]}
          >
            <View
              style={[
                styles.lgpdRadioInner,
                lgpdAtivo ? styles.lgpdRadioInnerActive : styles.lgpdRadioInnerInactive,
                minimal && lgpdAtivo && styles.lgpdRadioInnerActiveMinimal,
                minimal && !lgpdAtivo && styles.lgpdRadioInnerInactiveMinimal,
              ]}
            />
          </View>
          <Text
            style={[
              styles.lgpdRadioLabel,
              lgpdAtivo ? styles.lgpdRadioLabelActive : styles.lgpdRadioLabelInactive,
              minimal && lgpdAtivo && styles.lgpdRadioLabelActiveMinimal,
              minimal && !lgpdAtivo && styles.lgpdRadioLabelInactiveMinimal,
            ]}
          >
            {lgpdAtivo ? 'LGPD Ativo' : 'LGPD Inativo'}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );

  const appToggle = (
    <TouchableOpacity
      style={[
        styles.lgpdRadioToggle,
        minimal && styles.lgpdRadioToggleMinimal,
        appAtivo ? styles.appAtivoToggleActive : styles.appAtivoToggleInactive,
        minimal && appAtivo && styles.appAtivoToggleActiveMinimal,
        minimal && !appAtivo && styles.appAtivoToggleInactiveMinimal,
        appDisabled && styles.lgpdRadioToggleDisabled,
      ]}
      onPress={() => {
        if (!appDisabled) {
          onToggleAppAtivo();
        }
      }}
      disabled={appDisabled}
      activeOpacity={0.85}
      accessibilityRole="radio"
      accessibilityState={{ selected: appAtivo, disabled: appDisabled }}
      accessibilityLabel={appAtivo ? 'Aplicativo ativo' : 'Aplicativo inativo'}
    >
      {savingAppAtivo ? (
        <ActivityIndicator size="small" color={minimal ? MINIMAL_UI.accent : '#F8FAFC'} />
      ) : (
        <>
          <View
            style={[
              styles.lgpdRadioOuter,
              appAtivo ? styles.appAtivoRadioOuterActive : styles.appAtivoRadioOuterInactive,
            ]}
          >
            <View
              style={[
                styles.lgpdRadioInner,
                appAtivo ? styles.appAtivoRadioInnerActive : styles.appAtivoRadioInnerInactive,
              ]}
            />
          </View>
          <Text
            style={[
              styles.lgpdRadioLabel,
              appAtivo ? styles.appAtivoLabelActive : styles.appAtivoLabelInactive,
              minimal && appAtivo && styles.appAtivoLabelActiveMinimal,
              minimal && !appAtivo && styles.appAtivoLabelInactiveMinimal,
            ]}
          >
            {appAtivo ? 'App Ativo' : 'App Inativo'}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );

  if (minimal) {
    return (
      <View style={styles.panelHeaderMinimal}>
        <Text style={styles.sectionTitleMinimal}>Controle de Acesso</Text>
        <View style={styles.panelHeaderControlsMinimal}>
          {appToggle}
          {lgpdToggle}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.panelHeaderBlock}>
      <Text style={styles.panelTitleCompact} numberOfLines={1}>
        Controle de Acesso
      </Text>
      <View style={styles.panelHeaderControls}>
        {appToggle}
        {lgpdToggle}
      </View>
    </View>
  );
}

type AppAtivoParameterControlsProps = {
  appAtivo: boolean;
  appInativoMsg: string;
  loadingAppAtivo: boolean;
  savingAppAtivo: boolean;
  savingAppInativoMsg: boolean;
  canEdit: boolean;
  onToggleAppAtivo: () => void;
  onChangeAppInativoMsg: (value: string) => void;
  onSaveAppInativoMsg: () => void;
  minimal?: boolean;
};

function AppAtivoParameterControls({
  appAtivo,
  appInativoMsg,
  loadingAppAtivo,
  savingAppAtivo,
  savingAppInativoMsg,
  canEdit,
  onToggleAppAtivo,
  onChangeAppInativoMsg,
  onSaveAppInativoMsg,
  minimal = false,
}: AppAtivoParameterControlsProps) {
  const messageDisabled = !canEdit || loadingAppAtivo || savingAppInativoMsg || appAtivo;

  if (appAtivo) {
    return null;
  }

  return (
    <View style={[styles.appAtivoSection, minimal && styles.appAtivoSectionMinimal]}>
      <Text style={[styles.appInativoMsgLabel, minimal && styles.appInativoMsgLabelMinimal]}>
        Mensagem exibida aos usuários
      </Text>
      <TextInput
        style={[styles.appInativoMsgInput, minimal && styles.appInativoMsgInputMinimal]}
        value={appInativoMsg}
        onChangeText={onChangeAppInativoMsg}
        editable={!messageDisabled}
        multiline
        placeholder="Texto da tela de indisponibilidade"
        placeholderTextColor={minimal ? MINIMAL_UI.textMuted : '#64748B'}
      />
      <TouchableOpacity
        style={[
          styles.appInativoMsgSaveButton,
          minimal && styles.appInativoMsgSaveButtonMinimal,
          messageDisabled && styles.appInativoMsgSaveButtonDisabled,
        ]}
        onPress={onSaveAppInativoMsg}
        disabled={messageDisabled}
        activeOpacity={0.85}
      >
        {savingAppInativoMsg ? (
          <ActivityIndicator size="small" color={minimal ? MINIMAL_UI.onDark : '#0f172a'} />
        ) : (
          <Text
            style={[
              styles.appInativoMsgSaveButtonText,
              minimal && styles.appInativoMsgSaveButtonTextMinimal,
            ]}
          >
            Salvar mensagem
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

export function MaintenanceAccessControlCard({
  isActive = true,
  panelHeight,
  minimal = false,
}: Props) {
  const { showTechnicalKeys } = useShowAclTechnicalKeys(isActive);
  const [activeTab, setActiveTab] = useState<AdminTab>('profiles');
  const [grantSearchQuery, setGrantSearchQuery] = useState('');
  const [focusedResourceGrant, setFocusedResourceGrant] = useState<RoleGrantRecord | null>(null);
  const [resourceRoleGrants, setResourceRoleGrants] = useState<ResourceRoleGrantRecord[]>([]);
  const [loadingResourceRoleGrants, setLoadingResourceRoleGrants] = useState(false);
  const [expandedProfileSection, setExpandedProfileSection] = useState<ProfileDetailSection | null>(
    null
  );
  const [lgpdAtivo, setLgpdAtivo] = useState(true);
  const [loadingLgpdAtivo, setLoadingLgpdAtivo] = useState(false);
  const [savingLgpdAtivo, setSavingLgpdAtivo] = useState(false);
  const [appAtivo, setAppAtivo] = useState(true);
  const [appInativoMsg, setAppInativoMsg] = useState('');
  const [loadingAppAtivo, setLoadingAppAtivo] = useState(false);
  const [savingAppAtivo, setSavingAppAtivo] = useState(false);
  const [savingAppInativoMsg, setSavingAppInativoMsg] = useState(false);
  const {
    isSuperAdmin,
    roles,
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
    savingResourceGrantKey,
    error,
    missingExpectedRoles,
    rpcMissing,
    selectProfileById,
    clearSelectedProfile,
    toggleProfileRole,
    toggleScaleLeadership,
    updateRoleGrant,
    updateGrantForRole,
    reloadRoleGrants,
  } = useMaintenanceAccessControl(isActive);

  const contentHeight = computeMaintenanceContentHeight(panelHeight);
  const busy =
    savingRoleCode !== null
    || savingGrantKey !== null
    || savingResourceGrantKey !== null
    || savingScaleLeadershipId !== null
    || savingLgpdAtivo
    || savingAppAtivo
    || savingAppInativoMsg;
  const hasAssignedProfileRoles = profileRoles.some((role) => role.assigned);
  const profileHasLiderGeralRole = profileRoles.some(
    (role) => role.assigned && role.roleCode === 'lider_geral'
  );
  const profileHasLiderRole = profileRoles.some(
    (role) => role.assigned && role.roleCode === 'lider'
  );

  const scaleLeadershipHint = profileHasLiderGeralRole
    ? 'Papel Líder Geral: acesso automático a todas as escalas ativas. Os tipos abaixo são opcionais.'
    : profileHasLiderRole
      ? 'Ative os tipos que este perfil pode gerenciar (requer papel Líder).'
      : 'Ative os tipos após atribuir o papel Líder ou Líder Geral ao perfil.';

  const hasGrantSearchQuery = grantSearchQuery.trim().length > 0;

  const handleClearGrantSearch = () => {
    setGrantSearchQuery('');
  };

  useEffect(() => {
    if (!isActive || isSuperAdmin !== true) {
      return;
    }

    let active = true;
    setLoadingLgpdAtivo(true);
    setLoadingAppAtivo(true);

    void (async () => {
      try {
        const [lgpdValue, appAtivoValue, appInativoMsgValue] = await Promise.all([
          getAppParameterValue(LGPD_ATIVO_PARAMETER),
          getAppParameterValue(APP_ATIVO_PARAMETER),
          getAppParameterValue(APP_INATIVO_MSG_PARAMETER),
        ]);

        if (active) {
          setLgpdAtivo(resolveLgpdAtivoFromParameter(lgpdValue));
          setAppAtivo(resolveAppActiveFromParameter(appAtivoValue));
          setAppInativoMsg(resolveAppInactiveMessage(appInativoMsgValue));
        }
      } catch (loadError) {
        console.error('Erro ao carregar parâmetros globais:', loadError);
      } finally {
        if (active) {
          setLoadingLgpdAtivo(false);
          setLoadingAppAtivo(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [isActive, isSuperAdmin]);

  const handleToggleLgpdAtivo = () => {
    if (isSuperAdmin !== true || rpcMissing || busy || savingLgpdAtivo || loadingLgpdAtivo) {
      return;
    }

    const nextValue = !lgpdAtivo;
    setSavingLgpdAtivo(true);

    void (async () => {
      try {
        await saveAppParameterValue(LGPD_ATIVO_PARAMETER, nextValue ? 'sim' : 'nao');
        setLgpdAtivo(nextValue);
        clearAppParameterCache(LGPD_ATIVO_PARAMETER);
        Toast.show({
          type: 'success',
          text1: nextValue ? 'LGPD ativado' : 'LGPD inativado',
          text2: nextValue
            ? 'O fluxo de privacidade volta a valer no aplicativo.'
            : 'O alerta de LGPD pendente deixa de ser exibido.',
          visibilityTime: 3500,
        });
      } catch (toggleError) {
        console.error('Erro ao salvar LGPD_Ativo:', toggleError);
        Toast.show({
          type: 'error',
          text1: 'Parâmetro LGPD',
          text2:
            toggleError instanceof Error
              ? toggleError.message
              : `Não foi possível salvar LGPD_Ativo. ${SALVAR_APP_PARAMETER_ADMIN_SQL_HINT}`,
          visibilityTime: 6000,
        });
      } finally {
        setSavingLgpdAtivo(false);
      }
    })();
  };

  const handleToggleAppAtivo = () => {
    if (isSuperAdmin !== true || rpcMissing || busy || savingAppAtivo || loadingAppAtivo) {
      return;
    }

    const nextValue = !appAtivo;
    setSavingAppAtivo(true);

    void (async () => {
      try {
        await saveAppParameterValue(APP_ATIVO_PARAMETER, nextValue ? 'sim' : 'nao');
        setAppAtivo(nextValue);
        clearAppParameterCache(APP_ATIVO_PARAMETER);
        clearAppActiveStatusCache();
        Toast.show({
          type: 'success',
          text1: nextValue ? 'Aplicativo ativado' : 'Aplicativo inativado',
          text2: nextValue
            ? 'O acesso normal foi restaurado para os usuários.'
            : 'Usuários verão a mensagem de indisponibilidade (super admin ignora).',
          visibilityTime: 4000,
        });
      } catch (toggleError) {
        console.error('Erro ao salvar app_ativo:', toggleError);
        Toast.show({
          type: 'error',
          text1: 'Parâmetro app_ativo',
          text2:
            toggleError instanceof Error
              ? toggleError.message
              : `Não foi possível salvar app_ativo. ${SALVAR_APP_PARAMETER_ADMIN_SQL_HINT}`,
          visibilityTime: 6000,
        });
      } finally {
        setSavingAppAtivo(false);
      }
    })();
  };

  const handleSaveAppInativoMsg = () => {
    if (
      isSuperAdmin !== true
      || rpcMissing
      || busy
      || savingAppInativoMsg
      || loadingAppAtivo
      || appAtivo
    ) {
      return;
    }

    const trimmed = appInativoMsg.trim();

    if (!trimmed) {
      Toast.show({
        type: 'error',
        text1: 'Mensagem obrigatória',
        text2: 'Informe o texto exibido quando o aplicativo estiver inativo.',
        visibilityTime: 4500,
      });
      return;
    }

    setSavingAppInativoMsg(true);

    void (async () => {
      try {
        await saveAppParameterValue(APP_INATIVO_MSG_PARAMETER, trimmed);
        setAppInativoMsg(trimmed);
        clearAppParameterCache(APP_INATIVO_MSG_PARAMETER);
        clearAppActiveStatusCache();
        Toast.show({
          type: 'success',
          text1: 'Mensagem salva',
          text2: 'O texto de indisponibilidade foi atualizado.',
          visibilityTime: 3500,
        });
      } catch (saveError) {
        console.error('Erro ao salvar app_inativo_msg:', saveError);
        Toast.show({
          type: 'error',
          text1: 'Parâmetro app_inativo_msg',
          text2:
            saveError instanceof Error
              ? saveError.message
              : `Não foi possível salvar a mensagem. ${SALVAR_APP_PARAMETER_ADMIN_SQL_HINT}`,
          visibilityTime: 6000,
        });
      } finally {
        setSavingAppInativoMsg(false);
      }
    })();
  };

  const missingFinancialScreenResources = useMemo(() => {
    if (resourceTypeFilter !== 'screen' || loadingGrants) {
      return false;
    }

    const registeredKeys = new Set(roleGrants.map((grant) => grant.resourceKey));

    return FINANCIAL_ACCESS_SCREEN_RESOURCE_KEYS.some((key) => !registeredKeys.has(key));
  }, [loadingGrants, resourceTypeFilter, roleGrants]);

  const missingAccessControlScreenResource = useMemo(() => {
    if (resourceTypeFilter !== 'screen' || loadingGrants) {
      return false;
    }

    return !roleGrants.some((grant) => grant.resourceKey === ACCESS_CONTROL_PANEL_RESOURCE);
  }, [loadingGrants, resourceTypeFilter, roleGrants]);

  const profileDropdownOptions = useMemo(
    () =>
      allProfiles.map((profile) => {
        const meta = [profile.phone, profile.memberCode].filter(Boolean).join(' · ');
        const shortName = formatShortName(profile.fullName);

        return {
          value: profile.id,
          label: meta ? `${shortName} · ${meta}` : shortName,
        };
      }),
    [allProfiles]
  );

  const filteredRoleGrants = useMemo(() => {
    const query = grantSearchQuery.trim().toLowerCase();

    const rows = query
      ? roleGrants.filter((grant) => {
          const haystack = `${grant.label} ${grant.resourceKey}`.toLowerCase();
          return haystack.includes(query);
        })
      : roleGrants;

    if (resourceTypeFilter !== 'screen') {
      return rows;
    }

    return [...rows].sort(compareRoleGrantScreenScope);
  }, [grantSearchQuery, resourceTypeFilter, roleGrants]);

  useEffect(() => {
    setExpandedProfileSection(selectedProfile ? 'roles' : null);
  }, [selectedProfile?.id]);

  useEffect(() => {
    if (!focusedResourceGrant || !isSuperAdmin || rpcMissing) {
      setResourceRoleGrants([]);
      setLoadingResourceRoleGrants(false);
      return;
    }

    let active = true;
    setLoadingResourceRoleGrants(true);

    void (async () => {
      try {
        const rows = await listResourceGrantsAcrossRolesAdmin(
          roles,
          focusedResourceGrant.resourceType,
          focusedResourceGrant.resourceKey,
          focusedResourceGrant.label
        );

        if (active) {
          setResourceRoleGrants(rows);
        }
      } catch (loadError) {
        console.error('Erro ao carregar permissões por recurso:', loadError);

        if (active) {
          setResourceRoleGrants([]);
        }
      } finally {
        if (active) {
          setLoadingResourceRoleGrants(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [focusedResourceGrant, isSuperAdmin, roles, rpcMissing]);

  useEffect(() => {
    if (activeTab !== 'roles') {
      setFocusedResourceGrant(null);
    }
  }, [activeTab]);

  useEffect(() => {
    setFocusedResourceGrant(null);
  }, [resourceTypeFilter]);

  const toggleProfileSection = (section: ProfileDetailSection) => {
    setExpandedProfileSection((current) => (current === section ? null : section));
  };

  const handleToggleScaleLeadership = async (scaleTypeId: string, nextAssigned: boolean) => {
    const result = await toggleScaleLeadership(scaleTypeId, nextAssigned);

    if (!result.success) {
      Toast.show({
        type: 'error',
        text1: 'Liderança de escala',
        text2: result.message,
        visibilityTime: 4500,
      });
      return;
    }

    Toast.show({
      type: 'success',
      text1: 'Liderança de escala',
      text2: result.message,
      visibilityTime: 2200,
    });
  };

  const handleToggleRole = async (roleCode: string, nextAssigned: boolean) => {
    const result = await toggleProfileRole(roleCode, nextAssigned);

    if (!result.success) {
      Toast.show({
        type: 'error',
        text1: 'Papéis do perfil',
        text2: result.message,
        visibilityTime: 4500,
      });
      return;
    }

    Toast.show({
      type: 'success',
      text1: 'Papéis do perfil',
      text2: result.message,
      visibilityTime: 2200,
    });
  };

  const handleToggleGrant = async (
    grant: RoleGrantRecord,
    field: 'canView' | 'canUpdate',
    nextValue: boolean
  ) => {
    const patch =
      field === 'canView'
        ? { canView: nextValue, canUpdate: nextValue ? grant.canUpdate : false }
        : { canUpdate: nextValue, canView: nextValue ? true : grant.canView };

    const result = await updateRoleGrant(grant, patch);

    if (!result.success) {
      Toast.show({
        type: 'error',
        text1: 'Permissões do papel',
        text2: result.message,
        visibilityTime: 4500,
      });
    }
  };

  const handleOpenResourceFocus = (grant: RoleGrantRecord) => {
    if (rpcMissing || busy) {
      return;
    }

    setFocusedResourceGrant(grant);
  };

  const handleCloseResourceFocus = () => {
    setFocusedResourceGrant(null);
    setResourceRoleGrants([]);
  };

  const handleToggleResourceRoleGrant = async (
    entry: ResourceRoleGrantRecord,
    field: 'canView' | 'canUpdate',
    nextValue: boolean
  ) => {
    const patch =
      field === 'canView'
        ? { canView: nextValue, canUpdate: nextValue ? entry.canUpdate : false }
        : { canUpdate: nextValue, canView: nextValue ? true : entry.canView };

    const nextView = patch.canView ?? entry.canView;
    const nextUpdate = patch.canUpdate ?? entry.canUpdate;
    const previousView = entry.canView;
    const previousUpdate = entry.canUpdate;

    setResourceRoleGrants((current) =>
      current.map((row) =>
        row.roleCode === entry.roleCode
          ? {
              ...row,
              canView: nextView,
              canUpdate: nextUpdate,
              grantId: nextView || nextUpdate ? row.grantId ?? 'local' : null,
            }
          : row
      )
    );

    const result = await updateGrantForRole(
      entry.roleCode,
      {
        resourceType: entry.resourceType,
        resourceKey: entry.resourceKey,
        canView: entry.canView,
        canUpdate: entry.canUpdate,
      },
      patch
    );

    if (!result.success) {
      setResourceRoleGrants((current) =>
        current.map((row) =>
          row.roleCode === entry.roleCode
            ? {
                ...row,
                canView: previousView,
                canUpdate: previousUpdate,
                grantId: previousView || previousUpdate ? row.grantId : null,
              }
            : row
        )
      );

      Toast.show({
        type: 'error',
        text1: 'Permissões do recurso',
        text2: result.message,
        visibilityTime: 4500,
      });
      return;
    }

    if (selectedRoleCode === entry.roleCode) {
      void reloadRoleGrants();
    }
  };

  if (loading) {
    return (
      <View
        style={[
          styles.panel,
          minimal && styles.panelMinimal,
          maintenancePanelStyles.panelCentered,
          { height: contentHeight },
        ]}
      >
        <CardLoadingState lines={4} minimal={minimal} />
        <Text
          style={[
            maintenancePanelStyles.panelHint,
            minimal && styles.panelHintMinimal,
          ]}
        >
          Carregando controle de acesso…
        </Text>
      </View>
    );
  }

  if (isSuperAdmin === false) {
    return (
      <View
        style={[
          styles.panel,
          minimal && styles.panelMinimal,
          maintenancePanelStyles.panelCentered,
          { height: contentHeight },
        ]}
      >
        <AccessControlPanelHeader
          lgpdAtivo={lgpdAtivo}
          loadingLgpdAtivo={loadingLgpdAtivo}
          savingLgpdAtivo={savingLgpdAtivo}
          appAtivo={appAtivo}
          loadingAppAtivo={loadingAppAtivo}
          savingAppAtivo={savingAppAtivo}
          canEdit={false}
          onToggleLgpdAtivo={handleToggleLgpdAtivo}
          onToggleAppAtivo={handleToggleAppAtivo}
          minimal={minimal}
        />
        <AppAtivoParameterControls
          appAtivo={appAtivo}
          appInativoMsg={appInativoMsg}
          loadingAppAtivo={loadingAppAtivo}
          savingAppAtivo={savingAppAtivo}
          savingAppInativoMsg={savingAppInativoMsg}
          canEdit={false}
          onToggleAppAtivo={handleToggleAppAtivo}
          onChangeAppInativoMsg={setAppInativoMsg}
          onSaveAppInativoMsg={handleSaveAppInativoMsg}
          minimal={minimal}
        />
        <Text
          style={[
            maintenancePanelStyles.panelHint,
            minimal && styles.panelHintMinimal,
          ]}
        >
          Apenas perfis com o papel super_admin podem gerenciar permissões.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.panel, minimal && styles.panelMinimal, { height: contentHeight }]}>
      <AccessControlPanelHeader
        lgpdAtivo={lgpdAtivo}
        loadingLgpdAtivo={loadingLgpdAtivo}
        savingLgpdAtivo={savingLgpdAtivo}
        appAtivo={appAtivo}
        loadingAppAtivo={loadingAppAtivo}
        savingAppAtivo={savingAppAtivo}
        canEdit={isSuperAdmin === true && !rpcMissing && !busy}
        onToggleLgpdAtivo={handleToggleLgpdAtivo}
        onToggleAppAtivo={handleToggleAppAtivo}
        minimal={minimal}
      />
      <AppAtivoParameterControls
        appAtivo={appAtivo}
        appInativoMsg={appInativoMsg}
        loadingAppAtivo={loadingAppAtivo}
        savingAppAtivo={savingAppAtivo}
        savingAppInativoMsg={savingAppInativoMsg}
        canEdit={isSuperAdmin === true && !rpcMissing && !busy}
        onToggleAppAtivo={handleToggleAppAtivo}
        onChangeAppInativoMsg={setAppInativoMsg}
        onSaveAppInativoMsg={handleSaveAppInativoMsg}
        minimal={minimal}
      />
      {!minimal ? <View style={maintenancePanelStyles.panelSubtitleSpacer} /> : null}

      {rpcMissing ? <Text style={styles.warningText}>{MAINTENANCE_ACCESS_CONTROL_SQL_HINT}</Text> : null}
      {!rpcMissing && missingExpectedRoles.length > 0 ? (
        <Text style={styles.warningText}>
          Papéis ausentes no Supabase: {missingExpectedRoles.join(', ')}. Execute{' '}
          scripts/access-control-congregado-visitantes-roles.sql e recarregue a tela.
        </Text>
      ) : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={[styles.tabRow, minimal && styles.tabRowMinimal]}>
        <TouchableOpacity
          style={[
            styles.tabButton,
            minimal && styles.tabButtonMinimal,
            activeTab === 'profiles' && styles.tabButtonActive,
            minimal && activeTab === 'profiles' && styles.tabButtonActiveMinimal,
          ]}
          onPress={() => setActiveTab('profiles')}
          activeOpacity={0.85}
        >
          <Text
            style={[
              styles.tabButtonText,
              minimal && styles.tabButtonTextMinimal,
              activeTab === 'profiles' && styles.tabButtonTextActive,
              minimal && activeTab === 'profiles' && styles.tabButtonTextActiveMinimal,
            ]}
          >
            Perfis
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tabButton,
            minimal && styles.tabButtonMinimal,
            activeTab === 'roles' && styles.tabButtonActive,
            minimal && activeTab === 'roles' && styles.tabButtonActiveMinimal,
          ]}
          onPress={() => setActiveTab('roles')}
          activeOpacity={0.85}
        >
          <Text
            style={[
              styles.tabButtonText,
              minimal && styles.tabButtonTextMinimal,
              activeTab === 'roles' && styles.tabButtonTextActive,
              minimal && activeTab === 'roles' && styles.tabButtonTextActiveMinimal,
            ]}
          >
            Papéis
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'profiles' ? (
        <ScrollView
          style={[styles.tabScroll, minimal && styles.tabScrollMinimal]}
          contentContainerStyle={[
            styles.tabScrollContent,
            minimal && styles.tabScrollContentMinimal,
          ]}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          {...MAINTENANCE_SCROLL_PROPS}
        >
          <View style={styles.profilesPickerSection}>
            {minimal ? (
              <Text style={styles.filterLabelMinimal}>Selecionar perfil</Text>
            ) : (
              <SectionLabel variant="maintenance" tight>
                Selecionar perfil
              </SectionLabel>
            )}
            {!loadingProfiles && allProfiles.length > 0 ? (
              <Text style={[styles.searchHintText, minimal && styles.searchHintTextMinimal]}>
                {allProfiles.length} usuários cadastrados
              </Text>
            ) : null}
            {loadingProfiles ? (
              <CardLoadingState lines={2} compact minimal={minimal} />
            ) : allProfiles.length > 0 ? (
              <DropdownSelect
                options={profileDropdownOptions}
                selectedValue={selectedProfile?.id ?? ''}
                onValueChange={(value) => {
                  if (!value) {
                    clearSelectedProfile();
                    return;
                  }

                  void selectProfileById(value);
                }}
                modalTitle="Selecionar usuário"
                placeholder="Selecionar usuário"
                searchPlaceholder="Digite nome, telefone ou código..."
                searchable
                variant={minimal ? 'minimal' : 'default'}
                style={[styles.profileDropdown, minimal && styles.profileDropdownMinimal]}
                disabled={rpcMissing || busy}
              />
            ) : (
              <Text style={[styles.searchHintText, minimal && styles.searchHintTextMinimal]}>
                Nenhum perfil encontrado.
              </Text>
            )}
          </View>

          {selectedProfile ? (
            <View style={[styles.selectedCard, minimal && styles.selectedCardMinimal]}>
              <View style={styles.selectedHeader}>
                <View style={styles.selectedMain}>
                  <Text
                    style={[styles.selectedName, minimal && styles.selectedNameMinimal]}
                    numberOfLines={2}
                  >
                    {selectedProfile.fullName}
                  </Text>
                  <Text
                    style={[styles.selectedMeta, minimal && styles.selectedMetaMinimal]}
                    numberOfLines={1}
                  >
                    {[selectedProfile.phone, selectedProfile.memberCode].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                <TouchableOpacity onPress={clearSelectedProfile} activeOpacity={0.85}>
                  <Text style={[styles.clearLink, minimal && styles.clearLinkMinimal]}>Limpar</Text>
                </TouchableOpacity>
              </View>

              {!loadingProfileRoles && !hasAssignedProfileRoles ? (
                <Text style={[styles.visitanteHint, minimal && styles.visitanteHintMinimal]}>
                  Sem papéis atribuídos — este perfil é tratado automaticamente como visitante.
                </Text>
              ) : null}

              <TouchableOpacity
                style={[styles.accordionHeader, minimal && styles.accordionHeaderMinimal]}
                onPress={() => toggleProfileSection('roles')}
                activeOpacity={0.85}
              >
                <Text style={[styles.accordionTitle, minimal && styles.accordionTitleMinimal]}>
                  Papéis do perfil
                </Text>
                <Text style={[styles.accordionChevron, minimal && styles.accordionChevronMinimal]}>
                  {expandedProfileSection === 'roles' ? '▼' : '▶'}
                </Text>
              </TouchableOpacity>

              {expandedProfileSection === 'roles' ? (
                loadingProfileRoles ? (
                  <ActivityIndicator
                    color={minimal ? MINIMAL_UI.accent : '#818CF8'}
                    style={styles.inlineLoader}
                  />
                ) : (
                  <View style={styles.rolesList}>
                    {profileRoles.map((role) => {
                      const isSaving = savingRoleCode === role.roleCode;

                      return (
                        <View key={role.roleId} style={[styles.roleRow, minimal && styles.roleRowMinimal]}>
                          <View style={styles.roleMain}>
                            <Text style={[styles.roleName, minimal && styles.roleNameMinimal]}>
                              {role.roleName}
                            </Text>
                            <Text style={[styles.roleCode, minimal && styles.roleCodeMinimal]}>
                              {role.roleCode}
                            </Text>
                          </View>
                          <Switch
                            value={role.assigned}
                            onValueChange={(next) => void handleToggleRole(role.roleCode, next)}
                            disabled={busy || rpcMissing || isSaving}
                            trackColor={
                              minimal
                                ? { false: MINIMAL_UI.divider, true: MINIMAL_UI.blueDark }
                                : { false: '#334155', true: '#4F46E5' }
                            }
                            thumbColor={minimal ? '#FFFFFF' : '#F8FAFC'}
                          />
                        </View>
                      );
                    })}
                  </View>
                )
              ) : null}

              <TouchableOpacity
                style={[styles.accordionHeader, minimal && styles.accordionHeaderMinimal]}
                onPress={() => toggleProfileSection('scaleLeadership')}
                activeOpacity={0.85}
              >
                <Text style={[styles.accordionTitle, minimal && styles.accordionTitleMinimal]}>
                  Liderança por tipo de escala
                </Text>
                <Text style={[styles.accordionChevron, minimal && styles.accordionChevronMinimal]}>
                  {expandedProfileSection === 'scaleLeadership' ? '▼' : '▶'}
                </Text>
              </TouchableOpacity>

              {expandedProfileSection === 'scaleLeadership' ? (
                <>
                  <Text style={[styles.subsectionHint, minimal && styles.subsectionHintMinimal]}>
                    {scaleLeadershipHint}
                  </Text>

                  {loadingScaleLeadership ? (
                    <ActivityIndicator
                      color={minimal ? MINIMAL_UI.accent : '#818CF8'}
                      style={styles.inlineLoader}
                    />
                  ) : profileScaleLeadership.length > 0 ? (
                    <View style={styles.rolesList}>
                      {profileScaleLeadership.map((entry) => {
                        const isSaving = savingScaleLeadershipId === entry.scaleTypeId;

                        return (
                          <View
                            key={entry.scaleTypeId}
                            style={[styles.roleRow, minimal && styles.roleRowMinimal]}
                          >
                            <View style={styles.roleMain}>
                              <Text style={[styles.roleName, minimal && styles.roleNameMinimal]}>
                                {entry.scaleTypeName}
                              </Text>
                              <Text style={[styles.roleCode, minimal && styles.roleCodeMinimal]}>
                                {entry.scaleTypeCode}
                              </Text>
                            </View>
                            <Switch
                              value={entry.assigned}
                              onValueChange={(next) =>
                                void handleToggleScaleLeadership(entry.scaleTypeId, next)
                              }
                              disabled={busy || rpcMissing || isSaving}
                              trackColor={
                                minimal
                                  ? { false: MINIMAL_UI.divider, true: MINIMAL_UI.blueDark }
                                  : { false: '#334155', true: '#4F46E5' }
                              }
                              thumbColor={minimal ? '#FFFFFF' : '#F8FAFC'}
                            />
                          </View>
                        );
                      })}
                    </View>
                  ) : (
                    <Text style={[styles.panelHint, minimal && styles.panelHintMinimal]}>
                      Nenhum tipo de escala ativo cadastrado.
                    </Text>
                  )}
                </>
              ) : null}
            </View>
          ) : (
            <Text style={[styles.profilesEmptyHint, minimal && styles.profilesEmptyHintMinimal]}>
              Busque e selecione um perfil para atribuir papéis.
            </Text>
          )}
        </ScrollView>
      ) : (
        <ScrollView
          style={[styles.tabScroll, minimal && styles.tabScrollMinimal]}
          contentContainerStyle={[
            styles.tabScrollContent,
            minimal && styles.tabScrollContentMinimal,
          ]}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          {...MAINTENANCE_SCROLL_PROPS}
        >
          {focusedResourceGrant ? (
            <>
              <View style={styles.resourceFocusHeader}>
                <TouchableOpacity
                  style={[styles.resourceFocusBackButton, minimal && styles.resourceFocusBackButtonMinimal]}
                  onPress={handleCloseResourceFocus}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel="Voltar para visão por papel"
                >
                  <FontAwesome name="arrow-left" size={14} color={minimal ? MINIMAL_UI.blueDark : '#C7D2FE'} />
                  <Text style={[styles.resourceFocusBackText, minimal && styles.resourceFocusBackTextMinimal]}>
                    Voltar
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={[styles.resourceFocusCard, minimal && styles.resourceFocusCardMinimal]}>
                <View style={styles.resourceFocusTitleRow}>
                  {getAccessGrantDashboardScope(
                    focusedResourceGrant.resourceType,
                    focusedResourceGrant.resourceKey
                  ) ? (
                    <View
                      style={[
                        styles.grantScopeDot,
                        getAccessGrantDashboardScope(
                          focusedResourceGrant.resourceType,
                          focusedResourceGrant.resourceKey
                        ) === 'main'
                          ? styles.grantScopeDotMain
                          : styles.grantScopeDotMaintenance,
                      ]}
                    />
                  ) : null}
                  <View style={styles.resourceFocusTitleMain}>
                    <Text
                      style={[styles.resourceFocusTitle, minimal && styles.resourceFocusTitleMinimal]}
                      numberOfLines={2}
                    >
                      {focusedResourceGrant.label}
                    </Text>
                    {showTechnicalKeys ? (
                      <Text style={[styles.grantKey, minimal && styles.grantKeyMinimal]} numberOfLines={1}>
                        {focusedResourceGrant.resourceKey}
                      </Text>
                    ) : null}
                  </View>
                </View>
                <Text style={[styles.resourceFocusHint, minimal && styles.resourceFocusHintMinimal]}>
                  Selecione quais papéis podem ver e editar este recurso.
                </Text>
              </View>

              {loadingResourceRoleGrants ? (
                <ActivityIndicator
                  color={minimal ? MINIMAL_UI.accent : '#818CF8'}
                  style={styles.inlineLoader}
                />
              ) : (
                <View style={styles.grantsList}>
                  {resourceRoleGrants.map((entry, index) => {
                    const isSaving =
                      savingResourceGrantKey === `${entry.roleCode}:${entry.resourceKey}`;

                    return (
                      <View
                        key={entry.roleId}
                        style={[
                          styles.grantRow,
                          minimal && styles.grantRowMinimal,
                          index % 2 === 1 && styles.grantRowAlt,
                          minimal && index % 2 === 1 && styles.grantRowAltMinimal,
                        ]}
                      >
                        <View style={styles.grantMain}>
                          <Text style={[styles.roleName, minimal && styles.roleNameMinimal]}>
                            {entry.roleName}
                          </Text>
                          <Text style={[styles.roleCode, minimal && styles.roleCodeMinimal]}>
                            {entry.roleCode}
                          </Text>
                        </View>
                        <View style={styles.grantToggles}>
                          <View style={styles.toggleCell}>
                            <Text style={[styles.toggleLabel, minimal && styles.toggleLabelMinimal]}>
                              Ver
                            </Text>
                            <Switch
                              value={entry.canView}
                              onValueChange={(next) =>
                                void handleToggleResourceRoleGrant(entry, 'canView', next)
                              }
                              disabled={busy || rpcMissing || isSaving}
                              trackColor={
                                minimal
                                  ? { false: MINIMAL_UI.divider, true: MINIMAL_UI.blueDark }
                                  : { false: '#334155', true: '#4F46E5' }
                              }
                              thumbColor={minimal ? '#FFFFFF' : '#F8FAFC'}
                            />
                          </View>
                          <View style={styles.toggleCell}>
                            <Text style={[styles.toggleLabel, minimal && styles.toggleLabelMinimal]}>
                              Editar
                            </Text>
                            <Switch
                              value={entry.canUpdate}
                              onValueChange={(next) =>
                                void handleToggleResourceRoleGrant(entry, 'canUpdate', next)
                              }
                              disabled={busy || rpcMissing || isSaving || !entry.canView}
                              trackColor={
                                minimal
                                  ? { false: MINIMAL_UI.divider, true: MINIMAL_UI.blueDark }
                                  : { false: '#334155', true: '#4F46E5' }
                              }
                              thumbColor={minimal ? '#FFFFFF' : '#F8FAFC'}
                            />
                          </View>
                        </View>
                      </View>
                    );
                  })}
                  {!resourceRoleGrants.length ? (
                    <Text style={[styles.panelHint, minimal && styles.panelHintMinimal]}>
                      Nenhum papel cadastrado para este recurso.
                    </Text>
                  ) : null}
                </View>
              )}
            </>
          ) : (
            <>
          {minimal ? (
            <Text style={styles.filterLabelMinimal}>Papel</Text>
          ) : (
            <SectionLabel variant="maintenance" tight>
              Papel
            </SectionLabel>
          )}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.roleChipsScroll}>
            <View style={styles.roleChipsRow}>
              {roles.map((role) => (
                <TouchableOpacity
                  key={role.id}
                  style={[
                    styles.roleChip,
                    minimal && styles.roleChipMinimal,
                    selectedRoleCode === role.code && styles.roleChipActive,
                    minimal && selectedRoleCode === role.code && styles.roleChipActiveMinimal,
                  ]}
                  onPress={() => setSelectedRoleCode(role.code)}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      styles.roleChipText,
                      minimal && styles.roleChipTextMinimal,
                      selectedRoleCode === role.code && styles.roleChipTextActive,
                      minimal && selectedRoleCode === role.code && styles.roleChipTextActiveMinimal,
                    ]}
                  >
                    {role.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <View style={[styles.filterRow, minimal && styles.filterRowMinimal]}>
            {RESOURCE_TYPE_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.filterChip,
                  minimal && styles.filterChipMinimal,
                  resourceTypeFilter === option.value && styles.filterChipActive,
                  minimal && resourceTypeFilter === option.value && styles.filterChipActiveMinimal,
                ]}
                onPress={() => setResourceTypeFilter(option.value)}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    minimal && styles.filterChipTextMinimal,
                    resourceTypeFilter === option.value && styles.filterChipTextActive,
                    minimal && resourceTypeFilter === option.value && styles.filterChipTextActiveMinimal,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {resourceTypeFilter === 'column' ? (
            <Text style={[styles.subsectionHint, minimal && styles.subsectionHintMinimal]}>
              Recursos profiles.* definem quais campos cada papel pode ver e editar em Dados
              cadastrais.
            </Text>
          ) : resourceTypeFilter === 'screen' ? (
            <Text style={[styles.subsectionHint, minimal && styles.subsectionHintMinimal]}>
              {SCREEN_GRANT_SCOPE_HINT}
            </Text>
          ) : null}

          <View style={[styles.grantSearchRow, minimal && styles.grantSearchRowMinimal]}>
            <TextInput
              style={[styles.grantSearchInput, minimal && styles.grantSearchInputMinimal]}
              value={grantSearchQuery}
              onChangeText={setGrantSearchQuery}
              placeholder="Buscar recurso (ex.: relatórios financeiros, /financial)"
              placeholderTextColor={minimal ? MINIMAL_UI.textMuted : '#64748B'}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {hasGrantSearchQuery ? (
              <TouchableOpacity
                style={styles.clearGrantSearchButton}
                onPress={handleClearGrantSearch}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Limpar busca de recursos"
              >
                <FontAwesome name="times-circle" size={20} color={minimal ? MINIMAL_UI.icon : '#94A3B8'} />
              </TouchableOpacity>
            ) : null}
          </View>

          {missingFinancialScreenResources ? (
            <Text style={[styles.financialResourcesHint, minimal && styles.financialResourcesHintMinimal]}>
              Recursos financeiros ausentes no Supabase. Execute scripts/financial-module-access.sql no
              SQL Editor (inclui a RPC garantir_recursos_financeiro_admin). Depois recarregue esta aba.
            </Text>
          ) : null}

          {missingAccessControlScreenResource ? (
            <Text style={[styles.financialResourcesHint, minimal && styles.financialResourcesHintMinimal]}>
              Recurso Controle de Acesso ausente em Papéis → Telas. Execute
              scripts/access-control-admin-rpc.sql no Supabase (RPC garantir_recurso_controle_acesso_admin)
              e recarregue esta aba.
            </Text>
          ) : null}

          {resourceTypeFilter === 'screen' ? (
            <View style={styles.grantScopeLegend}>
              <View style={styles.grantScopeLegendItem}>
                <View style={[styles.grantScopeDot, styles.grantScopeDotMain]} />
                <Text style={[styles.grantScopeLegendText, minimal && styles.grantScopeLegendTextMinimal]}>
                  Produto principal
                </Text>
              </View>
              <View style={styles.grantScopeLegendItem}>
                <View style={[styles.grantScopeDot, styles.grantScopeDotMaintenance]} />
                <Text style={[styles.grantScopeLegendText, minimal && styles.grantScopeLegendTextMinimal]}>
                  Manutenção
                </Text>
              </View>
            </View>
          ) : null}

          {loadingGrants && filteredRoleGrants.length === 0 ? (
            <ActivityIndicator
              color={minimal ? MINIMAL_UI.accent : '#818CF8'}
              style={styles.inlineLoader}
            />
          ) : (
            <View style={styles.grantsList}>
              {filteredRoleGrants.map((grant, index) => {
                const sensitive = isSensitiveAccessResourceKey(grant.resourceKey);
                const isSaving = savingGrantKey === grant.resourceKey;
                const dashboardScope = getAccessGrantDashboardScope(
                  grant.resourceType,
                  grant.resourceKey
                );

                return (
                  <View
                    key={grant.resourceId}
                    style={[
                      styles.grantRow,
                      minimal && styles.grantRowMinimal,
                      index % 2 === 1 && styles.grantRowAlt,
                      minimal && index % 2 === 1 && styles.grantRowAltMinimal,
                    ]}
                  >
                    {dashboardScope ? (
                      <TouchableOpacity
                        style={[
                          styles.grantScopeDotButton,
                          dashboardScope === 'main'
                            ? styles.grantScopeDotMain
                            : styles.grantScopeDotMaintenance,
                        ]}
                        onPress={() => handleOpenResourceFocus(grant)}
                        activeOpacity={0.85}
                        accessibilityRole="button"
                        accessibilityLabel={
                          dashboardScope === 'main'
                            ? 'Abrir permissões por recurso — tela do produto principal'
                            : 'Abrir permissões por recurso — tela de manutenção'
                        }
                      />
                    ) : (
                      <View style={styles.grantScopeDotSpacer} />
                    )}
                    <TouchableOpacity
                      style={styles.grantMain}
                      onPress={() => handleOpenResourceFocus(grant)}
                      activeOpacity={0.85}
                      accessibilityRole="button"
                      accessibilityLabel={`Abrir permissões por recurso — ${grant.label}`}
                    >
                      <Text
                        style={[
                          styles.grantLabel,
                          minimal && styles.grantLabelMinimal,
                          sensitive && styles.grantLabelSensitive,
                          minimal && sensitive && styles.grantLabelSensitiveMinimal,
                        ]}
                        numberOfLines={2}
                      >
                        {grant.label}
                      </Text>
                      {showTechnicalKeys ? (
                        <Text style={[styles.grantKey, minimal && styles.grantKeyMinimal]} numberOfLines={1}>
                          {grant.resourceKey}
                        </Text>
                      ) : null}
                    </TouchableOpacity>
                    <View style={styles.grantToggles}>
                      <View style={styles.toggleCell}>
                        <Text style={[styles.toggleLabel, minimal && styles.toggleLabelMinimal]}>
                          Ver
                        </Text>
                        <Switch
                          value={grant.canView}
                          onValueChange={(next) => void handleToggleGrant(grant, 'canView', next)}
                          disabled={busy || rpcMissing || isSaving}
                          trackColor={
                            minimal
                              ? { false: MINIMAL_UI.divider, true: MINIMAL_UI.blueDark }
                              : { false: '#334155', true: '#4F46E5' }
                          }
                          thumbColor={minimal ? '#FFFFFF' : '#F8FAFC'}
                        />
                      </View>
                      <View style={styles.toggleCell}>
                        <Text style={[styles.toggleLabel, minimal && styles.toggleLabelMinimal]}>
                          Editar
                        </Text>
                        <Switch
                          value={grant.canUpdate}
                          onValueChange={(next) => void handleToggleGrant(grant, 'canUpdate', next)}
                          disabled={busy || rpcMissing || isSaving || !grant.canView}
                          trackColor={
                            minimal
                              ? { false: MINIMAL_UI.divider, true: MINIMAL_UI.blueDark }
                              : { false: '#334155', true: '#4F46E5' }
                          }
                          thumbColor={minimal ? '#FFFFFF' : '#F8FAFC'}
                        />
                      </View>
                    </View>
                  </View>
                );
              })}
              {!roleGrants.length ? (
                <Text style={[styles.panelHint, minimal && styles.panelHintMinimal]}>
                  Nenhum recurso cadastrado para este tipo. Execute scripts/financial-module-access.sql
                  no Supabase se faltar Card Financeiro ou Relatórios financeiros.
                </Text>
              ) : filteredRoleGrants.length === 0 ? (
                <Text style={[styles.panelHint, minimal && styles.panelHintMinimal]}>
                  Nenhum recurso corresponde à busca. Tente &quot;relatórios financeiros&quot;,
                  &quot;/financial&quot; ou &quot;dashboard.card.financial&quot;.
                </Text>
              ) : null}
            </View>
          )}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    padding: 12,
    minHeight: 0,
    gap: 8,
  },
  tabScroll: {
    flex: 1,
    minHeight: 0,
  },
  tabScrollContent: {
    flexGrow: 1,
    paddingBottom: 12,
    gap: 10,
  },
  profilesPickerSection: {
    gap: 8,
  },
  panelCentered: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 20,
  },
  panelHeaderBlock: {
    alignSelf: 'stretch',
    gap: 8,
  },
  panelHeaderControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    alignSelf: 'stretch',
  },
  panelTitleCompact: {
    flexShrink: 1,
    alignSelf: 'flex-start',
    color: '#3A96DD',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'left',
  },
  lgpdRadioToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexShrink: 0,
    alignSelf: 'flex-start',
    minHeight: 36,
  },
  lgpdRadioToggleActive: {
    backgroundColor: 'rgba(37, 99, 235, 0.28)',
    borderColor: '#3B82F6',
  },
  lgpdRadioToggleInactive: {
    backgroundColor: 'rgba(220, 38, 38, 0.24)',
    borderColor: '#EF4444',
  },
  lgpdRadioToggleDisabled: {
    opacity: 0.55,
  },
  lgpdRadioOuter: {
    width: 16,
    height: 16,
    borderRadius: 999,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lgpdRadioOuterActive: {
    borderColor: '#BFDBFE',
  },
  lgpdRadioOuterInactive: {
    borderColor: '#FECACA',
  },
  lgpdRadioInner: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  lgpdRadioInnerActive: {
    backgroundColor: '#60A5FA',
  },
  lgpdRadioInnerInactive: {
    backgroundColor: '#F87171',
  },
  lgpdRadioLabel: {
    fontSize: 12,
    fontWeight: '800',
  },
  lgpdRadioLabelActive: {
    color: '#DBEAFE',
  },
  lgpdRadioLabelInactive: {
    color: '#FECACA',
  },
  appAtivoSection: {
    gap: 10,
    marginBottom: 4,
  },
  appAtivoToggleActive: {
    borderColor: '#6EE7B7',
    backgroundColor: 'rgba(16, 185, 129, 0.18)',
  },
  appAtivoToggleInactive: {
    borderColor: '#FBBF24',
    backgroundColor: 'rgba(245, 158, 11, 0.16)',
  },
  appAtivoRadioOuterActive: {
    borderColor: '#6EE7B7',
  },
  appAtivoRadioOuterInactive: {
    borderColor: '#FBBF24',
  },
  appAtivoRadioInnerActive: {
    backgroundColor: '#6EE7B7',
  },
  appAtivoRadioInnerInactive: {
    backgroundColor: '#FBBF24',
  },
  appAtivoLabelActive: {
    color: '#D1FAE5',
  },
  appAtivoLabelInactive: {
    color: '#FDE68A',
  },
  appInativoMsgBlock: {
    gap: 8,
    paddingHorizontal: 2,
  },
  appInativoMsgLabel: {
    color: '#3A96DD',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  appInativoMsgInput: {
    minHeight: 88,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    color: '#3A96DD',
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlignVertical: 'top',
  },
  appInativoMsgSaveButton: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    backgroundColor: '#6EE7B7',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  appInativoMsgSaveButtonDisabled: {
    opacity: 0.55,
  },
  appInativoMsgSaveButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  panelTitle: {
    color: '#3A96DD',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 2,
  },
  panelSubtitle: {
    color: 'rgba(58, 150, 221, 0.82)',
    fontSize: 11,
    marginBottom: 8,
  },
  panelHint: {
    color: 'rgba(58, 150, 221, 0.82)',
    fontSize: 12,
    lineHeight: 17,
    paddingVertical: 8,
  },
  warningText: {
    color: '#FBBF24',
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 6,
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 12,
    marginBottom: 6,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  tabButton: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingVertical: 8,
    alignItems: 'center',
  },
  tabButtonActive: {
    borderColor: '#6366F1',
    backgroundColor: 'rgba(79, 70, 229, 0.22)',
  },
  tabButtonText: {
    color: 'rgba(58, 150, 221, 0.82)',
    fontSize: 12,
    fontWeight: '700',
  },
  tabButtonTextActive: {
    color: '#3A96DD',
  },
  rolesList: {
    marginTop: 4,
    marginBottom: 4,
  },
  grantsList: {
    marginTop: 4,
  },
  sectionLabel: {
    color: 'rgba(58, 150, 221, 0.82)',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  visitanteHint: {
    color: '#1B4F8A',
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 8,
    fontWeight: '600',
  },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    backgroundColor: 'rgba(30, 41, 59, 0.55)',
    paddingHorizontal: 10,
    paddingVertical: 9,
    marginTop: 8,
  },
  accordionTitle: {
    color: 'rgba(58, 150, 221, 0.82)',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  accordionChevron: {
    color: 'rgba(58, 150, 221, 0.82)',
    fontSize: 10,
    fontWeight: '800',
  },
  subsectionHint: {
    color: 'rgba(58, 150, 221, 0.82)',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 6,
    marginBottom: 8,
  },
  financialResourcesHint: {
    color: '#FCD34D',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  grantSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  grantSearchInput: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    color: '#3A96DD',
    fontSize: 13,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  clearGrantSearchButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    color: '#3A96DD',
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: {
    marginBottom: 4,
  },
  profileDropdown: {
    width: '100%',
    flex: 0,
    flexGrow: 0,
    alignSelf: 'stretch',
    height: 44,
  },
  inlineLoader: {
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  searchHintText: {
    color: 'rgba(58, 150, 221, 0.82)',
    fontSize: 12,
    lineHeight: 16,
  },
  profilesEmptyHint: {
    color: 'rgba(58, 150, 221, 0.82)',
    fontSize: 12,
    lineHeight: 17,
  },
  resultsScroll: {
    maxHeight: 120,
    marginBottom: 8,
  },
  resultRow: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 6,
  },
  resultName: {
    color: '#3A96DD',
    fontSize: 14,
    fontWeight: '700',
  },
  resultMeta: {
    color: 'rgba(58, 150, 221, 0.82)',
    fontSize: 11,
    marginTop: 2,
  },
  selectedCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    padding: 10,
  },
  selectedHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 8,
  },
  selectedMain: {
    flex: 1,
  },
  selectedName: {
    color: '#3A96DD',
    fontSize: 15,
    fontWeight: '800',
  },
  selectedMeta: {
    color: 'rgba(58, 150, 221, 0.82)',
    fontSize: 11,
    marginTop: 2,
  },
  clearLink: {
    color: '#1B4F8A',
    fontSize: 12,
    fontWeight: '700',
  },
  roleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(52, 211, 153, 0.35)',
  },
  roleMain: {
    flex: 1,
    paddingRight: 10,
  },
  roleName: {
    color: '#3A96DD',
    fontSize: 13,
    fontWeight: '700',
  },
  roleCode: {
    color: 'rgba(58, 150, 221, 0.82)',
    fontSize: 11,
    marginTop: 2,
  },
  roleChipsScroll: {
    maxHeight: 42,
  },
  roleChipsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 8,
  },
  roleChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  roleChipActive: {
    borderColor: '#6366F1',
    backgroundColor: 'rgba(79, 70, 229, 0.22)',
  },
  roleChipText: {
    color: 'rgba(58, 150, 221, 0.82)',
    fontSize: 12,
    fontWeight: '700',
  },
  roleChipTextActive: {
    color: '#3A96DD',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingVertical: 7,
    alignItems: 'center',
  },
  filterChipActive: {
    borderColor: '#6366F1',
    backgroundColor: 'rgba(79, 70, 229, 0.22)',
  },
  filterChipText: {
    color: 'rgba(58, 150, 221, 0.82)',
    fontSize: 11,
    fontWeight: '700',
  },
  filterChipTextActive: {
    color: '#3A96DD',
  },
  grantScopeLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 8,
  },
  grantScopeLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  grantScopeLegendText: {
    color: 'rgba(58, 150, 221, 0.82)',
    fontSize: 10,
    fontWeight: '600',
  },
  grantScopeDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    flexShrink: 0,
  },
  grantScopeDotButton: {
    width: 10,
    height: 10,
    borderRadius: 999,
    flexShrink: 0,
  },
  grantScopeDotMain: {
    backgroundColor: '#22D3EE',
    borderWidth: 1,
    borderColor: '#67E8F9',
  },
  grantScopeDotMaintenance: {
    backgroundColor: '#E8A317',
    borderWidth: 1,
    borderColor: '#D97706',
  },
  grantScopeDotSpacer: {
    width: 10,
    flexShrink: 0,
  },
  grantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  grantRowAlt: {
    backgroundColor: 'rgba(30, 41, 59, 0.35)',
  },
  grantMain: {
    flex: 1,
    minWidth: 0,
  },
  grantLabel: {
    color: '#3A96DD',
    fontSize: 12,
    fontWeight: '700',
  },
  grantLabelSensitive: {
    color: '#FBBF24',
  },
  grantKey: {
    color: 'rgba(58, 150, 221, 0.82)',
    fontSize: 10,
    marginTop: 2,
  },
  grantToggles: {
    flexDirection: 'row',
    gap: 8,
  },
  toggleCell: {
    alignItems: 'center',
    gap: 2,
    width: 52,
  },
  toggleLabel: {
    color: 'rgba(58, 150, 221, 0.82)',
    fontSize: 10,
    fontWeight: '700',
  },
  resourceFocusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  resourceFocusBackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#4338CA',
    backgroundColor: 'rgba(79, 70, 229, 0.18)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  resourceFocusBackText: {
    color: '#3A96DD',
    fontSize: 12,
    fontWeight: '800',
  },
  resourceFocusCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    padding: 10,
    gap: 8,
  },
  resourceFocusTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  resourceFocusTitleMain: {
    flex: 1,
    minWidth: 0,
  },
  resourceFocusTitle: {
    color: '#3A96DD',
    fontSize: 15,
    fontWeight: '800',
  },
  resourceFocusHint: {
    color: 'rgba(58, 150, 221, 0.82)',
    fontSize: 12,
    lineHeight: 17,
  },
  panelMinimal: {
    ...CONTAIN_WIDTH,
    paddingHorizontal: 0,
    paddingVertical: 4,
    borderRadius: 0,
    backgroundColor: MINIMAL_UI.background,
    overflow: 'hidden',
  },
  panelHeaderMinimal: {
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    gap: 8,
  },
  sectionTitleMinimal: {
    ...MINIMAL_SECTION_TITLE,
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    paddingHorizontal: 0,
    alignSelf: 'stretch',
  },
  panelHeaderControlsMinimal: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    gap: 8,
  },
  panelHintMinimal: {
    color: MINIMAL_UI.textMuted,
    textAlign: 'center',
  },
  lgpdRadioToggleMinimal: {
    borderColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.background,
  },
  lgpdRadioToggleActiveMinimal: {
    backgroundColor: MINIMAL_UI.blueDark,
    borderColor: MINIMAL_UI.blueDark,
  },
  lgpdRadioToggleInactiveMinimal: {
    backgroundColor: MINIMAL_UI.rowHover,
    borderColor: MINIMAL_UI.border,
  },
  lgpdRadioOuterActiveMinimal: {
    borderColor: MINIMAL_UI.onDark,
  },
  lgpdRadioOuterInactiveMinimal: {
    borderColor: MINIMAL_UI.textMuted,
  },
  lgpdRadioInnerActiveMinimal: {
    backgroundColor: MINIMAL_UI.onDark,
  },
  lgpdRadioInnerInactiveMinimal: {
    backgroundColor: MINIMAL_UI.textMuted,
  },
  lgpdRadioLabelActiveMinimal: {
    color: MINIMAL_UI.onDark,
  },
  lgpdRadioLabelInactiveMinimal: {
    color: MINIMAL_UI.text,
  },
  appAtivoSectionMinimal: {
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
  },
  appAtivoToggleActiveMinimal: {
    backgroundColor: '#ECFDF5',
    borderColor: '#16A34A',
  },
  appAtivoToggleInactiveMinimal: {
    backgroundColor: '#FFFBEB',
    borderColor: '#D97706',
  },
  appAtivoLabelActiveMinimal: {
    color: '#15803D',
  },
  appAtivoLabelInactiveMinimal: {
    color: '#B45309',
  },
  appInativoMsgBlockMinimal: {
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
  },
  appInativoMsgLabelMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  appInativoMsgInputMinimal: {
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    alignSelf: 'stretch',
    borderColor: MINIMAL_UI.border,
    color: MINIMAL_UI.text,
    backgroundColor: MINIMAL_UI.background,
  },
  appInativoMsgSaveButtonMinimal: {
    width: '100%',
    maxWidth: '100%',
    alignSelf: 'stretch',
    backgroundColor: MINIMAL_UI.accent,
    borderWidth: 1,
    borderColor: MINIMAL_UI.blueDark,
  },
  appInativoMsgSaveButtonTextMinimal: {
    color: MINIMAL_UI.onDark,
  },
  tabRowMinimal: {
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
  },
  tabButtonMinimal: {
    borderColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.background,
  },
  tabButtonActiveMinimal: {
    borderColor: MINIMAL_UI.blueDark,
    backgroundColor: MINIMAL_UI.blueDark,
  },
  tabButtonTextMinimal: {
    color: MINIMAL_UI.text,
  },
  tabButtonTextActiveMinimal: {
    color: MINIMAL_UI.onDark,
  },
  tabScrollMinimal: {
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
  },
  tabScrollContentMinimal: {
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
  },
  profileDropdownMinimal: {
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
  },
  grantSearchRowMinimal: {
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
  },
  grantSearchInputMinimal: {
    borderColor: MINIMAL_UI.border,
    color: MINIMAL_UI.text,
    backgroundColor: MINIMAL_UI.background,
  },
  filterLabelMinimal: {
    color: MINIMAL_UI.textMuted,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
    marginTop: 4,
  },
  searchHintTextMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  selectedCardMinimal: {
    ...CONTAIN_WIDTH,
    borderColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.background,
  },
  selectedNameMinimal: {
    color: MINIMAL_UI.blueDark,
  },
  selectedMetaMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  clearLinkMinimal: {
    color: MINIMAL_UI.accent,
  },
  visitanteHintMinimal: {
    color: '#B45309',
  },
  accordionHeaderMinimal: {
    borderColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.rowHover,
  },
  accordionTitleMinimal: {
    color: MINIMAL_UI.textMuted,
    textTransform: 'none',
    letterSpacing: 0,
    fontSize: 12,
  },
  accordionChevronMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  roleRowMinimal: {
    borderBottomColor: MINIMAL_UI.divider,
  },
  roleNameMinimal: {
    color: MINIMAL_UI.text,
  },
  roleCodeMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  subsectionHintMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  profilesEmptyHintMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  resourceFocusBackButtonMinimal: {
    borderColor: MINIMAL_UI.blueDark,
    backgroundColor: MINIMAL_UI.background,
  },
  resourceFocusBackTextMinimal: {
    color: MINIMAL_UI.blueDark,
  },
  resourceFocusCardMinimal: {
    ...CONTAIN_WIDTH,
    borderColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.background,
  },
  resourceFocusTitleMinimal: {
    color: MINIMAL_UI.blueDark,
  },
  resourceFocusHintMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  grantRowMinimal: {
    borderRadius: 10,
  },
  grantRowAltMinimal: {
    backgroundColor: MINIMAL_UI.rowHover,
  },
  toggleLabelMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  roleChipMinimal: {
    borderColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.background,
  },
  roleChipActiveMinimal: {
    borderColor: MINIMAL_UI.blueDark,
    backgroundColor: MINIMAL_UI.blueDark,
  },
  roleChipTextMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  roleChipTextActiveMinimal: {
    color: MINIMAL_UI.onDark,
  },
  filterRowMinimal: {
    ...CONTAIN_WIDTH,
  },
  filterChipMinimal: {
    borderColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.background,
  },
  filterChipActiveMinimal: {
    borderColor: MINIMAL_UI.blueDark,
    backgroundColor: MINIMAL_UI.blueDark,
  },
  filterChipTextMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  filterChipTextActiveMinimal: {
    color: MINIMAL_UI.onDark,
  },
  financialResourcesHintMinimal: {
    color: '#B45309',
  },
  grantScopeLegendTextMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  grantLabelMinimal: {
    color: MINIMAL_UI.text,
  },
  grantLabelSensitiveMinimal: {
    color: '#B45309',
  },
  grantKeyMinimal: {
    color: MINIMAL_UI.textMuted,
  },
});

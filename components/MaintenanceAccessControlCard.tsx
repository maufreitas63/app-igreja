import { CardLoadingState } from '@/components/ui/CardLoadingState';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { FINANCIAL_ACCESS_SCREEN_RESOURCE_KEYS } from '@/lib/accessControl';
import {
  compareRoleGrantScreenScope,
  getAccessGrantDashboardScope,
  MAINTENANCE_ACCESS_CONTROL_SQL_HINT,
  isSensitiveAccessResourceKey,
} from '@/lib/maintenanceAccessControlApi';
import { useMaintenanceAccessControl } from '@/hooks/useMaintenanceAccessControl';
import {
  computeMaintenanceContentHeight,
  MAINTENANCE_SCROLL_PROPS,
  maintenancePanelStyles,
} from '@/lib/maintenanceCardStyles';
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
};

type AdminTab = 'profiles' | 'roles';
type ProfileDetailSection = 'roles' | 'scaleLeadership';

const RESOURCE_TYPE_OPTIONS = [
  { value: 'screen' as const, label: 'Telas' },
  { value: 'table' as const, label: 'Tabelas' },
  { value: 'column' as const, label: 'Colunas' },
];

const SCREEN_GRANT_SCOPE_HINT =
  'Azul celeste: telas do produto principal. Amarelo cobre: telas de manutenção. A lista agrupa todos os azuis antes dos amarelos.';

export function MaintenanceAccessControlCard({ isActive = true, panelHeight }: Props) {
  const [activeTab, setActiveTab] = useState<AdminTab>('profiles');
  const [grantSearchQuery, setGrantSearchQuery] = useState('');
  const [expandedProfileSection, setExpandedProfileSection] = useState<ProfileDetailSection | null>(
    null
  );
  const {
    isSuperAdmin,
    roles,
    profileSearchQuery,
    setProfileSearchQuery,
    profileSearchResults,
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
    searchingProfiles,
    loadingProfileRoles,
    loadingGrants,
    savingRoleCode,
    savingGrantKey,
    error,
    missingExpectedRoles,
    rpcMissing,
    selectProfile,
    clearSelectedProfile,
    toggleProfileRole,
    toggleScaleLeadership,
    updateRoleGrant,
  } = useMaintenanceAccessControl(isActive);

  const contentHeight = computeMaintenanceContentHeight(panelHeight);
  const busy =
    savingRoleCode !== null || savingGrantKey !== null || savingScaleLeadershipId !== null;
  const hasAssignedProfileRoles = profileRoles.some((role) => role.assigned);

  const hasGrantSearchQuery = grantSearchQuery.trim().length > 0;

  const handleClearGrantSearch = () => {
    setGrantSearchQuery('');
  };

  const missingFinancialScreenResources = useMemo(() => {
    if (resourceTypeFilter !== 'screen' || loadingGrants) {
      return false;
    }

    const registeredKeys = new Set(roleGrants.map((grant) => grant.resourceKey));

    return FINANCIAL_ACCESS_SCREEN_RESOURCE_KEYS.some((key) => !registeredKeys.has(key));
  }, [loadingGrants, resourceTypeFilter, roleGrants]);

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
    grant: (typeof roleGrants)[number],
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

  if (loading) {
    return (
      <View style={[styles.panel, maintenancePanelStyles.panelCentered, { height: contentHeight }]}>
        <CardLoadingState lines={4} />
        <Text style={maintenancePanelStyles.panelHint}>Carregando controle de acesso…</Text>
      </View>
    );
  }

  if (isSuperAdmin === false) {
    return (
      <View style={[styles.panel, maintenancePanelStyles.panelCentered, { height: contentHeight }]}>
        <Text style={maintenancePanelStyles.panelTitle}>Controle de Acesso</Text>
        <Text style={maintenancePanelStyles.panelHint}>
          Apenas perfis com o papel super_admin podem gerenciar permissões.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.panel, { height: contentHeight }]}>
      <Text style={maintenancePanelStyles.panelTitle}>Controle de Acesso</Text>
      <View style={maintenancePanelStyles.panelSubtitleSpacer} />

      {rpcMissing ? <Text style={styles.warningText}>{MAINTENANCE_ACCESS_CONTROL_SQL_HINT}</Text> : null}
      {!rpcMissing && missingExpectedRoles.length > 0 ? (
        <Text style={styles.warningText}>
          Papéis ausentes no Supabase: {missingExpectedRoles.join(', ')}. Execute{' '}
          scripts/access-control-congregado-visitantes-roles.sql e recarregue a tela.
        </Text>
      ) : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'profiles' && styles.tabButtonActive]}
          onPress={() => setActiveTab('profiles')}
          activeOpacity={0.85}
        >
          <Text style={[styles.tabButtonText, activeTab === 'profiles' && styles.tabButtonTextActive]}>
            Perfis
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'roles' && styles.tabButtonActive]}
          onPress={() => setActiveTab('roles')}
          activeOpacity={0.85}
        >
          <Text style={[styles.tabButtonText, activeTab === 'roles' && styles.tabButtonTextActive]}>
            Papéis
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'profiles' ? (
        <ScrollView
          style={styles.tabScroll}
          contentContainerStyle={styles.tabScrollContent}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          {...MAINTENANCE_SCROLL_PROPS}
        >
          <SectionLabel variant="maintenance">Buscar perfil</SectionLabel>
          <TextInput
            style={[styles.input, styles.searchInput]}
            placeholder="Nome, telefone ou código (mín. 2 letras)"
            placeholderTextColor="#64748B"
            value={profileSearchQuery}
            onChangeText={setProfileSearchQuery}
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="search"
            editable={!rpcMissing}
          />

          {searchingProfiles ? <CardLoadingState lines={2} compact /> : null}

          {profileSearchQuery.trim().length >= 2 && !searchingProfiles ? (
            profileSearchResults.length > 0 ? (
              <ScrollView style={styles.resultsScroll} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                {profileSearchResults.map((profile) => (
                  <TouchableOpacity
                    key={profile.id}
                    style={styles.resultRow}
                    onPress={() => void selectProfile(profile)}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.resultName} numberOfLines={1}>
                      {profile.fullName}
                    </Text>
                    <Text style={styles.resultMeta} numberOfLines={1}>
                      {[profile.phone, profile.memberCode].filter(Boolean).join(' · ')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : (
              <Text style={styles.searchHintText}>Nenhum perfil encontrado.</Text>
            )
          ) : (
            <Text style={styles.searchHintText}>Digite pelo menos 2 letras para buscar.</Text>
          )}

          {selectedProfile ? (
            <View style={styles.selectedCard}>
              <View style={styles.selectedHeader}>
                <View style={styles.selectedMain}>
                  <Text style={styles.selectedName} numberOfLines={2}>
                    {selectedProfile.fullName}
                  </Text>
                  <Text style={styles.selectedMeta} numberOfLines={1}>
                    {[selectedProfile.phone, selectedProfile.memberCode].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                <TouchableOpacity onPress={clearSelectedProfile} activeOpacity={0.85}>
                  <Text style={styles.clearLink}>Limpar</Text>
                </TouchableOpacity>
              </View>

              {!loadingProfileRoles && !hasAssignedProfileRoles ? (
                <Text style={styles.visitanteHint}>
                  Sem papéis atribuídos — este perfil é tratado automaticamente como visitante.
                </Text>
              ) : null}

              <TouchableOpacity
                style={styles.accordionHeader}
                onPress={() => toggleProfileSection('roles')}
                activeOpacity={0.85}
              >
                <Text style={styles.accordionTitle}>Papéis do perfil</Text>
                <Text style={styles.accordionChevron}>
                  {expandedProfileSection === 'roles' ? '▼' : '▶'}
                </Text>
              </TouchableOpacity>

              {expandedProfileSection === 'roles' ? (
                loadingProfileRoles ? (
                  <ActivityIndicator color="#818CF8" style={styles.inlineLoader} />
                ) : (
                  <View style={styles.rolesList}>
                    {profileRoles.map((role) => {
                      const isSaving = savingRoleCode === role.roleCode;

                      return (
                        <View key={role.roleId} style={styles.roleRow}>
                          <View style={styles.roleMain}>
                            <Text style={styles.roleName}>{role.roleName}</Text>
                            <Text style={styles.roleCode}>{role.roleCode}</Text>
                          </View>
                          <Switch
                            value={role.assigned}
                            onValueChange={(next) => void handleToggleRole(role.roleCode, next)}
                            disabled={busy || rpcMissing || isSaving}
                            trackColor={{ false: '#334155', true: '#4F46E5' }}
                            thumbColor="#F8FAFC"
                          />
                        </View>
                      );
                    })}
                  </View>
                )
              ) : null}

              <TouchableOpacity
                style={styles.accordionHeader}
                onPress={() => toggleProfileSection('scaleLeadership')}
                activeOpacity={0.85}
              >
                <Text style={styles.accordionTitle}>Liderança por tipo de escala</Text>
                <Text style={styles.accordionChevron}>
                  {expandedProfileSection === 'scaleLeadership' ? '▼' : '▶'}
                </Text>
              </TouchableOpacity>

              {expandedProfileSection === 'scaleLeadership' ? (
                <>
                  <Text style={styles.subsectionHint}>
                    Ative os tipos que este perfil pode gerenciar (requer papel lider).
                  </Text>

                  {loadingScaleLeadership ? (
                    <ActivityIndicator color="#818CF8" style={styles.inlineLoader} />
                  ) : profileScaleLeadership.length > 0 ? (
                    <View style={styles.rolesList}>
                      {profileScaleLeadership.map((entry) => {
                        const isSaving = savingScaleLeadershipId === entry.scaleTypeId;

                        return (
                          <View key={entry.scaleTypeId} style={styles.roleRow}>
                            <View style={styles.roleMain}>
                              <Text style={styles.roleName}>{entry.scaleTypeName}</Text>
                              <Text style={styles.roleCode}>{entry.scaleTypeCode}</Text>
                            </View>
                            <Switch
                              value={entry.assigned}
                              onValueChange={(next) =>
                                void handleToggleScaleLeadership(entry.scaleTypeId, next)
                              }
                              disabled={busy || rpcMissing || isSaving}
                              trackColor={{ false: '#334155', true: '#4F46E5' }}
                              thumbColor="#F8FAFC"
                            />
                          </View>
                        );
                      })}
                    </View>
                  ) : (
                    <Text style={styles.panelHint}>Nenhum tipo de escala ativo cadastrado.</Text>
                  )}
                </>
              ) : null}
            </View>
          ) : (
            <Text style={styles.panelHint}>Busque e selecione um perfil para atribuir papéis.</Text>
          )}
        </ScrollView>
      ) : (
        <ScrollView
          style={styles.tabScroll}
          contentContainerStyle={styles.tabScrollContent}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          {...MAINTENANCE_SCROLL_PROPS}
        >
          <SectionLabel variant="maintenance">Papel</SectionLabel>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.roleChipsScroll}>
            <View style={styles.roleChipsRow}>
              {roles.map((role) => (
                <TouchableOpacity
                  key={role.id}
                  style={[styles.roleChip, selectedRoleCode === role.code && styles.roleChipActive]}
                  onPress={() => setSelectedRoleCode(role.code)}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      styles.roleChipText,
                      selectedRoleCode === role.code && styles.roleChipTextActive,
                    ]}
                  >
                    {role.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <View style={styles.filterRow}>
            {RESOURCE_TYPE_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.filterChip,
                  resourceTypeFilter === option.value && styles.filterChipActive,
                ]}
                onPress={() => setResourceTypeFilter(option.value)}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    resourceTypeFilter === option.value && styles.filterChipTextActive,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {resourceTypeFilter === 'column' ? (
            <Text style={styles.subsectionHint}>
              Recursos profiles.* definem quais campos cada papel pode ver e editar em Dados
              cadastrais.
            </Text>
          ) : resourceTypeFilter === 'screen' ? (
            <Text style={styles.subsectionHint}>{SCREEN_GRANT_SCOPE_HINT}</Text>
          ) : null}

          <View style={styles.grantSearchRow}>
            <TextInput
              style={styles.grantSearchInput}
              value={grantSearchQuery}
              onChangeText={setGrantSearchQuery}
              placeholder="Buscar recurso (ex.: relatórios financeiros, /financial)"
              placeholderTextColor="#64748B"
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
                <FontAwesome name="times-circle" size={20} color="#94A3B8" />
              </TouchableOpacity>
            ) : null}
          </View>

          {missingFinancialScreenResources ? (
            <Text style={styles.financialResourcesHint}>
              Recursos financeiros ausentes no Supabase. Execute scripts/financial-module-access.sql no
              SQL Editor (inclui a RPC garantir_recursos_financeiro_admin). Depois recarregue esta aba.
            </Text>
          ) : null}

          {resourceTypeFilter === 'screen' ? (
            <View style={styles.grantScopeLegend}>
              <View style={styles.grantScopeLegendItem}>
                <View style={[styles.grantScopeDot, styles.grantScopeDotMain]} />
                <Text style={styles.grantScopeLegendText}>Produto principal</Text>
              </View>
              <View style={styles.grantScopeLegendItem}>
                <View style={[styles.grantScopeDot, styles.grantScopeDotMaintenance]} />
                <Text style={styles.grantScopeLegendText}>Manutenção</Text>
              </View>
            </View>
          ) : null}

          {loadingGrants && filteredRoleGrants.length === 0 ? (
            <ActivityIndicator color="#818CF8" style={styles.inlineLoader} />
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
                    style={[styles.grantRow, index % 2 === 1 && styles.grantRowAlt]}
                  >
                    {dashboardScope ? (
                      <View
                        style={[
                          styles.grantScopeDot,
                          dashboardScope === 'main'
                            ? styles.grantScopeDotMain
                            : styles.grantScopeDotMaintenance,
                        ]}
                        accessibilityLabel={
                          dashboardScope === 'main'
                            ? 'Tela do produto principal'
                            : 'Tela de manutenção'
                        }
                      />
                    ) : (
                      <View style={styles.grantScopeDotSpacer} />
                    )}
                    <View style={styles.grantMain}>
                      <Text
                        style={[styles.grantLabel, sensitive && styles.grantLabelSensitive]}
                        numberOfLines={2}
                      >
                        {grant.label}
                      </Text>
                      <Text style={styles.grantKey} numberOfLines={1}>
                        {grant.resourceKey}
                      </Text>
                    </View>
                    <View style={styles.grantToggles}>
                      <View style={styles.toggleCell}>
                        <Text style={styles.toggleLabel}>Ver</Text>
                        <Switch
                          value={grant.canView}
                          onValueChange={(next) => void handleToggleGrant(grant, 'canView', next)}
                          disabled={busy || rpcMissing || isSaving}
                          trackColor={{ false: '#334155', true: '#4F46E5' }}
                          thumbColor="#F8FAFC"
                        />
                      </View>
                      <View style={styles.toggleCell}>
                        <Text style={styles.toggleLabel}>Editar</Text>
                        <Switch
                          value={grant.canUpdate}
                          onValueChange={(next) => void handleToggleGrant(grant, 'canUpdate', next)}
                          disabled={busy || rpcMissing || isSaving || !grant.canView}
                          trackColor={{ false: '#334155', true: '#4F46E5' }}
                          thumbColor="#F8FAFC"
                        />
                      </View>
                    </View>
                  </View>
                );
              })}
              {!roleGrants.length ? (
                <Text style={styles.panelHint}>
                  Nenhum recurso cadastrado para este tipo. Execute scripts/financial-module-access.sql
                  no Supabase se faltar Card Financeiro ou Relatórios financeiros.
                </Text>
              ) : filteredRoleGrants.length === 0 ? (
                <Text style={styles.panelHint}>
                  Nenhum recurso corresponde à busca. Tente &quot;relatórios financeiros&quot;,
                  &quot;/financial&quot; ou &quot;dashboard.card.financial&quot;.
                </Text>
              ) : null}
            </View>
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
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    padding: 12,
    minHeight: 0,
    gap: 4,
  },
  tabScroll: {
    flex: 1,
    minHeight: 0,
  },
  tabScrollContent: {
    flexGrow: 1,
    paddingBottom: 12,
  },
  panelCentered: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 20,
  },
  panelTitle: {
    color: '#E2E8F0',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 2,
  },
  panelSubtitle: {
    color: '#64748B',
    fontSize: 11,
    marginBottom: 8,
  },
  panelHint: {
    color: '#94A3B8',
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
    borderColor: '#334155',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingVertical: 8,
    alignItems: 'center',
  },
  tabButtonActive: {
    borderColor: '#6366F1',
    backgroundColor: 'rgba(79, 70, 229, 0.22)',
  },
  tabButtonText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
  },
  tabButtonTextActive: {
    color: '#E0E7FF',
  },
  rolesList: {
    marginTop: 4,
    marginBottom: 4,
  },
  grantsList: {
    marginTop: 4,
  },
  sectionLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  visitanteHint: {
    color: '#7DD3FC',
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
    borderColor: '#334155',
    backgroundColor: 'rgba(30, 41, 59, 0.55)',
    paddingHorizontal: 10,
    paddingVertical: 9,
    marginTop: 8,
  },
  accordionTitle: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  accordionChevron: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '800',
  },
  subsectionHint: {
    color: '#64748B',
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
    marginBottom: 8,
  },
  grantSearchInput: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderColor: 'rgba(129, 140, 248, 0.35)',
    borderRadius: 10,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    color: '#E2E8F0',
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
    borderColor: '#334155',
    borderRadius: 10,
    backgroundColor: '#0f172a',
    color: '#F8FAFC',
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: {
    marginBottom: 4,
  },
  inlineLoader: {
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  searchHintText: {
    color: '#64748B',
    fontSize: 12,
    marginBottom: 8,
  },
  resultsScroll: {
    maxHeight: 120,
    marginBottom: 8,
  },
  resultRow: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 6,
  },
  resultName: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
  },
  resultMeta: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  selectedCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
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
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '800',
  },
  selectedMeta: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  clearLink: {
    color: '#A5B4FC',
    fontSize: 12,
    fontWeight: '700',
  },
  roleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#334155',
  },
  roleMain: {
    flex: 1,
    paddingRight: 10,
  },
  roleName: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '700',
  },
  roleCode: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 2,
  },
  inlineLoader: {
    marginVertical: 12,
  },
  roleChipsScroll: {
    marginBottom: 8,
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
    borderColor: '#334155',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  roleChipActive: {
    borderColor: '#6366F1',
    backgroundColor: 'rgba(79, 70, 229, 0.22)',
  },
  roleChipText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
  },
  roleChipTextActive: {
    color: '#E0E7FF',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  filterChip: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingVertical: 7,
    alignItems: 'center',
  },
  filterChipActive: {
    borderColor: '#6366F1',
    backgroundColor: 'rgba(79, 70, 229, 0.22)',
  },
  filterChipText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
  },
  filterChipTextActive: {
    color: '#E0E7FF',
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
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '600',
  },
  grantScopeDot: {
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
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '700',
  },
  grantLabelSensitive: {
    color: '#FBBF24',
  },
  grantKey: {
    color: '#64748B',
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
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
  },
});

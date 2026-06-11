import { CardLoadingState } from '@/components/ui/CardLoadingState';
import { SectionLabel } from '@/components/ui/SectionLabel';
import {
  PASTORAL_BASIC_ROLE_OPTIONS,
  useMaintenancePastoralRoleChange,
} from '@/hooks/useMaintenancePastoralRoleChange';
import { formatShortName } from '@/lib/formatShortName';
import { computeMaintenanceContentHeight, maintenancePanelStyles } from '@/lib/maintenanceCardStyles';
import React from 'react';
import Toast from 'react-native-toast-message';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

type Props = {
  isActive?: boolean;
  panelHeight: number;
};

const ACCENT = '#F472B6';

export function MaintenancePastoralRoleChangeCard({ isActive = true, panelHeight }: Props) {
  const {
    searchQuery,
    setSearchQuery,
    roleFilter,
    toggleRoleFilter,
    allProfiles,
    profiles,
    loading,
    savingProfileId,
    error,
    updateProfileRole,
  } = useMaintenancePastoralRoleChange(isActive);

  const contentHeight = computeMaintenanceContentHeight(panelHeight);
  const hasActiveFilters = searchQuery.trim().length > 0 || roleFilter !== null;

  const handleSelectRole = async (profileId: string, roleCode: (typeof PASTORAL_BASIC_ROLE_OPTIONS)[number]['code']) => {
    const result = await updateProfileRole(profileId, roleCode);

    Toast.show({
      type: result.success ? 'success' : 'error',
      text1: 'Mudança de Papéis',
      text2: result.message,
      visibilityTime: 3500,
    });
  };

  return (
    <View style={[styles.panel, { height: contentHeight }]}>
      <Text style={maintenancePanelStyles.panelTitle}>Mudança de Papéis</Text>
      <View style={maintenancePanelStyles.panelSubtitleSpacer} />

      <Text style={styles.helpText}>
        Lista completa de perfis elegíveis. Use a busca para filtrar por nome, telefone ou código.
        Toque nos cabeçalhos Visitante, Congregado ou Membro para filtrar pelo papel atual.
      </Text>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <SectionLabel variant="maintenance">Filtrar lista</SectionLabel>
      <TextInput
        style={styles.searchInput}
        placeholder="Nome, telefone ou código"
        placeholderTextColor="#64748B"
        value={searchQuery}
        onChangeText={setSearchQuery}
        autoCapitalize="words"
        autoCorrect={false}
        returnKeyType="search"
      />

      {loading ? <CardLoadingState lines={2} compact /> : null}

      {!loading && allProfiles.length > 0 ? (
        <Text style={styles.countText}>
          {hasActiveFilters
            ? `${profiles.length} de ${allProfiles.length} perfis`
            : `${allProfiles.length} perfis`}
        </Text>
      ) : null}

      {!loading && allProfiles.length === 0 ? (
        <Text style={styles.hintText}>Nenhum perfil elegível encontrado.</Text>
      ) : null}

      {!loading && allProfiles.length > 0 && profiles.length === 0 ? (
        <Text style={styles.hintText}>Nenhum perfil corresponde aos filtros.</Text>
      ) : null}

      {!loading && profiles.length > 0 ? (
        <View style={styles.tableSection}>
          <View style={styles.tableHeader}>
            <Text style={[styles.headerCell, styles.nameColumn]}>Nome curto</Text>
            {PASTORAL_BASIC_ROLE_OPTIONS.map((option) => {
              const isActiveFilter = roleFilter === option.code;

              return (
                <TouchableOpacity
                  key={option.code}
                  style={[styles.roleHeaderButton, isActiveFilter && styles.roleHeaderButtonActive]}
                  onPress={() => toggleRoleFilter(option.code)}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActiveFilter }}
                  accessibilityLabel={`Filtrar por ${option.label}`}
                >
                  <Text style={[styles.roleHeaderCell, isActiveFilter && styles.roleHeaderCellActive]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <ScrollView
            style={styles.tableScroll}
            contentContainerStyle={styles.tableContent}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
          >
          {profiles.map((profile) => {
            const isSaving = savingProfileId === profile.id;

            return (
              <View key={profile.id} style={styles.tableRow}>
                <View style={styles.nameColumn}>
                  <Text style={styles.shortName} numberOfLines={2}>
                    {formatShortName(profile.fullName)}
                  </Text>
                  {isSaving ? <ActivityIndicator color={ACCENT} size="small" /> : null}
                </View>

                {PASTORAL_BASIC_ROLE_OPTIONS.map((option) => {
                  const selected = profile.currentRoleCode === option.code;

                  return (
                    <TouchableOpacity
                      key={`${profile.id}-${option.code}`}
                      style={[
                        styles.roleChip,
                        selected && styles.roleChipSelected,
                        isSaving && styles.roleChipDisabled,
                      ]}
                      onPress={() => void handleSelectRole(profile.id, option.code)}
                      disabled={isSaving || selected}
                      activeOpacity={0.85}
                      accessibilityRole="radio"
                      accessibilityState={{ selected, disabled: isSaving || selected }}
                    >
                      <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
                        {selected ? <View style={styles.radioInner} /> : null}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            );
          })}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    flex: 1,
  },
  helpText: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 13,
    marginBottom: 8,
  },
  hintText: {
    color: '#94A3B8',
    fontSize: 13,
    fontStyle: 'italic',
  },
  countText: {
    color: '#94A3B8',
    fontSize: 12,
    marginBottom: 8,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.35)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#F8FAFC',
    fontSize: 14,
    marginBottom: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  tableSection: {
    flex: 1,
    minHeight: 0,
  },
  tableScroll: {
    flex: 1,
  },
  tableContent: {
    paddingBottom: 16,
    gap: 8,
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148, 163, 184, 0.35)',
    backgroundColor: 'rgba(15, 23, 42, 0.96)',
    zIndex: 2,
  },
  headerCell: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '800',
  },
  roleHeaderButton: {
    width: 72,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    borderRadius: 8,
  },
  roleHeaderButtonActive: {
    backgroundColor: 'rgba(244, 114, 182, 0.18)',
  },
  roleHeaderCell: {
    textAlign: 'center',
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '800',
  },
  roleHeaderCellActive: {
    color: ACCENT,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148, 163, 184, 0.15)',
  },
  nameColumn: {
    flex: 1,
    minWidth: 110,
    gap: 4,
  },
  shortName: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
  },
  roleChip: {
    width: 72,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  roleChipSelected: {
    opacity: 1,
  },
  roleChipDisabled: {
    opacity: 0.6,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#64748B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: {
    borderColor: ACCENT,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: ACCENT,
  },
});

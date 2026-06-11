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
    profiles,
    loading,
    savingProfileId,
    error,
    updateProfileRole,
  } = useMaintenancePastoralRoleChange(isActive);

  const contentHeight = computeMaintenanceContentHeight(panelHeight);

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
        Busque por nome e defina um único papel básico: Visitante, Congregado ou Membro.
      </Text>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <SectionLabel variant="maintenance">Buscar por nome</SectionLabel>
      <TextInput
        style={styles.searchInput}
        placeholder="Nome, telefone ou código (mín. 2 letras)"
        placeholderTextColor="#64748B"
        value={searchQuery}
        onChangeText={setSearchQuery}
        autoCapitalize="words"
        autoCorrect={false}
        returnKeyType="search"
      />

      {loading ? <CardLoadingState lines={2} compact /> : null}

      {searchQuery.trim().length < 2 && !loading ? (
        <Text style={styles.hintText}>Digite pelo menos 2 letras para buscar.</Text>
      ) : null}

      {searchQuery.trim().length >= 2 && !loading && profiles.length === 0 ? (
        <Text style={styles.hintText}>Nenhum perfil encontrado.</Text>
      ) : null}

      {profiles.length > 0 ? (
        <ScrollView style={styles.tableScroll} contentContainerStyle={styles.tableContent}>
          <View style={styles.tableHeader}>
            <Text style={[styles.headerCell, styles.nameColumn]}>Nome curto</Text>
            {PASTORAL_BASIC_ROLE_OPTIONS.map((option) => (
              <Text key={option.code} style={styles.roleHeaderCell}>
                {option.label}
              </Text>
            ))}
          </View>

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
  searchInput: {
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.35)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#F8FAFC',
    fontSize: 14,
    marginBottom: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
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
  },
  headerCell: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '800',
  },
  roleHeaderCell: {
    width: 72,
    textAlign: 'center',
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '800',
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

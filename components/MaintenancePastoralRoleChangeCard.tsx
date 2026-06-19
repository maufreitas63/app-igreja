import { CardLoadingState } from '@/components/ui/CardLoadingState';
import { SectionLabel } from '@/components/ui/SectionLabel';
import {
  PASTORAL_BASIC_ROLE_OPTIONS,
  useMaintenancePastoralRoleChange,
} from '@/hooks/useMaintenancePastoralRoleChange';
import { formatShortName } from '@/lib/formatShortName';
import { computeMaintenanceContentHeight, maintenancePanelStyles } from '@/lib/maintenanceCardStyles';
import React, { useState } from 'react';
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

type MemberDateEditorState = {
  profileId: string;
  profileName: string;
  dateInput: string;
  error: string | null;
};

const formatMembershipDateInput = (value: string) => {
  const cleaned = value.replace(/\D/g, '').slice(0, 6);

  if (cleaned.length <= 2) {
    return cleaned;
  }

  if (cleaned.length <= 4) {
    return `${cleaned.slice(0, 2)}/${cleaned.slice(2)}`;
  }

  return `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}/${cleaned.slice(4, 6)}`;
};

const formatMembershipDateFromIso = (value: string | null | undefined) => {
  const match = value?.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (!match) {
    return '';
  }

  const [, year, month, day] = match;
  return `${day}/${month}/${year.slice(2)}`;
};

const parseMembershipDateInputToIso = (value: string) => {
  const match = /^(\d{2})\/(\d{2})\/(\d{2})$/.exec(value.trim());

  if (!match) {
    return null;
  }

  const day = Number(match[1]);
  const month = Number(match[2]);
  const shortYear = Number(match[3]);
  const currentYear = new Date().getFullYear();
  let year = Math.floor(currentYear / 100) * 100 + shortYear;

  if (year > currentYear + 1) {
    year -= 100;
  }

  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year
    || date.getMonth() !== month - 1
    || date.getDate() !== day
  ) {
    return null;
  }

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

export function MaintenancePastoralRoleChangeCard({ isActive = true, panelHeight }: Props) {
  const [memberDateEditor, setMemberDateEditor] = useState<MemberDateEditorState | null>(null);
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
    setMemberDateEditor(null);
    const result = await updateProfileRole(profileId, roleCode);

    Toast.show({
      type: result.success ? 'success' : 'error',
      text1: 'Mudança de Papéis',
      text2: result.message,
      visibilityTime: 3500,
    });
  };

  const handleOpenMemberDateEditor = (profile: (typeof profiles)[number]) => {
    setMemberDateEditor({
      profileId: profile.id,
      profileName: formatShortName(profile.fullName),
      dateInput: formatMembershipDateFromIso(profile.membershipDate),
      error: null,
    });
  };

  const handleChangeMemberDateInput = (value: string) => {
    setMemberDateEditor((current) =>
      current
        ? {
            ...current,
            dateInput: formatMembershipDateInput(value),
            error: null,
          }
        : current
    );
  };

  const handleSaveMemberDate = async () => {
    if (!memberDateEditor) {
      return;
    }

    const membershipDateIso = parseMembershipDateInputToIso(memberDateEditor.dateInput);

    if (!membershipDateIso) {
      setMemberDateEditor((current) =>
        current
          ? {
              ...current,
              error: 'Informe uma data válida no formato dd/mm/aa.',
            }
          : current
      );
      return;
    }

    const result = await updateProfileRole(memberDateEditor.profileId, 'member', membershipDateIso);

    Toast.show({
      type: result.success ? 'success' : 'error',
      text1: 'Mudança de Papéis',
      text2: result.message,
      visibilityTime: 3500,
    });

    if (result.success) {
      setMemberDateEditor(null);
    }
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

      {!loading && allProfiles.length > 0 ? (
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
            {profiles.length === 0 ? (
              <Text style={styles.emptyFilterText}>Nenhum perfil corresponde aos filtros.</Text>
            ) : (
              profiles.map((profile) => {
                const isSaving = savingProfileId === profile.id;
                const isEditingMembershipDate = memberDateEditor?.profileId === profile.id;

                return (
                  <React.Fragment key={profile.id}>
                    <View style={styles.tableRow}>
                      <View style={styles.nameColumn}>
                        <Text style={styles.shortName} numberOfLines={2}>
                          {formatShortName(profile.fullName)}
                        </Text>
                        {isSaving ? <ActivityIndicator color={ACCENT} size="small" /> : null}
                      </View>

                      {PASTORAL_BASIC_ROLE_OPTIONS.map((option) => {
                        const selected = profile.currentRoleCode === option.code;
                        const isMemberRole = option.code === 'member';
                        const disabled = isSaving || (selected && !isMemberRole);

                        return (
                          <TouchableOpacity
                            key={`${profile.id}-${option.code}`}
                            style={[
                              styles.roleChip,
                              selected && styles.roleChipSelected,
                              disabled && styles.roleChipDisabled,
                            ]}
                            onPress={() => {
                              if (isMemberRole) {
                                handleOpenMemberDateEditor(profile);
                                return;
                              }

                              void handleSelectRole(profile.id, option.code);
                            }}
                            disabled={disabled}
                            activeOpacity={0.85}
                            accessibilityRole="radio"
                            accessibilityState={{ selected, disabled }}
                            accessibilityLabel={
                              isMemberRole
                                ? `Informar data de membro para ${profile.fullName}`
                                : `Definir ${profile.fullName} como ${option.label}`
                            }
                          >
                            <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
                              {selected ? <View style={styles.radioInner} /> : null}
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {isEditingMembershipDate && memberDateEditor ? (
                      <View style={styles.memberDateBubble}>
                        <View style={styles.memberDateBubbleArrow} />
                        <Text style={styles.memberDateTitle}>Data de membro</Text>
                        <Text style={styles.memberDateHelp}>
                          {memberDateEditor.dateInput
                            ? `Data atual de ${memberDateEditor.profileName}. Edite se necessário.`
                            : `Informe a data de membro de ${memberDateEditor.profileName}.`}
                        </Text>
                        <TextInput
                          style={styles.memberDateInput}
                          value={memberDateEditor.dateInput}
                          onChangeText={handleChangeMemberDateInput}
                          placeholder="dd/mm/aa"
                          placeholderTextColor="#64748B"
                          keyboardType="numeric"
                          maxLength={8}
                          returnKeyType="done"
                        />
                        {memberDateEditor.error ? (
                          <Text style={styles.memberDateError}>{memberDateEditor.error}</Text>
                        ) : null}
                        <View style={styles.memberDateActions}>
                          <TouchableOpacity
                            style={[styles.memberDateButton, styles.memberDateCancelButton]}
                            onPress={() => setMemberDateEditor(null)}
                            activeOpacity={0.85}
                            disabled={isSaving}
                          >
                            <Text style={styles.memberDateCancelText}>Cancelar</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.memberDateButton, styles.memberDateSaveButton]}
                            onPress={() => void handleSaveMemberDate()}
                            activeOpacity={0.85}
                            disabled={isSaving}
                          >
                            {isSaving ? (
                              <ActivityIndicator color="#0F172A" size="small" />
                            ) : (
                              <Text style={styles.memberDateSaveText}>Salvar</Text>
                            )}
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : null}
                  </React.Fragment>
                );
              })
            )}
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
    paddingTop: 2,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148, 163, 184, 0.35)',
    backgroundColor: 'rgba(15, 23, 42, 0.96)',
    zIndex: 2,
  },
  emptyFilterText: {
    color: '#94A3B8',
    fontSize: 13,
    fontStyle: 'italic',
    paddingVertical: 12,
    paddingHorizontal: 4,
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
  memberDateBubble: {
    alignSelf: 'flex-end',
    width: 240,
    marginTop: -4,
    marginBottom: 8,
    marginRight: 4,
    borderWidth: 1,
    borderColor: 'rgba(244, 114, 182, 0.45)',
    borderRadius: 14,
    backgroundColor: 'rgba(15, 23, 42, 0.98)',
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 10,
    gap: 8,
  },
  memberDateBubbleArrow: {
    position: 'absolute',
    top: -7,
    right: 28,
    width: 12,
    height: 12,
    borderLeftWidth: 1,
    borderTopWidth: 1,
    borderColor: 'rgba(244, 114, 182, 0.45)',
    backgroundColor: 'rgba(15, 23, 42, 0.98)',
    transform: [{ rotate: '45deg' }],
  },
  memberDateTitle: {
    color: '#FCE7F3',
    fontSize: 13,
    fontWeight: '800',
  },
  memberDateHelp: {
    color: '#CBD5E1',
    fontSize: 12,
    lineHeight: 16,
  },
  memberDateInput: {
    borderWidth: 1,
    borderColor: 'rgba(244, 114, 182, 0.45)',
    borderRadius: 10,
    backgroundColor: 'rgba(30, 41, 59, 0.85)',
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  memberDateError: {
    color: '#FCA5A5',
    fontSize: 11,
    lineHeight: 15,
  },
  memberDateActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  memberDateButton: {
    minWidth: 76,
    minHeight: 34,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  memberDateCancelButton: {
    borderWidth: 1,
    borderColor: '#475569',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
  },
  memberDateSaveButton: {
    backgroundColor: ACCENT,
  },
  memberDateCancelText: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '800',
  },
  memberDateSaveText: {
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '900',
  },
});

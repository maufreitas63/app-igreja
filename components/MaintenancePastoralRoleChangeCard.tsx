import { CardLoadingState } from '@/components/ui/CardLoadingState';
import { SectionLabel } from '@/components/ui/SectionLabel';
import {
  PASTORAL_BASIC_ROLE_OPTIONS,
  useMaintenancePastoralRoleChange,
} from '@/hooks/useMaintenancePastoralRoleChange';
import { formatShortName } from '@/lib/formatShortName';
import { computeMaintenanceContentHeight, maintenancePanelStyles } from '@/lib/maintenanceCardStyles';
import {
  formatMembershipDateFromIso,
  formatMembershipDateInput,
  parseMembershipDateInputToIso,
} from '@/lib/membershipDateInput';
import React, { useState } from 'react';
import Toast from 'react-native-toast-message';
import {
  ActivityIndicator,
  Modal,
  Pressable,
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
const MEMBER_NAME_COLOR = '#60A5FA';

type MembershipDateEditorState = {
  profileId: string;
  profileName: string;
  dateInput: string;
  error: string | null;
};

export function MaintenancePastoralRoleChangeCard({ isActive = true, panelHeight }: Props) {
  const [membershipDateEditor, setMembershipDateEditor] = useState<MembershipDateEditorState | null>(
    null
  );
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
    updateMembershipDate,
    reloadProfiles,
  } = useMaintenancePastoralRoleChange(isActive);

  const contentHeight = computeMaintenanceContentHeight(panelHeight);
  const hasActiveFilters = searchQuery.trim().length > 0 || roleFilter !== null;
  const isSavingMembershipDate =
    membershipDateEditor !== null && savingProfileId === membershipDateEditor.profileId;

  const closeMembershipDateEditor = () => {
    setMembershipDateEditor(null);
  };

  const handleSelectRole = async (
    profileId: string,
    roleCode: (typeof PASTORAL_BASIC_ROLE_OPTIONS)[number]['code']
  ) => {
    closeMembershipDateEditor();
    const result = await updateProfileRole(profileId, roleCode);

    Toast.show({
      type: result.success ? 'success' : 'error',
      text1: 'Mudança de Papéis',
      text2: result.message,
      visibilityTime: 3500,
    });
  };

  const handleOpenMembershipDateEditor = (profile: (typeof profiles)[number]) => {
    if (profile.currentRoleCode !== 'member') {
      return;
    }

    setMembershipDateEditor({
      profileId: profile.id,
      profileName: formatShortName(profile.fullName),
      dateInput: formatMembershipDateFromIso(profile.membershipDate),
      error: null,
    });
  };

  const handleChangeMembershipDateInput = (value: string) => {
    setMembershipDateEditor((current) =>
      current
        ? {
            ...current,
            dateInput: formatMembershipDateInput(value),
            error: null,
          }
        : current
    );
  };

  const handleSaveMembershipDate = async () => {
    if (!membershipDateEditor) {
      return;
    }

    const membershipDateIso = parseMembershipDateInputToIso(membershipDateEditor.dateInput);

    if (membershipDateEditor.dateInput.trim() && !membershipDateIso) {
      setMembershipDateEditor((current) =>
        current
          ? {
              ...current,
              error: 'Informe uma data válida no formato dd/mm/aa.',
            }
          : current
      );
      return;
    }

    const result = await updateMembershipDate(
      membershipDateEditor.profileId,
      membershipDateIso
    );

    Toast.show({
      type: result.success ? 'success' : 'error',
      text1: 'Data de Membresia',
      text2: result.message,
      visibilityTime: 3500,
    });

    closeMembershipDateEditor();
  };

  return (
    <View style={[styles.panel, { height: contentHeight }]}>
      <Text style={maintenancePanelStyles.panelTitle}>Mudança de Papéis</Text>
      <View style={maintenancePanelStyles.panelSubtitleSpacer} />

      <Text style={styles.helpText}>
        Lista de perfis elegíveis (exceto super admin e equipe pastoral). Use a busca para filtrar
        por nome, telefone ou código. Toque nos cabeçalhos Visitante, Congregado ou Membro para
        filtrar pelo papel atual. Membros exibem o nome em azul sublinhado — toque para ver ou
        editar a data de membresia.
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
        <Text style={styles.hintText}>
          Nenhum perfil elegível encontrado. Se o card deveria listar membros, execute no Supabase o
          script access-control-pastoral-role-change-fix-protected-list.sql e toque em Recarregar.
        </Text>
      ) : null}

      {!loading && allProfiles.length > 0 && profiles.length === 0 ? (
        <Text style={styles.hintText}>
          Nenhum perfil corresponde aos filtros. Limpe a busca ou toque de novo no cabeçalho do
          papel para remover o filtro.
        </Text>
      ) : null}

      {!loading ? (
        <TouchableOpacity
          style={styles.reloadButton}
          onPress={() => void reloadProfiles()}
          activeOpacity={0.85}
        >
          <Text style={styles.reloadButtonText}>Recarregar lista</Text>
        </TouchableOpacity>
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
                const isMember = profile.currentRoleCode === 'member';
                const shortName = formatShortName(profile.fullName);

                return (
                  <View key={profile.id} style={styles.tableRow}>
                    <View style={styles.nameColumn}>
                      {isMember ? (
                        <Pressable
                          onPress={() => handleOpenMembershipDateEditor(profile)}
                          accessibilityRole="button"
                          accessibilityLabel={`Ver ou editar data de membresia de ${shortName}`}
                        >
                          <Text style={styles.memberNameLink} numberOfLines={2}>
                            {shortName}
                          </Text>
                        </Pressable>
                      ) : (
                        <Text style={styles.shortName} numberOfLines={2}>
                          {shortName}
                        </Text>
                      )}
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
              })
            )}
          </ScrollView>
        </View>
      ) : null}

      <Modal
        visible={membershipDateEditor !== null}
        transparent
        animationType="fade"
        onRequestClose={closeMembershipDateEditor}
      >
        <View style={styles.membershipDateModalOverlay}>
          <Pressable
            style={styles.membershipDateModalBackdrop}
            onPress={closeMembershipDateEditor}
          />

          {membershipDateEditor ? (
            <View style={styles.membershipDateBubble}>
              <Text style={styles.membershipDateTitle}>Data de Membresia</Text>
              <Text style={styles.membershipDateHelp}>
                {membershipDateEditor.profileName} — informe ou edite a data no formato dd/mm/aa.
              </Text>
              <TextInput
                style={styles.membershipDateInput}
                value={membershipDateEditor.dateInput}
                onChangeText={handleChangeMembershipDateInput}
                placeholder="dd/mm/aa"
                placeholderTextColor="#64748B"
                keyboardType="numeric"
                maxLength={8}
                returnKeyType="done"
                autoFocus
              />
              {membershipDateEditor.error ? (
                <Text style={styles.membershipDateError}>{membershipDateEditor.error}</Text>
              ) : null}
              <View style={styles.membershipDateActions}>
                <TouchableOpacity
                  style={[styles.membershipDateButton, styles.membershipDateCancelButton]}
                  onPress={closeMembershipDateEditor}
                  activeOpacity={0.85}
                  disabled={isSavingMembershipDate}
                >
                  <Text style={styles.membershipDateCancelText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.membershipDateButton, styles.membershipDateSaveButton]}
                  onPress={() => void handleSaveMembershipDate()}
                  activeOpacity={0.85}
                  disabled={isSavingMembershipDate}
                >
                  {isSavingMembershipDate ? (
                    <ActivityIndicator color="#0F172A" size="small" />
                  ) : (
                    <Text style={styles.membershipDateSaveText}>Salvar</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
        </View>
      </Modal>
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
  reloadButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(244, 114, 182, 0.45)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 8,
  },
  reloadButtonText: {
    color: ACCENT,
    fontSize: 12,
    fontWeight: '800',
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
  memberNameLink: {
    color: MEMBER_NAME_COLOR,
    fontSize: 14,
    fontWeight: '700',
    textDecorationLine: 'underline',
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
  membershipDateModalOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    backgroundColor: 'rgba(2, 6, 23, 0.58)',
  },
  membershipDateModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  membershipDateBubble: {
    width: '100%',
    maxWidth: 320,
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.45)',
    borderRadius: 14,
    backgroundColor: 'rgba(15, 23, 42, 0.98)',
    padding: 14,
    gap: 8,
  },
  membershipDateTitle: {
    color: '#BFDBFE',
    fontSize: 13,
    fontWeight: '800',
  },
  membershipDateHelp: {
    color: '#CBD5E1',
    fontSize: 12,
    lineHeight: 16,
  },
  membershipDateInput: {
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.45)',
    borderRadius: 10,
    backgroundColor: 'rgba(30, 41, 59, 0.85)',
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  membershipDateError: {
    color: '#FCA5A5',
    fontSize: 11,
    lineHeight: 15,
  },
  membershipDateActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  membershipDateButton: {
    minWidth: 76,
    minHeight: 34,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  membershipDateCancelButton: {
    borderWidth: 1,
    borderColor: '#475569',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
  },
  membershipDateSaveButton: {
    backgroundColor: MEMBER_NAME_COLOR,
  },
  membershipDateCancelText: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '800',
  },
  membershipDateSaveText: {
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '900',
  },
});

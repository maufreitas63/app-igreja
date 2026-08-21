import { CardLoadingState } from '@/components/ui/CardLoadingState';
import { SectionLabel } from '@/components/ui/SectionLabel';
import {
  PASTORAL_BASIC_ROLE_OPTIONS,
  useMaintenancePastoralRoleChange,
} from '@/hooks/useMaintenancePastoralRoleChange';
import { isProfileVisibleInApp } from '@/lib/activeMemberProfile';
import { formatShortName } from '@/lib/formatShortName';
import { computeMaintenanceContentHeight, maintenancePanelStyles } from '@/lib/maintenanceCardStyles';
import {
  formatMembershipDateFromIso,
  formatMembershipDateInput,
  parseMembershipDateInputToIso,
} from '@/lib/membershipDateInput';
import {
  profileHasEditableMembershipDates,
  profileHasMembershipDateLink,
} from '@/lib/pastoralRoleChangeApi';
import { CONTAIN_WIDTH } from '@/lib/minimalPresentation';
import { MINIMAL_SECTION_TITLE, MINIMAL_UI } from '@/lib/minimalUiTheme';
import { FontAwesome } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
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
  minimal?: boolean;
};

const ACCENT = '#3A96DD';
const MEMBER_NAME_COLOR = '#60A5FA';
const MEMBER_NAME_INACTIVE_COLOR = '#F87171';

const PASTORAL_ROLE_CHANGE_HELP =
  'Lista de perfis elegíveis (exceto super admin e equipe pastoral). Use a busca para filtrar por nome, telefone ou código. Toque nos cabeçalhos Visitante, Congregado ou Membro para filtrar pelo papel atual. Membros e congregados exibem o nome em azul sublinhado — toque para ver ou editar as datas de membresia (entrada e desligamento). Congregados em família herdam as datas do responsável legal, pai ou mãe. Nome em vermelho indica desligamento (data de saída preenchida).';

type MembershipDateEditorState = {
  profileId: string;
  profileName: string;
  dateInput: string;
  outDateInput: string;
  readOnly: boolean;
  inheritedFromName: string | null;
  error: string | null;
  outError: string | null;
};

export function MaintenancePastoralRoleChangeCard({
  isActive = true,
  panelHeight,
  minimal = false,
}: Props) {
  const [helpOpen, setHelpOpen] = useState(false);
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

  const membershipCountBreakdown = useMemo(() => {
    if (roleFilter !== 'member' && roleFilter !== 'congregado') {
      return null;
    }

    let activeCount = 0;
    let dischargedCount = 0;

    for (const profile of profiles) {
      if (isProfileVisibleInApp(profile.membershipOut)) {
        activeCount += 1;
      } else {
        dischargedCount += 1;
      }
    }

    const roleLabel = roleFilter === 'member' ? 'Membros' : 'Congregados';

    return { roleLabel, activeCount, dischargedCount };
  }, [profiles, roleFilter]);

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
    if (!profileHasMembershipDateLink(profile)) {
      return;
    }

    const editable = profileHasEditableMembershipDates(profile);
    const dateSource = editable ? profile.ownMembershipDate : profile.membershipDate;
    const outDateSource = editable ? profile.ownMembershipOut : profile.membershipOut;

    setMembershipDateEditor({
      profileId: profile.id,
      profileName: formatShortName(profile.fullName),
      dateInput: formatMembershipDateFromIso(dateSource),
      outDateInput: formatMembershipDateFromIso(outDateSource),
      readOnly: !editable,
      inheritedFromName: profile.membershipInherited ? profile.inheritedFromName : null,
      error: null,
      outError: null,
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

  const handleChangeMembershipOutDateInput = (value: string) => {
    setMembershipDateEditor((current) =>
      current
        ? {
            ...current,
            outDateInput: formatMembershipDateInput(value),
            outError: null,
          }
        : current
    );
  };

  const handleSaveMembershipDate = async () => {
    if (!membershipDateEditor || membershipDateEditor.readOnly) {
      return;
    }

    const membershipDateIso = parseMembershipDateInputToIso(membershipDateEditor.dateInput);
    const membershipOutIso = parseMembershipDateInputToIso(membershipDateEditor.outDateInput);

    let dateError: string | null = null;
    let outDateError: string | null = null;

    if (membershipDateEditor.dateInput.trim() && !membershipDateIso) {
      dateError = 'Informe uma data válida no formato dd/mm/aa.';
    }

    if (membershipDateEditor.outDateInput.trim() && !membershipOutIso) {
      outDateError = 'Informe uma data válida no formato dd/mm/aa.';
    }

    if (dateError || outDateError) {
      setMembershipDateEditor((current) =>
        current
          ? {
              ...current,
              error: dateError,
              outError: outDateError,
            }
          : current
      );
      return;
    }

    const result = await updateMembershipDate(
      membershipDateEditor.profileId,
      membershipDateIso,
      membershipOutIso
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
    <View style={[styles.panel, minimal && styles.panelMinimal, { height: contentHeight }]}>
      <View style={styles.titleRow}>
        <Text
          style={[
            minimal ? styles.sectionTitle : maintenancePanelStyles.panelTitle,
            styles.titleText,
          ]}
        >
          Mudança de Papéis
        </Text>
        <TouchableOpacity
          style={styles.helpButton}
          onPress={() => setHelpOpen(true)}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Como usar a mudança de papéis"
        >
          <FontAwesome
            name="info-circle"
            size={18}
            color={minimal ? MINIMAL_UI.blueDark : ACCENT}
          />
        </TouchableOpacity>
      </View>
      {!minimal ? <View style={maintenancePanelStyles.panelSubtitleSpacer} /> : null}

      {error ? (
        <Text style={[styles.errorText, minimal && styles.errorTextMinimal]}>{error}</Text>
      ) : null}

      {minimal ? (
        <Text style={styles.filterLabelMinimal}>Filtrar lista</Text>
      ) : (
        <SectionLabel variant="maintenance">Filtrar lista</SectionLabel>
      )}
      <TextInput
        style={[styles.searchInput, minimal && styles.searchInputMinimal]}
        placeholder="Nome, telefone ou código"
        placeholderTextColor={minimal ? MINIMAL_UI.textMuted : '#64748B'}
        value={searchQuery}
        onChangeText={setSearchQuery}
        autoCapitalize="words"
        autoCorrect={false}
        returnKeyType="search"
      />

      {loading ? <CardLoadingState lines={2} compact minimal={minimal} /> : null}

      {!loading && allProfiles.length > 0 ? (
        <Text style={[styles.countText, minimal && styles.countTextMinimal]}>
          {hasActiveFilters
            ? `${profiles.length} de ${allProfiles.length} perfis`
            : `${allProfiles.length} perfis`}
          {membershipCountBreakdown
            ? ` — sendo ${membershipCountBreakdown.activeCount} ${membershipCountBreakdown.roleLabel} Ativos e ${membershipCountBreakdown.dischargedCount} Desligados`
            : ''}
        </Text>
      ) : null}

      {!loading && allProfiles.length === 0 ? (
        <Text style={[styles.hintText, minimal && styles.hintTextMinimal]}>
          Nenhum perfil elegível encontrado. Se o card deveria listar membros, execute no Supabase o
          script access-control-pastoral-role-change-fix-protected-list.sql e toque em Recarregar.
        </Text>
      ) : null}

      {!loading && allProfiles.length > 0 && profiles.length === 0 ? (
        <Text style={[styles.hintText, minimal && styles.hintTextMinimal]}>
          Nenhum perfil corresponde aos filtros. Limpe a busca ou toque de novo no cabeçalho do
          papel para remover o filtro.
        </Text>
      ) : null}

      {!loading ? (
        <TouchableOpacity
          style={[styles.reloadButton, minimal && styles.reloadButtonMinimal]}
          onPress={() => void reloadProfiles()}
          activeOpacity={0.85}
        >
          <Text style={[styles.reloadButtonText, minimal && styles.reloadButtonTextMinimal]}>
            Recarregar lista
          </Text>
        </TouchableOpacity>
      ) : null}

      {!loading && allProfiles.length > 0 ? (
        <View style={[styles.tableSection, minimal && styles.tableSectionMinimal]}>
          <View style={[styles.tableHeader, minimal && styles.tableHeaderMinimal]}>
            <Text style={[styles.headerCell, minimal && styles.headerCellMinimal, styles.nameColumn]}>
              Nome curto
            </Text>
            {PASTORAL_BASIC_ROLE_OPTIONS.map((option) => {
              const isActiveFilter = roleFilter === option.code;

              return (
                <TouchableOpacity
                  key={option.code}
                  style={[
                    styles.roleHeaderButton,
                    minimal && styles.roleHeaderButtonMinimal,
                    isActiveFilter && styles.roleHeaderButtonActive,
                    minimal && isActiveFilter && styles.roleHeaderButtonActiveMinimal,
                  ]}
                  onPress={() => toggleRoleFilter(option.code)}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActiveFilter }}
                  accessibilityLabel={`Filtrar por ${option.label}`}
                >
                  <Text
                    style={[
                      styles.roleHeaderCell,
                      minimal && styles.roleHeaderCellMinimal,
                      isActiveFilter && styles.roleHeaderCellActive,
                      minimal && isActiveFilter && styles.roleHeaderCellActiveMinimal,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <ScrollView
            style={[styles.tableScroll, minimal && styles.tableScrollMinimal]}
            contentContainerStyle={styles.tableContent}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
          >
            {profiles.length === 0 ? (
              <Text style={[styles.emptyFilterText, minimal && styles.emptyFilterTextMinimal]}>
                Nenhum perfil corresponde aos filtros.
              </Text>
            ) : (
              profiles.map((profile, index) => {
                const isSaving = savingProfileId === profile.id;
                const hasMembershipLink = profileHasMembershipDateLink(profile);
                const shortName = formatShortName(profile.fullName);
                const hasMembershipOut = !isProfileVisibleInApp(profile.membershipOut);

                return (
                  <View
                    key={profile.id}
                    style={[
                      styles.tableRow,
                      minimal && styles.tableRowMinimal,
                      minimal && index % 2 === 1 && styles.tableRowAltMinimal,
                    ]}
                  >
                    <View style={styles.nameColumn}>
                      {hasMembershipLink ? (
                        <Pressable
                          onPress={() => handleOpenMembershipDateEditor(profile)}
                          accessibilityRole="button"
                          accessibilityLabel={`Ver ou editar data de membresia de ${shortName}`}
                        >
                          <Text
                            style={[
                              styles.memberNameLink,
                              minimal && styles.memberNameLinkMinimal,
                              hasMembershipOut && styles.memberNameInactive,
                              minimal && hasMembershipOut && styles.memberNameInactiveMinimal,
                            ]}
                            numberOfLines={2}
                          >
                            {shortName}
                          </Text>
                        </Pressable>
                      ) : (
                        <Text
                          style={[styles.shortName, minimal && styles.shortNameMinimal]}
                          numberOfLines={2}
                        >
                          {shortName}
                        </Text>
                      )}
                      {isSaving ? (
                        <ActivityIndicator
                          color={minimal ? MINIMAL_UI.accent : ACCENT}
                          size="small"
                        />
                      ) : null}
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
                          <View
                            style={[
                              styles.radioOuter,
                              minimal && styles.radioOuterMinimal,
                              selected && styles.radioOuterSelected,
                              minimal && selected && styles.radioOuterSelectedMinimal,
                            ]}
                          >
                            {selected ? (
                              <View
                                style={[styles.radioInner, minimal && styles.radioInnerMinimal]}
                              />
                            ) : null}
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
        visible={helpOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setHelpOpen(false)}
      >
        <View
          style={[
            styles.membershipDateModalOverlay,
            minimal && styles.membershipDateModalOverlayMinimal,
          ]}
        >
          <Pressable style={styles.membershipDateModalBackdrop} onPress={() => setHelpOpen(false)} />
          <View style={[styles.membershipDateBubble, minimal && styles.membershipDateBubbleMinimal]}>
            <Text style={[styles.membershipDateTitle, minimal && styles.membershipDateTitleMinimal]}>
              Como usar
            </Text>
            <Text style={[styles.helpModalText, minimal && styles.helpTextMinimal]}>
              {PASTORAL_ROLE_CHANGE_HELP}
            </Text>
            <View style={styles.membershipDateActions}>
              <TouchableOpacity
                style={[
                  styles.membershipDateButton,
                  styles.membershipDateCancelButton,
                  minimal && styles.membershipDateCancelButtonMinimal,
                ]}
                onPress={() => setHelpOpen(false)}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Fechar"
              >
                <Text
                  style={[
                    styles.membershipDateCancelText,
                    minimal && styles.membershipDateCancelTextMinimal,
                  ]}
                >
                  Fechar
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={membershipDateEditor !== null}
        transparent
        animationType="fade"
        onRequestClose={closeMembershipDateEditor}
      >
        <View
          style={[
            styles.membershipDateModalOverlay,
            minimal && styles.membershipDateModalOverlayMinimal,
          ]}
        >
          <Pressable
            style={styles.membershipDateModalBackdrop}
            onPress={closeMembershipDateEditor}
          />

          {membershipDateEditor ? (
            <View style={[styles.membershipDateBubble, minimal && styles.membershipDateBubbleMinimal]}>
              <Text style={[styles.membershipDateTitle, minimal && styles.membershipDateTitleMinimal]}>
                Data de Membresia
              </Text>
              <Text style={[styles.membershipDateHelp, minimal && styles.membershipDateHelpMinimal]}>
                {membershipDateEditor.profileName}
                {membershipDateEditor.readOnly && membershipDateEditor.inheritedFromName
                  ? ` — datas herdadas de ${membershipDateEditor.inheritedFromName}.`
                  : ' — informe ou edite as datas no formato dd/mm/aa.'}
              </Text>
              <Text
                style={[
                  styles.membershipDateFieldLabel,
                  minimal && styles.membershipDateFieldLabelMinimal,
                ]}
              >
                Data de entrada
              </Text>
              <TextInput
                style={[styles.membershipDateInput, minimal && styles.membershipDateInputMinimal]}
                value={membershipDateEditor.dateInput}
                onChangeText={handleChangeMembershipDateInput}
                placeholder="dd/mm/aa"
                placeholderTextColor={minimal ? MINIMAL_UI.textMuted : '#64748B'}
                keyboardType="numeric"
                maxLength={8}
                returnKeyType="next"
                autoFocus={!membershipDateEditor.readOnly}
                editable={!membershipDateEditor.readOnly}
              />
              {membershipDateEditor.error ? (
                <Text style={[styles.membershipDateError, minimal && styles.membershipDateErrorMinimal]}>
                  {membershipDateEditor.error}
                </Text>
              ) : null}
              <Text
                style={[
                  styles.membershipDateFieldLabel,
                  minimal && styles.membershipDateFieldLabelMinimal,
                ]}
              >
                Data de desligamento
              </Text>
              <TextInput
                style={[styles.membershipDateInput, minimal && styles.membershipDateInputMinimal]}
                value={membershipDateEditor.outDateInput}
                onChangeText={handleChangeMembershipOutDateInput}
                placeholder="dd/mm/aa"
                placeholderTextColor={minimal ? MINIMAL_UI.textMuted : '#64748B'}
                keyboardType="numeric"
                maxLength={8}
                returnKeyType="done"
                editable={!membershipDateEditor.readOnly}
              />
              {membershipDateEditor.outError ? (
                <Text style={[styles.membershipDateError, minimal && styles.membershipDateErrorMinimal]}>
                  {membershipDateEditor.outError}
                </Text>
              ) : null}
              <View style={styles.membershipDateActions}>
                <TouchableOpacity
                  style={[
                    styles.membershipDateButton,
                    styles.membershipDateCancelButton,
                    minimal && styles.membershipDateCancelButtonMinimal,
                  ]}
                  onPress={closeMembershipDateEditor}
                  activeOpacity={0.85}
                  disabled={isSavingMembershipDate}
                >
                  <Text
                    style={[
                      styles.membershipDateCancelText,
                      minimal && styles.membershipDateCancelTextMinimal,
                    ]}
                  >
                    {membershipDateEditor.readOnly ? 'Fechar' : 'Cancelar'}
                  </Text>
                </TouchableOpacity>
                {!membershipDateEditor.readOnly ? (
                  <TouchableOpacity
                    style={[
                      styles.membershipDateButton,
                      styles.membershipDateSaveButton,
                      minimal && styles.membershipDateSaveButtonMinimal,
                    ]}
                    onPress={() => void handleSaveMembershipDate()}
                    activeOpacity={0.85}
                    disabled={isSavingMembershipDate}
                  >
                    {isSavingMembershipDate ? (
                      <ActivityIndicator
                        color={minimal ? MINIMAL_UI.onDark : '#0F172A'}
                        size="small"
                      />
                    ) : (
                      <Text
                        style={[
                          styles.membershipDateSaveText,
                          minimal && styles.membershipDateSaveTextMinimal,
                        ]}
                      >
                        Salvar
                      </Text>
                    )}
                  </TouchableOpacity>
                ) : null}
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
  titleRow: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 28,
  },
  titleText: {
    flex: 1,
    paddingHorizontal: 28,
  },
  helpButton: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helpModalText: {
    color: '#3A96DD',
    fontSize: 13,
    lineHeight: 19,
  },
  helpTextMinimal: {
    color: MINIMAL_UI.text,
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 13,
    marginBottom: 8,
  },
  hintText: {
    color: 'rgba(58, 150, 221, 0.82)',
    fontSize: 13,
    fontStyle: 'italic',
  },
  countText: {
    color: 'rgba(58, 150, 221, 0.82)',
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
    color: '#3A96DD',
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
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148, 163, 184, 0.35)',
    backgroundColor: 'rgba(15, 23, 42, 0.96)',
    zIndex: 2,
  },
  emptyFilterText: {
    color: 'rgba(58, 150, 221, 0.82)',
    fontSize: 13,
    fontStyle: 'italic',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  headerCell: {
    color: '#3A96DD',
    fontSize: 12,
    fontWeight: '800',
  },
  roleHeaderButton: {
    width: 56,
    flexShrink: 0,
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
    color: '#3A96DD',
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
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148, 163, 184, 0.15)',
  },
  nameColumn: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
    gap: 4,
  },
  shortName: {
    color: '#3A96DD',
    fontSize: 14,
    fontWeight: '700',
  },
  memberNameLink: {
    color: MEMBER_NAME_COLOR,
    fontSize: 14,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  memberNameInactive: {
    color: MEMBER_NAME_INACTIVE_COLOR,
  },
  roleChip: {
    width: 56,
    flexShrink: 0,
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
    borderColor: 'rgba(52, 211, 153, 0.35)',
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
    color: '#3A96DD',
    fontSize: 12,
    lineHeight: 16,
  },
  membershipDateFieldLabel: {
    color: 'rgba(58, 150, 221, 0.82)',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  membershipDateInput: {
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.45)',
    borderRadius: 10,
    backgroundColor: 'rgba(30, 41, 59, 0.85)',
    color: '#3A96DD',
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
    borderColor: 'rgba(52, 211, 153, 0.35)',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
  },
  membershipDateSaveButton: {
    backgroundColor: MEMBER_NAME_COLOR,
  },
  membershipDateCancelText: {
    color: '#3A96DD',
    fontSize: 12,
    fontWeight: '800',
  },
  membershipDateSaveText: {
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '900',
  },
  panelMinimal: {
    ...CONTAIN_WIDTH,
    paddingHorizontal: 0,
    paddingVertical: 4,
    borderRadius: 0,
    backgroundColor: MINIMAL_UI.background,
    overflow: 'hidden',
  },
  sectionTitle: {
    ...MINIMAL_SECTION_TITLE,
    alignSelf: 'stretch',
    maxWidth: '100%',
    minWidth: 0,
    paddingHorizontal: 0,
  },
  errorTextMinimal: {
    color: '#DC2626',
  },
  filterLabelMinimal: {
    color: MINIMAL_UI.textMuted,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
    marginTop: 4,
  },
  searchInputMinimal: {
    borderColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.background,
    color: MINIMAL_UI.text,
  },
  countTextMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  hintTextMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  reloadButtonMinimal: {
    ...CONTAIN_WIDTH,
    alignSelf: 'stretch',
    alignItems: 'center',
    borderRadius: 12,
    borderColor: MINIMAL_UI.blueDark,
    backgroundColor: MINIMAL_UI.background,
  },
  reloadButtonTextMinimal: {
    color: MINIMAL_UI.blueDark,
  },
  tableSectionMinimal: {
    ...CONTAIN_WIDTH,
  },
  tableHeaderMinimal: {
    borderBottomColor: MINIMAL_UI.divider,
    backgroundColor: MINIMAL_UI.background,
  },
  headerCellMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  roleHeaderButtonMinimal: {
    borderRadius: 8,
  },
  roleHeaderButtonActiveMinimal: {
    backgroundColor: '#EFF6FF',
  },
  roleHeaderCellMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  roleHeaderCellActiveMinimal: {
    color: MINIMAL_UI.blueDark,
  },
  tableScrollMinimal: {
    ...CONTAIN_WIDTH,
  },
  emptyFilterTextMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  tableRowMinimal: {
    borderBottomColor: MINIMAL_UI.divider,
    backgroundColor: MINIMAL_UI.background,
  },
  tableRowAltMinimal: {
    backgroundColor: MINIMAL_UI.rowHover,
  },
  shortNameMinimal: {
    color: MINIMAL_UI.text,
  },
  memberNameLinkMinimal: {
    color: MINIMAL_UI.accent,
  },
  memberNameInactiveMinimal: {
    color: '#DC2626',
  },
  radioOuterMinimal: {
    borderColor: MINIMAL_UI.border,
  },
  radioOuterSelectedMinimal: {
    borderColor: MINIMAL_UI.blueDark,
  },
  radioInnerMinimal: {
    backgroundColor: MINIMAL_UI.blueDark,
  },
  membershipDateModalOverlayMinimal: {
    backgroundColor: 'rgba(30, 64, 175, 0.28)',
  },
  membershipDateBubbleMinimal: {
    borderColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.background,
  },
  membershipDateTitleMinimal: {
    color: MINIMAL_UI.blueDark,
  },
  membershipDateHelpMinimal: {
    color: MINIMAL_UI.text,
  },
  membershipDateFieldLabelMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  membershipDateInputMinimal: {
    borderColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.background,
    color: MINIMAL_UI.text,
  },
  membershipDateErrorMinimal: {
    color: '#DC2626',
  },
  membershipDateCancelButtonMinimal: {
    borderColor: MINIMAL_UI.blueDark,
    backgroundColor: MINIMAL_UI.background,
  },
  membershipDateCancelTextMinimal: {
    color: MINIMAL_UI.blueDark,
  },
  membershipDateSaveButtonMinimal: {
    backgroundColor: MINIMAL_UI.blueDark,
  },
  membershipDateSaveTextMinimal: {
    color: MINIMAL_UI.onDark,
  },
});

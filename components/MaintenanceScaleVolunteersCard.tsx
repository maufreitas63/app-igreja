import { CardLoadingState } from '@/components/ui/CardLoadingState';
import { DropdownSelect } from '@/components/ui/DropdownSelect';
import { useMaintenanceScaleVolunteers } from '@/hooks/useMaintenanceScaleVolunteers';
import {
  computeMaintenanceContentHeight,
  maintenancePanelStyles,
} from '@/lib/maintenanceCardStyles';
import { MAINTENANCE_SCALE_VOLUNTEERS_SQL_HINT } from '@/hooks/useMaintenanceScaleVolunteers';
import { confirmDialog } from '@/lib/confirmDialog';
import { SCALE_VOLUNTEERS_MENU_LABEL } from '@/lib/appDrawerMenu';
import { CONTAIN_WIDTH } from '@/lib/minimalPresentation';
import { MINIMAL_SECTION_TITLE, MINIMAL_UI } from '@/lib/minimalUiTheme';
import { mapLegacyRoomDisplayLabel } from '@/lib/roomDisplayLabels';
import { FontAwesome } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
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

const PANEL_TITLE = SCALE_VOLUNTEERS_MENU_LABEL;

/** Altura visível da lista «Já associados» (~7 linhas). */
const REGISTERED_LIST_MAX_HEIGHT = 217;

function FieldLabel({ children, minimal }: { children: string; minimal: boolean }) {
  return (
    <Text style={minimal ? styles.fieldLabelMinimal : styles.fieldLabel}>{children}</Text>
  );
}

export function MaintenanceScaleVolunteersCard({
  isActive = true,
  panelHeight,
  minimal = false,
}: Props) {
  const {
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
  } = useMaintenanceScaleVolunteers(isActive);

  const contentHeight = computeMaintenanceContentHeight(panelHeight);

  const scaleTypeDropdownOptions = useMemo(
    () =>
      scaleTypes.map((type) => ({
        value: type.id,
        label: mapLegacyRoomDisplayLabel(type.name),
      })),
    [scaleTypes]
  );

  const handleAssociate = async (profileId: string, fullName: string) => {
    const nameKey = fullName.trim().toLocaleLowerCase('pt-BR');

    if (registeredNameKeys.has(nameKey)) {
      Alert.alert(PANEL_TITLE, 'Este servo já está cadastrado neste tipo de escala.');
      return;
    }

    const result = await associateProfile(profileId);

    if (!result.success) {
      Alert.alert(PANEL_TITLE, result.message);
      return;
    }

    Alert.alert(PANEL_TITLE, result.message);
  };

  const runRemove = async (volunteerId: string) => {
    const result = await removeVolunteer(volunteerId);

    if (!result.success) {
      Alert.alert(PANEL_TITLE, result.message);
    }
  };

  const handleRemove = async (volunteerId: string, volunteerName: string) => {
    const prompt = `Remover «${volunteerName}» deste tipo de escala?`;
    const confirmed = await confirmDialog('Remover servo', prompt, 'Remover', 'Cancelar', {
      destructive: true,
    });

    if (confirmed) {
      void runRemove(volunteerId);
    }
  };

  const listBusy = saving || removingVolunteerId !== null;
  const hasProfileSearchQuery = profileSearchQuery.trim().length > 0;

  const handleClearProfileSearch = () => {
    setProfileSearchQuery('');
  };

  const mutedIcon = minimal ? MINIMAL_UI.textMuted : '#64748B';
  const dangerIcon = minimal ? '#DC2626' : '#FCA5A5';
  const addIcon = minimal ? MINIMAL_UI.accent : '#6EE7B7';

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
        <Text style={[styles.hint, minimal && styles.hintMinimal]}>Carregando tipos de escala…</Text>
      </View>
    );
  }

  if (!scaleTypes.length) {
    return (
      <View
        style={[
          styles.panel,
          minimal && styles.panelMinimal,
          styles.panelCentered,
          { height: contentHeight },
        ]}
      >
        <FontAwesome name="users" size={28} color={mutedIcon} />
        <View style={styles.sectionTitleWrap}>
          <Text style={minimal ? styles.sectionTitleMinimal : maintenancePanelStyles.panelTitleMuted}>
            {PANEL_TITLE}
          </Text>
        </View>
        <Text style={[styles.hint, minimal && styles.hintMinimal]}>
          Cadastre tipos de escala no card Tipos de Escala.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.panel, minimal && styles.panelMinimal, { height: contentHeight }]}>
      <View style={styles.sectionTitleWrap}>
        <Text style={minimal ? styles.sectionTitleMinimal : maintenancePanelStyles.panelTitle}>
          {PANEL_TITLE}
        </Text>
      </View>

      {rpcMissing ? (
        <Text style={[styles.warningText, minimal && styles.warningTextMinimal]}>
          {MAINTENANCE_SCALE_VOLUNTEERS_SQL_HINT}
        </Text>
      ) : null}
      {error ? (
        <Text style={[styles.errorText, minimal && styles.errorTextMinimal]}>{error}</Text>
      ) : null}

      <View style={styles.block}>
        <FieldLabel minimal={minimal}>Tipo de escala</FieldLabel>
        <DropdownSelect
          options={scaleTypeDropdownOptions}
          selectedValue={selectedScaleTypeId ?? ''}
          onValueChange={setSelectedScaleTypeId}
          modalTitle="Tipo de escala"
          placeholder="Selecionar tipo de escala"
          searchPlaceholder="Buscar tipo de escala..."
          searchable
          variant={minimal ? 'minimal' : 'default'}
          style={styles.scaleTypeDropdown}
          disabled={rpcMissing}
        />
      </View>

      <View style={styles.block}>
        <FieldLabel minimal={minimal}>Associar servos</FieldLabel>
        <View style={styles.searchInputRow}>
          <TextInput
            style={[styles.searchInput, minimal && styles.searchInputMinimal]}
            placeholder="Nome completo"
            placeholderTextColor={minimal ? MINIMAL_UI.textMuted : '#64748B'}
            value={profileSearchQuery}
            onChangeText={setProfileSearchQuery}
            autoCapitalize="words"
            autoCorrect={false}
          />
          {hasProfileSearchQuery ? (
            <TouchableOpacity
              style={styles.clearSearchButton}
              onPress={handleClearProfileSearch}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Limpar busca de servos"
            >
              <FontAwesome
                name="times-circle"
                size={20}
                color={minimal ? MINIMAL_UI.icon : '#94A3B8'}
              />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <View style={[styles.block, styles.registeredBlock]}>
        <FieldLabel minimal={minimal}>Já associados</FieldLabel>
        <ScrollView style={styles.registeredScroll} nestedScrollEnabled>
          {loadingVolunteers ? (
            <CardLoadingState lines={3} compact minimal={minimal} />
          ) : registeredVolunteers.length ? (
            registeredVolunteers.map((volunteer, index) => {
              const isRemoving = removingVolunteerId === volunteer.id;

              return (
                <View
                  key={volunteer.id}
                  style={[
                    styles.registeredRow,
                    minimal && styles.registeredRowMinimal,
                    index % 2 === 1 &&
                      (minimal ? styles.registeredRowAltMinimal : styles.registeredRowAlt),
                  ]}
                >
                  <Text
                    style={[styles.registeredOrder, minimal && styles.registeredOrderMinimal]}
                  >
                    {volunteer.sequenceOrder ?? '—'}
                  </Text>
                  <Text
                    style={[styles.registeredName, minimal && styles.registeredNameMinimal]}
                    numberOfLines={2}
                  >
                    {volunteer.name}
                  </Text>
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => handleRemove(volunteer.id, volunteer.name)}
                    disabled={listBusy || rpcMissing}
                    activeOpacity={0.85}
                    accessibilityLabel={`Remover ${volunteer.name}`}
                  >
                    {isRemoving ? (
                      <ActivityIndicator color={dangerIcon} size="small" />
                    ) : (
                      <FontAwesome name="trash-o" size={17} color={dangerIcon} />
                    )}
                  </TouchableOpacity>
                </View>
              );
            })
          ) : (
            <Text style={[styles.hint, minimal && styles.hintMinimal]}>
              Nenhum servo neste tipo de escala ainda.
            </Text>
          )}
        </ScrollView>
      </View>

      {searchingProfiles ? <CardLoadingState lines={2} compact minimal={minimal} /> : null}

      <ScrollView
        style={styles.resultsScroll}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
      >
        {profileSearchQuery.trim().length >= 2 && !searchingProfiles && !profileResults.length ? (
          <Text style={[styles.hint, minimal && styles.hintMinimal]}>
            Nenhum perfil com esse nome.
          </Text>
        ) : null}

        {profileResults.map((profile) => {
          const alreadyRegistered = registeredNameKeys.has(
            profile.fullName.trim().toLocaleLowerCase('pt-BR')
          );

          return (
            <TouchableOpacity
              key={profile.id}
              style={[
                styles.resultRow,
                minimal && styles.resultRowMinimal,
                alreadyRegistered && styles.resultRowDisabled,
              ]}
              onPress={() => void handleAssociate(profile.id, profile.fullName)}
              disabled={listBusy || alreadyRegistered || rpcMissing}
              activeOpacity={0.85}
            >
              <Text
                style={[styles.resultName, minimal && styles.resultNameMinimal]}
                numberOfLines={2}
              >
                {profile.fullName}
              </Text>
              {alreadyRegistered ? (
                <Text style={[styles.resultBadge, minimal && styles.resultBadgeMinimal]}>
                  Já cadastrado
                </Text>
              ) : (
                <FontAwesome name="plus-circle" size={18} color={addIcon} />
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <TouchableOpacity style={styles.refreshLink} onPress={() => void reload()} activeOpacity={0.85}>
        <Text style={[styles.refreshLinkText, minimal && styles.refreshLinkTextMinimal]}>
          Atualizar
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    ...CONTAIN_WIDTH,
    flex: 1,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    padding: 12,
    minHeight: 0,
  },
  panelMinimal: {
    ...CONTAIN_WIDTH,
    paddingHorizontal: 0,
    paddingVertical: 4,
    borderRadius: 0,
    backgroundColor: MINIMAL_UI.background,
    overflow: 'hidden',
  },
  panelCentered: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 20,
  },
  sectionTitleWrap: {
    width: '100%',
    maxWidth: '100%',
    alignSelf: 'stretch',
    flexShrink: 0,
    zIndex: 2,
    backgroundColor: MINIMAL_UI.background,
  },
  sectionTitleMinimal: {
    ...MINIMAL_SECTION_TITLE,
    width: '100%',
    maxWidth: '100%',
    alignSelf: 'stretch',
    overflow: 'visible',
  },
  fieldLabel: {
    color: '#3A96DD',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  fieldLabelMinimal: {
    color: MINIMAL_UI.textMuted,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  block: {
    ...CONTAIN_WIDTH,
    marginBottom: 12,
    gap: 4,
  },
  registeredBlock: {
    marginBottom: 6,
  },
  hint: {
    color: 'rgba(58, 150, 221, 0.82)',
    fontSize: 12,
    lineHeight: 16,
    paddingVertical: 4,
  },
  hintMinimal: {
    color: MINIMAL_UI.textMuted,
    textAlign: 'left',
  },
  warningText: {
    color: '#FBBF24',
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 6,
  },
  warningTextMinimal: {
    color: '#B45309',
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 12,
    marginBottom: 6,
  },
  errorTextMinimal: {
    color: '#DC2626',
  },
  scaleTypeDropdown: {
    ...CONTAIN_WIDTH,
    flexGrow: 0,
    flexShrink: 1,
  },
  registeredScroll: {
    ...CONTAIN_WIDTH,
    flexGrow: 0,
    maxHeight: REGISTERED_LIST_MAX_HEIGHT,
  },
  registeredRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(52, 211, 153, 0.35)',
    maxWidth: '100%',
    minWidth: 0,
  },
  registeredRowMinimal: {
    borderBottomColor: MINIMAL_UI.divider,
    backgroundColor: MINIMAL_UI.background,
    paddingHorizontal: 0,
  },
  registeredRowAlt: {
    backgroundColor: 'rgba(30, 41, 59, 0.35)',
  },
  registeredRowAltMinimal: {
    backgroundColor: MINIMAL_UI.rowHover,
  },
  registeredOrder: {
    width: 28,
    color: '#6EE7B7',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
    flexShrink: 0,
  },
  registeredOrderMinimal: {
    color: MINIMAL_UI.accent,
  },
  registeredName: {
    flex: 1,
    minWidth: 0,
    color: '#3A96DD',
    fontSize: 13,
    fontWeight: '700',
  },
  registeredNameMinimal: {
    color: MINIMAL_UI.text,
  },
  removeButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  searchInputRow: {
    ...CONTAIN_WIDTH,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    color: '#3A96DD',
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInputMinimal: {
    borderColor: MINIMAL_UI.border,
    color: MINIMAL_UI.text,
    backgroundColor: MINIMAL_UI.background,
    borderRadius: 12,
  },
  clearSearchButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  resultsScroll: {
    ...CONTAIN_WIDTH,
    flex: 1,
    minHeight: 48,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(52, 211, 153, 0.35)',
    maxWidth: '100%',
    minWidth: 0,
  },
  resultRowMinimal: {
    borderBottomColor: MINIMAL_UI.divider,
    backgroundColor: MINIMAL_UI.background,
    paddingHorizontal: 0,
  },
  resultRowDisabled: {
    opacity: 0.55,
  },
  resultName: {
    flex: 1,
    minWidth: 0,
    color: '#3A96DD',
    fontSize: 14,
    fontWeight: '700',
  },
  resultNameMinimal: {
    color: MINIMAL_UI.text,
  },
  resultBadge: {
    color: 'rgba(58, 150, 221, 0.82)',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    flexShrink: 0,
  },
  resultBadgeMinimal: {
    color: MINIMAL_UI.textMuted,
    textTransform: 'none',
  },
  refreshLink: {
    alignSelf: 'center',
    paddingTop: 6,
  },
  refreshLinkText: {
    color: '#818CF8',
    fontSize: 12,
    fontWeight: '700',
  },
  refreshLinkTextMinimal: {
    color: MINIMAL_UI.accent,
  },
});

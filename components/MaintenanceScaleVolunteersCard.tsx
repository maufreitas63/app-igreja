import { CardLoadingState } from '@/components/ui/CardLoadingState';
import { DropdownSelect } from '@/components/ui/DropdownSelect';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { useMaintenanceScaleVolunteers } from '@/hooks/useMaintenanceScaleVolunteers';
import {
  computeMaintenanceContentHeight,
  maintenancePanelStyles,
} from '@/lib/maintenanceCardStyles';
import { MAINTENANCE_SCALE_VOLUNTEERS_SQL_HINT } from '@/hooks/useMaintenanceScaleVolunteers';
import { confirmDialog } from '@/lib/confirmDialog';
import { SCALE_VOLUNTEERS_MENU_LABEL } from '@/lib/appDrawerMenu';
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
          Carregando tipos de escala…
        </Text>
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
        <FontAwesome name="users" size={28} color={minimal ? MINIMAL_UI.textMuted : '#64748B'} />
        <Text
          style={
            minimal
              ? styles.sectionTitleMinimal
              : maintenancePanelStyles.panelTitleMuted
          }
        >
          {PANEL_TITLE}
        </Text>
        <Text
          style={[
            maintenancePanelStyles.panelHint,
            minimal && styles.panelHintMinimal,
          ]}
        >
          Cadastre tipos de escala no card Tipos de Escala.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.panel, minimal && styles.panelMinimal, { height: contentHeight }]}>
      <Text style={minimal ? styles.sectionTitleMinimal : maintenancePanelStyles.panelTitle}>
        {PANEL_TITLE}
      </Text>

      {rpcMissing ? (
        <Text style={[styles.warningText, minimal && styles.warningTextMinimal]}>
          {MAINTENANCE_SCALE_VOLUNTEERS_SQL_HINT}
        </Text>
      ) : null}
      {error ? (
        <Text style={[styles.errorText, minimal && styles.errorTextMinimal]}>{error}</Text>
      ) : null}

      <View style={[styles.scaleTypePickerSection, minimal && styles.scaleTypePickerSectionMinimal]}>
        <SectionLabel variant="maintenance" tight>
          Tipo de escala
        </SectionLabel>
        <DropdownSelect
          options={scaleTypeDropdownOptions}
          selectedValue={selectedScaleTypeId ?? ''}
          onValueChange={setSelectedScaleTypeId}
          modalTitle="Tipo de escala"
          placeholder="Selecionar tipo de escala"
          searchPlaceholder="Buscar tipo de escala..."
          searchable
          style={[styles.scaleTypeDropdown, minimal && styles.scaleTypeDropdownMinimal]}
          disabled={rpcMissing}
        />
      </View>

      <SectionLabel variant="maintenance">Associar servos</SectionLabel>
      <View style={[styles.searchInputRow, minimal && styles.searchInputRowMinimal]}>
        <TextInput
          style={[styles.searchInput, minimal && styles.searchInputMinimal]}
          placeholder="Nome completo"
          placeholderTextColor="#64748B"
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
            <FontAwesome name="times-circle" size={20} color="#94A3B8" />
          </TouchableOpacity>
        ) : null}
      </View>

      <SectionLabel variant="maintenance" tight>Já associados</SectionLabel>
      <ScrollView style={styles.registeredScroll} nestedScrollEnabled>
        {loadingVolunteers ? (
          <CardLoadingState lines={3} compact />
        ) : registeredVolunteers.length ? (
          registeredVolunteers.map((volunteer, index) => {
            const isRemoving = removingVolunteerId === volunteer.id;

            return (
              <View
                key={volunteer.id}
                style={[styles.registeredRow, index % 2 === 1 && styles.registeredRowAlt]}
              >
                <Text style={styles.registeredOrder}>
                  {volunteer.sequenceOrder ?? '—'}
                </Text>
                <Text style={styles.registeredName} numberOfLines={2}>
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
                    <ActivityIndicator color="#FCA5A5" size="small" />
                  ) : (
                    <FontAwesome name="trash-o" size={17} color="#FCA5A5" />
                  )}
                </TouchableOpacity>
              </View>
            );
          })
        ) : (
          <Text style={styles.panelHintCompact}>Nenhum servo neste tipo de escala ainda.</Text>
        )}
      </ScrollView>

      {searchingProfiles ? <CardLoadingState lines={2} compact /> : null}

      <ScrollView style={styles.resultsScroll} nestedScrollEnabled keyboardShouldPersistTaps="handled">
        {profileSearchQuery.trim().length >= 2 && !searchingProfiles && !profileResults.length ? (
          <Text style={styles.panelHintCompact}>Nenhum perfil com esse nome.</Text>
        ) : null}

        {profileResults.map((profile) => {
          const alreadyRegistered = registeredNameKeys.has(
            profile.fullName.trim().toLocaleLowerCase('pt-BR')
          );

          return (
            <TouchableOpacity
              key={profile.id}
              style={[styles.resultRow, alreadyRegistered && styles.resultRowDisabled]}
              onPress={() => void handleAssociate(profile.id, profile.fullName)}
              disabled={listBusy || alreadyRegistered || rpcMissing}
              activeOpacity={0.85}
            >
              <Text style={styles.resultName} numberOfLines={2}>
                {profile.fullName}
              </Text>
              {alreadyRegistered ? (
                <Text style={styles.resultBadge}>Já cadastrado</Text>
              ) : (
                <FontAwesome name="plus-circle" size={18} color="#6EE7B7" />
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <TouchableOpacity style={styles.refreshLink} onPress={() => void reload()} activeOpacity={0.85}>
        <Text style={styles.refreshLinkText}>Atualizar</Text>
      </TouchableOpacity>
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
  },
  panelCentered: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 20,
  },
  panelTitle: {
    color: '#3A96DD',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 8,
  },
  panelTitleMuted: {
    color: 'rgba(58, 150, 221, 0.82)',
    fontSize: 17,
    fontWeight: '800',
  },
  panelHint: {
    color: 'rgba(58, 150, 221, 0.82)',
    fontSize: 12,
    lineHeight: 17,
    paddingVertical: 6,
  },
  panelHintCompact: {
    color: 'rgba(58, 150, 221, 0.82)',
    fontSize: 12,
    lineHeight: 16,
    paddingVertical: 4,
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
  scaleTypePickerSection: {
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    marginBottom: 8,
    gap: 4,
  },
  scaleTypePickerSectionMinimal: {
    alignSelf: 'stretch',
  },
  scaleTypeDropdown: {
    width: '100%',
    flex: 0,
    flexGrow: 0,
    alignSelf: 'stretch',
    height: 44,
  },
  scaleTypeDropdownMinimal: {
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
  },
  sectionLabel: {
    color: '#3A96DD',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  sectionLabelTight: {
    color: '#3A96DD',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 2,
    marginBottom: 4,
  },
  registeredScroll: {
    flexGrow: 0,
    maxHeight: REGISTERED_LIST_MAX_HEIGHT,
    marginBottom: 6,
  },
  registeredRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(52, 211, 153, 0.35)',
  },
  registeredRowAlt: {
    backgroundColor: 'rgba(30, 41, 59, 0.35)',
  },
  registeredOrder: {
    width: 28,
    color: '#6EE7B7',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  registeredName: {
    flex: 1,
    minWidth: 0,
    color: '#3A96DD',
    fontSize: 13,
    fontWeight: '700',
  },
  removeButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
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
  clearSearchButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  resultsScroll: {
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
  resultBadge: {
    color: 'rgba(58, 150, 221, 0.82)',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  inlineLoader: {
    marginVertical: 4,
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
  panelMinimal: {
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    alignSelf: 'stretch',
    paddingHorizontal: 0,
    paddingVertical: 4,
    borderRadius: 0,
    backgroundColor: MINIMAL_UI.background,
    overflow: 'hidden',
  },
  sectionTitleMinimal: {
    ...MINIMAL_SECTION_TITLE,
    width: '100%',
    maxWidth: '100%',
    alignSelf: 'stretch',
  },
  panelHintMinimal: {
    color: MINIMAL_UI.textMuted,
    textAlign: 'center',
  },
  warningTextMinimal: {
    color: '#B45309',
  },
  errorTextMinimal: {
    color: '#DC2626',
  },
  searchInputRowMinimal: {
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
  },
  searchInputMinimal: {
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    borderColor: MINIMAL_UI.border,
    color: MINIMAL_UI.text,
    backgroundColor: MINIMAL_UI.background,
  },
});

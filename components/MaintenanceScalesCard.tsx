import { ScaleSwapRequestModal } from '@/components/ScaleSwapRequestModal';
import { CardLoadingState } from '@/components/ui/CardLoadingState';
import { DropdownSelect } from '@/components/ui/DropdownSelect';
import { MonthlyDatePickerModal } from '@/components/ui/MonthlyDatePickerModal';
import { ScaleVolunteerSelect } from '@/components/ScaleVolunteerSelect';
import { useMaintenanceScales } from '@/hooks/useMaintenanceScales';
import {
  computeMaintenanceContentHeight,
  maintenancePanelStyles,
} from '@/lib/maintenanceCardStyles';
import { confirmDialog } from '@/lib/confirmDialog';
import { SCALE_SCHEDULING_MENU_LABEL, SCALE_VOLUNTEERS_MENU_LABEL } from '@/lib/appDrawerMenu';
import {
  formatScaleServiceDateLabel,
  MAINTENANCE_SCALES_SQL_HINT,
  parseScaleServiceDateInput,
} from '@/lib/maintenanceScales';
import { CONTAIN_WIDTH } from '@/lib/minimalPresentation';
import { MINIMAL_SECTION_TITLE, MINIMAL_UI } from '@/lib/minimalUiTheme';
import { mapLegacyRoomDisplayLabel } from '@/lib/roomDisplayLabels';
import {
  listScaleSwapsAdmin,
  undoScaleSwap,
  type ScaleSwapAdminRow,
} from '@/lib/scaleSwapApi';
import { FontAwesome, MaterialIcons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import Toast from 'react-native-toast-message';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

type Props = {
  isActive?: boolean;
  panelHeight: number;
  minimal?: boolean;
};

const PANEL_TITLE = SCALE_SCHEDULING_MENU_LABEL;

function FieldLabel({ children, minimal }: { children: string; minimal: boolean }) {
  return (
    <Text style={minimal ? styles.fieldLabelMinimal : styles.fieldLabel}>{children}</Text>
  );
}

export function MaintenanceScalesCard({
  isActive = true,
  panelHeight,
  minimal = false,
}: Props) {
  const {
    scaleTypes,
    selectedScaleTypeId,
    setSelectedScaleTypeId,
    historyForSelectedType,
    activeVolunteers,
    loading,
    loadingVolunteers,
    saving,
    removingScaleId,
    buildingBatch,
    batchPreview,
    batchPreviewMessage,
    error,
    rpcMissing,
    reload,
    registerScale,
    removeScale,
    prepareBatchPreview,
    cancelBatchPreview,
    confirmBatchPreview,
  } = useMaintenanceScales(isActive);

  const [showNewForm, setShowNewForm] = useState(false);
  const [selectedVolunteerId, setSelectedVolunteerId] = useState('');
  const [serviceDateInput, setServiceDateInput] = useState('');
  const [serviceDatePickerVisible, setServiceDatePickerVisible] = useState(false);
  const [swapRows, setSwapRows] = useState<ScaleSwapAdminRow[]>([]);
  const [interveneEntry, setInterveneEntry] = useState<{
    id: string;
    volunteerName: string;
    serviceDate: string;
  } | null>(null);
  const [undoingId, setUndoingId] = useState<string | null>(null);

  const contentHeight = computeMaintenanceContentHeight(panelHeight);

  useEffect(() => {
    setShowNewForm(false);
    setSelectedVolunteerId('');
    setServiceDateInput('');
    setServiceDatePickerVisible(false);
  }, [selectedScaleTypeId]);

  useEffect(() => {
    if (!showNewForm) {
      return;
    }

    if (!activeVolunteers.length) {
      setSelectedVolunteerId('');
      return;
    }

    setSelectedVolunteerId((current) => {
      if (current && activeVolunteers.some((volunteer) => volunteer.id === current)) {
        return current;
      }

      return activeVolunteers[0].id;
    });
  }, [activeVolunteers, showNewForm]);

  const volunteerSelectOptions = useMemo(
    () => activeVolunteers.map((volunteer) => ({ id: volunteer.id, label: volunteer.name })),
    [activeVolunteers]
  );

  const scaleTypeDropdownOptions = useMemo(
    () =>
      scaleTypes.map((type) => ({
        value: type.id,
        label: mapLegacyRoomDisplayLabel(type.name),
      })),
    [scaleTypes]
  );

  const volunteerDropdownOptions = useMemo(
    () =>
      volunteerSelectOptions.map((option) => ({
        value: option.id,
        label: option.label,
      })),
    [volunteerSelectOptions]
  );

  useEffect(() => {
    if (!selectedScaleTypeId) {
      setSwapRows([]);
      return;
    }

    let cancelled = false;

    void listScaleSwapsAdmin(selectedScaleTypeId)
      .then((rows) => {
        if (!cancelled) {
          setSwapRows(rows);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSwapRows([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedScaleTypeId, historyForSelectedType]);

  const acceptedSwapByLogId = useMemo(() => {
    const map = new Map<string, ScaleSwapAdminRow>();

    for (const row of swapRows) {
      if (row.status === 'aceito' && row.escalaIdOrigem) {
        map.set(row.escalaIdOrigem, row);
      }
    }

    return map;
  }, [swapRows]);

  const handleRegister = async () => {
    const serviceDate = parseScaleServiceDateInput(serviceDateInput);

    if (!selectedVolunteerId) {
      Alert.alert('Escala', 'Selecione um servo.');
      return;
    }

    if (!serviceDate) {
      Alert.alert('Escala', 'Informe uma data válida (DD/MM/AA).');
      return;
    }

    const result = await registerScale(selectedVolunteerId, serviceDate);

    if (!result.success) {
      Alert.alert('Escala', result.message);
      return;
    }

    Toast.show({
      type: 'success',
      text1: 'Escala registrada',
      text2: result.message,
      visibilityTime: 2500,
    });
  };

  const handleBatchScale = async () => {
    setShowNewForm(false);

    const result = await prepareBatchPreview();

    if (result.success) {
      Toast.show({
        type: 'success',
        text1: 'Escala em bloco',
        text2: result.message,
        visibilityTime: 3500,
      });
      return;
    }

    Toast.show({
      type: 'error',
      text1: 'Escala em bloco',
      text2: result.message,
      visibilityTime: 4500,
    });

    if (Platform.OS !== 'web') {
      Alert.alert('Escala em bloco', result.message);
    }
  };

  const runConfirmBatch = async () => {
    const result = await confirmBatchPreview();

    if (!result.success) {
      Alert.alert('Escala em bloco', result.message);
      return;
    }

    Alert.alert('Escala em bloco', result.message);
  };

  const handleConfirmBatch = async () => {
    const count = batchPreview?.length ?? 0;
    const prompt = `Gravar ${count} escala(s) de domingo no banco?`;
    const confirmed = await confirmDialog('Confirmar escala em bloco', prompt, 'Gravar', 'Cancelar');

    if (confirmed) {
      void runConfirmBatch();
    }
  };

  const runRemoveScale = async (scaleLogId: string) => {
    const result = await removeScale(scaleLogId);

    if (!result.success) {
      Alert.alert('Escala', result.message);
      return;
    }

    Toast.show({
      type: 'success',
      text1: 'Escala removida',
      text2: result.message,
      visibilityTime: 2500,
    });
  };

  const handleRemoveScale = async (
    scaleLogId: string,
    volunteerName: string,
    serviceDate: string
  ) => {
    const dateLabel = formatScaleServiceDateLabel(serviceDate);
    const prompt = `Excluir a escala de ${volunteerName} em ${dateLabel}?`;
    const confirmed = await confirmDialog('Excluir escala', prompt, 'Excluir', 'Cancelar', {
      destructive: true,
    });

    if (confirmed) {
      void runRemoveScale(scaleLogId);
    }
  };

  const handleUndoSwap = async (swapId: string) => {
    const confirmed = await confirmDialog(
      'Desfazer troca',
      'Restaurar o servo original nesta data? O ciclo futuro não será alterado.',
      'Desfazer',
      'Cancelar',
      { destructive: true }
    );

    if (!confirmed) {
      return;
    }

    setUndoingId(swapId);

    try {
      const result = await undoScaleSwap(swapId);

      if (!result.success) {
        Alert.alert('Troca de escala', result.message);
        return;
      }

      Toast.show({
        type: 'success',
        text1: 'Troca desfeita',
        text2: result.message,
        visibilityTime: 2500,
      });
      await reload();
    } catch (undoError) {
      Alert.alert(
        'Troca de escala',
        undoError instanceof Error ? undoError.message : 'Não foi possível desfazer.'
      );
    } finally {
      setUndoingId(null);
    }
  };

  const actionsBusy = saving || buildingBatch || removingScaleId !== null || undoingId !== null;

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
          Carregando escalas…
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
          maintenancePanelStyles.panelCentered,
          { height: contentHeight },
        ]}
      >
        <FontAwesome name="calendar" size={28} color={minimal ? MINIMAL_UI.textMuted : '#64748B'} />
        <Text
          style={
            minimal
              ? styles.sectionTitle
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
          Nenhum tipo de escala ativo. Cadastre no card Tipos de Escala.
        </Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => void reload()} activeOpacity={0.85}>
          <Text style={styles.retryButtonText}>Atualizar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.panel, minimal && styles.panelMinimal, { height: contentHeight }]}>
      <Text style={minimal ? styles.sectionTitle : maintenancePanelStyles.panelTitle}>
        {PANEL_TITLE}
      </Text>
      {!minimal ? <View style={maintenancePanelStyles.panelSubtitleSpacer} /> : null}

      {rpcMissing ? (
        <Text style={[styles.warningText, minimal && styles.warningTextMinimal]}>
          {MAINTENANCE_SCALES_SQL_HINT}
        </Text>
      ) : null}
      {error ? (
        <Text style={[styles.errorText, minimal && styles.errorTextMinimal]}>{error}</Text>
      ) : null}

      <View style={[styles.scaleTypePickerSection, minimal && styles.scaleTypePickerSectionMinimal]}>
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
          style={[styles.scaleTypeDropdown, minimal && styles.scaleTypeDropdownMinimal]}
          disabled={rpcMissing}
        />
      </View>

      <View style={[styles.toolbarRow, minimal && styles.toolbarRowMinimal]}>
        <Text style={[styles.historyTitle, minimal && styles.historyTitleMinimal]}>Histórico</Text>
        <View style={[styles.toolbarActions, minimal && styles.toolbarActionsMinimal]}>
          <TouchableOpacity
            style={[
              styles.batchButton,
              minimal && styles.batchButtonMinimal,
              (batchPreview?.length ?? 0) > 0 && styles.batchButtonActive,
              minimal && (batchPreview?.length ?? 0) > 0 && styles.batchButtonActiveMinimal,
            ]}
            onPress={() => void handleBatchScale()}
            activeOpacity={0.85}
            disabled={actionsBusy || rpcMissing}
          >
            {buildingBatch ? (
              <ActivityIndicator color={minimal ? MINIMAL_UI.accent : '#C7D2FE'} size="small" />
            ) : (
              <Text style={[styles.batchButtonText, minimal && styles.batchButtonTextMinimal]}>
                Escala em bloco
              </Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.newButton,
              minimal && styles.newButtonMinimal,
              showNewForm && styles.newButtonActive,
              minimal && showNewForm && styles.newButtonActiveMinimal,
            ]}
            onPress={() => setShowNewForm((current) => !current)}
            activeOpacity={0.85}
            disabled={actionsBusy || rpcMissing}
          >
            <FontAwesome
              name={showNewForm ? 'minus' : 'plus'}
              size={12}
              color={minimal ? MINIMAL_UI.onDark : '#0f172a'}
            />
            <Text style={[styles.newButtonText, minimal && styles.newButtonTextMinimal]}>
              {showNewForm ? 'Fechar' : 'Nova escala'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {buildingBatch ? (
        <Text style={[styles.batchStatusText, minimal && styles.batchStatusTextMinimal]}>
          Gerando prévia da escala em bloco…
        </Text>
      ) : batchPreviewMessage && !batchPreview?.length ? (
        <Text style={[styles.batchStatusError, minimal && styles.batchStatusErrorMinimal]}>
          {batchPreviewMessage}
        </Text>
      ) : null}

      {batchPreview?.length ? (
        <View style={[styles.previewCard, minimal && styles.previewCardMinimal]}>
          <Text style={[styles.previewTitle, minimal && styles.previewTitleMinimal]}>
            Prévia — escala em bloco
          </Text>
          {batchPreviewMessage ? (
            <Text style={[styles.previewSubtitle, minimal && styles.previewSubtitleMinimal]}>
              {batchPreviewMessage}
            </Text>
          ) : null}
          <ScrollView
            style={[styles.previewScroll, minimal && styles.previewScrollMinimal]}
            nestedScrollEnabled
          >
            {batchPreview.map((entry, index) => (
              <View
                key={`${entry.serviceDate}-${entry.volunteerId}`}
                style={[
                  styles.previewRow,
                  minimal && styles.previewRowMinimal,
                  index % 2 === 1 && styles.previewRowAlt,
                  minimal && index % 2 === 1 && styles.previewRowAltMinimal,
                ]}
              >
                <Text style={[styles.previewOrder, minimal && styles.previewOrderMinimal]}>
                  {entry.sequenceOrder}
                </Text>
                <Text style={[styles.previewDate, minimal && styles.previewDateMinimal]}>
                  {formatScaleServiceDateLabel(entry.serviceDate)}
                </Text>
                <Text
                  style={[styles.previewName, minimal && styles.previewNameMinimal]}
                  numberOfLines={2}
                >
                  {entry.volunteerName}
                </Text>
              </View>
            ))}
          </ScrollView>
          <View style={[styles.previewActions, minimal && styles.previewActionsMinimal]}>
            <TouchableOpacity
              style={[styles.previewCancelButton, minimal && styles.previewCancelButtonMinimal]}
              onPress={cancelBatchPreview}
              disabled={actionsBusy}
              activeOpacity={0.85}
            >
              <Text style={[styles.previewCancelText, minimal && styles.previewCancelTextMinimal]}>
                Cancelar
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.previewConfirmButton,
                minimal && styles.previewConfirmButtonMinimal,
                actionsBusy && styles.saveButtonDisabled,
              ]}
              onPress={() => handleConfirmBatch()}
              disabled={actionsBusy}
              activeOpacity={0.85}
            >
              {saving ? (
                <ActivityIndicator color={minimal ? MINIMAL_UI.onDark : '#0f172a'} size="small" />
              ) : (
                <Text style={[styles.previewConfirmText, minimal && styles.previewConfirmTextMinimal]}>
                  Gravar bloco
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {showNewForm ? (
        <View style={[styles.formCard, minimal && styles.formCardMinimal]}>
          <Text style={[styles.formTitle, minimal && styles.formTitleMinimal]}>Nova escala</Text>

          <FieldLabel minimal={minimal}>Servo</FieldLabel>
          {loadingVolunteers ? (
            <ActivityIndicator
              color={minimal ? MINIMAL_UI.accent : '#818CF8'}
              style={styles.formLoader}
            />
          ) : activeVolunteers.length ? (
            minimal ? (
              <DropdownSelect
                options={volunteerDropdownOptions}
                selectedValue={selectedVolunteerId}
                onValueChange={setSelectedVolunteerId}
                modalTitle="Selecionar servo"
                placeholder="Selecionar servo"
                searchPlaceholder="Buscar servo..."
                searchable
                variant="minimal"
                style={[styles.volunteerDropdown, styles.volunteerDropdownMinimal]}
                disabled={rpcMissing}
              />
            ) : (
              <ScaleVolunteerSelect
                options={volunteerSelectOptions}
                value={selectedVolunteerId}
                onValueChange={setSelectedVolunteerId}
              />
            )
          ) : (
            <Text style={[styles.panelHint, minimal && styles.panelHintMinimal]}>
              Nenhum servo ativo para este tipo. Cadastre em {SCALE_VOLUNTEERS_MENU_LABEL}.
            </Text>
          )}

          <FieldLabel minimal={minimal}>Data do serviço</FieldLabel>
          <Pressable
            onPress={() => setServiceDatePickerVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Selecionar data do serviço"
          >
            <View style={[styles.dateInput, styles.dateInputTrigger, minimal && styles.dateInputMinimal]}>
              <Text
                style={[
                  styles.dateInputText,
                  minimal && styles.dateInputTextMinimal,
                  !serviceDateInput.trim() && styles.dateInputPlaceholder,
                  minimal && !serviceDateInput.trim() && styles.dateInputPlaceholderMinimal,
                ]}
              >
                {serviceDateInput.trim() || 'DD/MM/AAAA'}
              </Text>
              <MaterialIcons
                name="calendar-today"
                size={18}
                color={minimal ? MINIMAL_UI.textMuted : '#94A3B8'}
              />
            </View>
          </Pressable>

          <TouchableOpacity
            style={[
              styles.saveButton,
              minimal && styles.saveButtonMinimal,
              (saving || !activeVolunteers.length) && styles.saveButtonDisabled,
            ]}
            onPress={() => void handleRegister()}
            disabled={saving || !activeVolunteers.length || rpcMissing}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color={minimal ? MINIMAL_UI.onDark : '#0f172a'} size="small" />
            ) : (
              <Text style={[styles.saveButtonText, minimal && styles.saveButtonTextMinimal]}>
                Salvar escala
              </Text>
            )}
          </TouchableOpacity>
        </View>
      ) : null}

      <ScrollView
        style={[styles.historyScroll, minimal && styles.historyScrollMinimal]}
        contentContainerStyle={styles.historyContent}
      >
        {historyForSelectedType.length ? (
          historyForSelectedType.map((entry, index) => {
            const isRemoving = removingScaleId === entry.id;
            const acceptedSwap = acceptedSwapByLogId.get(entry.id);

            return (
              <View
                key={entry.id}
                style={[
                  styles.historyRow,
                  minimal && styles.historyRowMinimal,
                  index % 2 === 1 && styles.historyRowAlt,
                  minimal && index % 2 === 1 && styles.historyRowAltMinimal,
                ]}
              >
                <Text style={[styles.historyDate, minimal && styles.historyDateMinimal]}>
                  {formatScaleServiceDateLabel(entry.serviceDate)}
                </Text>
                <View style={styles.historyMain}>
                  <Text
                    style={[styles.historyName, minimal && styles.historyNameMinimal]}
                    numberOfLines={2}
                  >
                    {entry.volunteerName}
                  </Text>
                  {acceptedSwap ? (
                    <Text style={styles.swapSeal}>Troca Realizada</Text>
                  ) : null}
                </View>
                <TouchableOpacity
                  style={styles.historyActionButton}
                  onPress={() =>
                    setInterveneEntry({
                      id: entry.id,
                      volunteerName: entry.volunteerName,
                      serviceDate: entry.serviceDate,
                    })
                  }
                  disabled={actionsBusy || rpcMissing}
                  activeOpacity={0.85}
                  accessibilityLabel={`Intervir na escala de ${entry.volunteerName}`}
                >
                  <Text style={styles.historyActionLabel}>Intervir</Text>
                </TouchableOpacity>
                {acceptedSwap ? (
                  <TouchableOpacity
                    style={styles.historyActionButton}
                    onPress={() => void handleUndoSwap(acceptedSwap.id)}
                    disabled={actionsBusy || rpcMissing}
                    activeOpacity={0.85}
                    accessibilityLabel="Desfazer troca"
                  >
                    {undoingId === acceptedSwap.id ? (
                      <ActivityIndicator
                        color={minimal ? '#DC2626' : '#FCA5A5'}
                        size="small"
                      />
                    ) : (
                      <Text style={styles.historyActionLabel}>Desfazer</Text>
                    )}
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                  style={styles.historyDeleteButton}
                  onPress={() =>
                    void handleRemoveScale(entry.id, entry.volunteerName, entry.serviceDate)
                  }
                  disabled={actionsBusy || rpcMissing}
                  activeOpacity={0.85}
                  accessibilityLabel={`Excluir escala de ${entry.volunteerName} em ${formatScaleServiceDateLabel(entry.serviceDate)}`}
                >
                  {isRemoving ? (
                    <ActivityIndicator
                      color={minimal ? '#DC2626' : '#FCA5A5'}
                      size="small"
                    />
                  ) : (
                    <FontAwesome
                      name="trash-o"
                      size={17}
                      color={minimal ? '#DC2626' : '#FCA5A5'}
                    />
                  )}
                </TouchableOpacity>
              </View>
            );
          })
        ) : (
          <View style={styles.emptyHistory}>
            <Text style={[styles.panelHint, minimal && styles.panelHintMinimal]}>
              Nenhuma escala futura para este tipo.
            </Text>
          </View>
        )}
      </ScrollView>

      <MonthlyDatePickerModal
        visible={serviceDatePickerVisible}
        value={serviceDateInput}
        title="Data do serviço"
        variant={minimal ? 'minimal' : 'default'}
        onClose={() => setServiceDatePickerVisible(false)}
        onConfirm={(dateInput) => setServiceDateInput(dateInput)}
      />

      <ScaleSwapRequestModal
        visible={interveneEntry !== null}
        mode="leader"
        escalaLogId={interveneEntry?.id ?? null}
        volunteerName={interveneEntry?.volunteerName ?? ''}
        serviceDate={interveneEntry?.serviceDate ?? ''}
        scaleName={
          scaleTypes.find((type) => type.id === selectedScaleTypeId)?.name ?? 'Escala'
        }
        onClose={() => setInterveneEntry(null)}
        onDone={() => {
          setInterveneEntry(null);
          void reload();
        }}
      />
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
  },
  panelSubtitle: {
    color: 'rgba(58, 150, 221, 0.82)',
    fontSize: 11,
    marginTop: 2,
    marginBottom: 8,
  },
  panelTitleMuted: {
    color: 'rgba(58, 150, 221, 0.82)',
    fontSize: 17,
    fontWeight: '800',
  },
  panelHint: {
    color: 'rgba(58, 150, 221, 0.82)',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
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
    ...CONTAIN_WIDTH,
    marginBottom: 8,
    gap: 4,
  },
  scaleTypePickerSectionMinimal: {
    alignSelf: 'stretch',
  },
  scaleTypeDropdown: {
    ...CONTAIN_WIDTH,
    flexGrow: 0,
    flexShrink: 1,
  },
  scaleTypeDropdownMinimal: {
    ...CONTAIN_WIDTH,
  },
  volunteerDropdown: {
    ...CONTAIN_WIDTH,
    flexGrow: 0,
    flexShrink: 1,
  },
  volunteerDropdownMinimal: {
    ...CONTAIN_WIDTH,
  },
  toolbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 12,
    marginBottom: 8,
    maxWidth: '100%',
    minWidth: 0,
  },
  toolbarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
    minWidth: 0,
  },
  historyTitle: {
    color: '#3A96DD',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    flexShrink: 0,
  },
  batchStatusText: {
    color: '#1B4F8A',
    fontSize: 11,
    marginBottom: 8,
  },
  batchStatusError: {
    color: '#FCA5A5',
    fontSize: 11,
    marginBottom: 8,
    lineHeight: 15,
  },
  batchButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#6366F1',
    backgroundColor: 'rgba(49, 46, 129, 0.45)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    minWidth: 108,
    alignItems: 'center',
    justifyContent: 'center',
  },
  batchButtonActive: {
    borderColor: '#3A96DD',
    backgroundColor: 'rgba(99, 102, 241, 0.55)',
  },
  batchButtonText: {
    color: '#3A96DD',
    fontSize: 11,
    fontWeight: '800',
  },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    backgroundColor: '#3A96DD',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  newButtonActive: {
    backgroundColor: '#94A3B8',
  },
  newButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  previewCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#6366F1',
    backgroundColor: 'rgba(49, 46, 129, 0.35)',
    padding: 10,
    marginBottom: 10,
    maxHeight: 200,
    maxWidth: '100%',
    minWidth: 0,
  },
  previewTitle: {
    color: '#3A96DD',
    fontSize: 13,
    fontWeight: '800',
  },
  previewSubtitle: {
    color: '#1B4F8A',
    fontSize: 11,
    marginTop: 2,
    marginBottom: 6,
  },
  previewScroll: {
    maxHeight: 110,
    marginBottom: 8,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#4338CA',
    maxWidth: '100%',
    minWidth: 0,
  },
  previewRowAlt: {
    backgroundColor: 'rgba(30, 27, 75, 0.35)',
  },
  previewOrder: {
    width: 24,
    color: '#6EE7B7',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
    flexShrink: 0,
  },
  previewDate: {
    minWidth: 88,
    flexShrink: 0,
    color: '#3A96DD',
    fontSize: 12,
    fontWeight: '800',
  },
  previewName: {
    flex: 1,
    minWidth: 0,
    color: '#3A96DD',
    fontSize: 13,
    fontWeight: '600',
  },
  previewActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  previewCancelButton: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  previewCancelText: {
    color: '#3A96DD',
    fontSize: 12,
    fontWeight: '700',
  },
  previewConfirmButton: {
    borderRadius: 8,
    backgroundColor: '#3A96DD',
    paddingHorizontal: 14,
    paddingVertical: 8,
    minWidth: 108,
    alignItems: 'center',
  },
  previewConfirmText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  formCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    padding: 12,
    gap: 8,
    marginBottom: 10,
    maxWidth: '100%',
    minWidth: 0,
  },
  formTitle: {
    color: '#3A96DD',
    fontSize: 14,
    fontWeight: '800',
  },
  fieldLabel: {
    color: 'rgba(58, 150, 221, 0.82)',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    minHeight: 44,
    justifyContent: 'center',
  },
  picker: {
    color: '#3A96DD',
    height: 44,
  },
  pickerItem: {
    color: '#3A96DD',
    fontSize: 14,
  },
  dateInput: {
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dateInputTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  dateInputText: {
    flex: 1,
    color: '#3A96DD',
    fontSize: 15,
  },
  dateInputPlaceholder: {
    color: 'rgba(58, 150, 221, 0.82)',
  },
  formLoader: {
    marginVertical: 8,
  },
  saveButton: {
    marginTop: 4,
    borderRadius: 10,
    backgroundColor: '#10b981',
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.55,
  },
  saveButtonText: {
    color: '#022c22',
    fontWeight: '800',
    fontSize: 14,
  },
  historyScroll: {
    flex: 1,
    minHeight: 0,
    maxWidth: '100%',
    minWidth: 0,
  },
  historyContent: {
    paddingBottom: 8,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(52, 211, 153, 0.35)',
    maxWidth: '100%',
    minWidth: 0,
  },
  historyRowAlt: {
    backgroundColor: 'rgba(30, 41, 59, 0.35)',
  },
  historyDate: {
    minWidth: 96,
    flexShrink: 0,
    color: '#6EE7B7',
    fontSize: 13,
    fontWeight: '800',
  },
  historyName: {
    flex: 1,
    minWidth: 0,
    color: '#3A96DD',
    fontSize: 14,
    fontWeight: '600',
  },
  historyMain: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  swapSeal: {
    alignSelf: 'flex-start',
    backgroundColor: '#DCFCE7',
    color: '#166534',
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: 'hidden',
    textTransform: 'uppercase',
  },
  historyActionButton: {
    minHeight: 28,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  historyActionLabel: {
    color: '#3A96DD',
    fontSize: 11,
    fontWeight: '800',
  },
  historyDeleteButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  emptyHistory: {
    paddingVertical: 24,
    paddingHorizontal: 12,
  },
  retryButton: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#3A96DD',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  retryButtonText: {
    color: '#3A96DD',
    fontWeight: '700',
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
    ...CONTAIN_WIDTH,
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
  toolbarRowMinimal: {
    flexDirection: 'column',
    alignItems: 'stretch',
    ...CONTAIN_WIDTH,
    gap: 10,
  },
  toolbarActionsMinimal: {
    ...CONTAIN_WIDTH,
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 8,
  },
  historyTitleMinimal: {
    color: MINIMAL_UI.textMuted,
    textTransform: 'none',
    letterSpacing: 0,
    fontSize: 13,
    fontWeight: '700',
  },
  batchStatusTextMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  batchStatusErrorMinimal: {
    color: '#DC2626',
  },
  batchButtonMinimal: {
    ...CONTAIN_WIDTH,
    borderRadius: 12,
    borderColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.background,
  },
  batchButtonActiveMinimal: {
    borderColor: MINIMAL_UI.blueDark,
    backgroundColor: '#EFF6FF',
  },
  batchButtonTextMinimal: {
    color: MINIMAL_UI.blueDark,
  },
  newButtonMinimal: {
    ...CONTAIN_WIDTH,
    borderRadius: 12,
    justifyContent: 'center',
    backgroundColor: MINIMAL_UI.blueDark,
  },
  newButtonActiveMinimal: {
    backgroundColor: MINIMAL_UI.textMuted,
  },
  newButtonTextMinimal: {
    color: MINIMAL_UI.onDark,
  },
  previewCardMinimal: {
    ...CONTAIN_WIDTH,
    borderColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.background,
  },
  previewTitleMinimal: {
    color: MINIMAL_UI.blueDark,
  },
  previewSubtitleMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  previewScrollMinimal: {
    ...CONTAIN_WIDTH,
  },
  previewRowMinimal: {
    borderBottomColor: MINIMAL_UI.divider,
    paddingHorizontal: 0,
  },
  previewRowAltMinimal: {
    backgroundColor: MINIMAL_UI.rowHover,
  },
  previewOrderMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  previewDateMinimal: {
    color: MINIMAL_UI.text,
  },
  previewNameMinimal: {
    color: MINIMAL_UI.text,
  },
  previewActionsMinimal: {
    ...CONTAIN_WIDTH,
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 8,
  },
  previewCancelButtonMinimal: {
    ...CONTAIN_WIDTH,
    borderRadius: 12,
    borderColor: MINIMAL_UI.blueDark,
  },
  previewCancelTextMinimal: {
    color: MINIMAL_UI.blueDark,
    textAlign: 'center',
  },
  previewConfirmButtonMinimal: {
    ...CONTAIN_WIDTH,
    borderRadius: 12,
    backgroundColor: MINIMAL_UI.blueDark,
  },
  previewConfirmTextMinimal: {
    color: MINIMAL_UI.onDark,
  },
  formCardMinimal: {
    ...CONTAIN_WIDTH,
    borderColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.background,
  },
  formTitleMinimal: {
    color: MINIMAL_UI.blueDark,
  },
  fieldLabelMinimal: {
    color: MINIMAL_UI.textMuted,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'none',
    letterSpacing: 0,
    marginBottom: 4,
  },
  dateInputMinimal: {
    ...CONTAIN_WIDTH,
    borderColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.background,
    borderRadius: 12,
  },
  dateInputTextMinimal: {
    color: MINIMAL_UI.text,
  },
  dateInputPlaceholderMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  saveButtonMinimal: {
    ...CONTAIN_WIDTH,
    borderRadius: 12,
    backgroundColor: MINIMAL_UI.blueDark,
  },
  saveButtonTextMinimal: {
    color: MINIMAL_UI.onDark,
  },
  historyScrollMinimal: {
    ...CONTAIN_WIDTH,
  },
  historyRowMinimal: {
    borderBottomColor: MINIMAL_UI.divider,
    paddingHorizontal: 0,
    backgroundColor: MINIMAL_UI.background,
  },
  historyRowAltMinimal: {
    backgroundColor: MINIMAL_UI.rowHover,
  },
  historyDateMinimal: {
    color: MINIMAL_UI.accent,
  },
  historyNameMinimal: {
    color: MINIMAL_UI.text,
  },
});

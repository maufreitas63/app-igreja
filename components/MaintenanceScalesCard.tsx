import { CardLoadingState } from '@/components/ui/CardLoadingState';
import { useMaintenanceScales } from '@/hooks/useMaintenanceScales';
import {
  computeMaintenanceContentHeight,
  maintenancePanelStyles,
} from '@/lib/maintenanceCardStyles';
import { confirmDialog } from '@/lib/confirmDialog';
import {
  formatScaleServiceDateInputMask,
  formatScaleServiceDateLabel,
  MAINTENANCE_SCALES_SQL_HINT,
  parseScaleServiceDateInput,
} from '@/lib/maintenanceScales';
import { FontAwesome } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import React, { useEffect, useState } from 'react';
import Toast from 'react-native-toast-message';
import {
  ActivityIndicator,
  Alert,
  Platform,
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

export function MaintenanceScalesCard({ isActive = true, panelHeight }: Props) {
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

  const contentHeight = computeMaintenanceContentHeight(panelHeight);

  useEffect(() => {
    setShowNewForm(false);
    setSelectedVolunteerId('');
    setServiceDateInput('');
  }, [selectedScaleTypeId]);

  useEffect(() => {
    if (!showNewForm) {
      return;
    }

    if (!selectedVolunteerId && activeVolunteers.length) {
      setSelectedVolunteerId(activeVolunteers[0].id);
    }
  }, [activeVolunteers, selectedVolunteerId, showNewForm]);

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

    setShowNewForm(false);
    setServiceDateInput('');
    Alert.alert('Escala', result.message);
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

  const actionsBusy = saving || buildingBatch || removingScaleId !== null;

  if (loading) {
    return (
      <View style={[styles.panel, maintenancePanelStyles.panelCentered, { height: contentHeight }]}>
        <CardLoadingState lines={4} />
        <Text style={maintenancePanelStyles.panelHint}>Carregando escalas…</Text>
      </View>
    );
  }

  if (!scaleTypes.length) {
    return (
      <View style={[styles.panel, maintenancePanelStyles.panelCentered, { height: contentHeight }]}>
        <FontAwesome name="calendar" size={28} color="#64748B" />
        <Text style={maintenancePanelStyles.panelTitleMuted}>Escalas</Text>
        <Text style={maintenancePanelStyles.panelHint}>
          Nenhum tipo de escala ativo. Cadastre no card Tipos de Escala.
        </Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => void reload()} activeOpacity={0.85}>
          <Text style={styles.retryButtonText}>Atualizar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.panel, { height: contentHeight }]}>
      <Text style={maintenancePanelStyles.panelTitle}>Manutenção de escalas</Text>
      <View style={maintenancePanelStyles.panelSubtitleSpacer} />

      {rpcMissing ? <Text style={styles.warningText}>{MAINTENANCE_SCALES_SQL_HINT}</Text> : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.typeChipRow}
        style={styles.typeChipScroll}
      >
        {scaleTypes.map((type) => {
          const isSelected = type.id === selectedScaleTypeId;

          return (
            <TouchableOpacity
              key={type.id}
              style={[styles.typeChip, isSelected && styles.typeChipSelected]}
              onPress={() => setSelectedScaleTypeId(type.id)}
              activeOpacity={0.85}
            >
              <Text style={[styles.typeChipText, isSelected && styles.typeChipTextSelected]}>
                {type.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.toolbarRow}>
        <Text style={styles.historyTitle}>Histórico</Text>
        <View style={styles.toolbarActions}>
          <TouchableOpacity
            style={[styles.batchButton, (batchPreview?.length ?? 0) > 0 && styles.batchButtonActive]}
            onPress={() => void handleBatchScale()}
            activeOpacity={0.85}
            disabled={actionsBusy || rpcMissing}
          >
            {buildingBatch ? (
              <ActivityIndicator color="#C7D2FE" size="small" />
            ) : (
              <Text style={styles.batchButtonText}>Escala em bloco</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.newButton, showNewForm && styles.newButtonActive]}
            onPress={() => setShowNewForm((current) => !current)}
            activeOpacity={0.85}
            disabled={actionsBusy || rpcMissing}
          >
            <FontAwesome name={showNewForm ? 'minus' : 'plus'} size={12} color="#0f172a" />
            <Text style={styles.newButtonText}>{showNewForm ? 'Fechar' : 'Nova escala'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {buildingBatch ? (
        <Text style={styles.batchStatusText}>Gerando prévia da escala em bloco…</Text>
      ) : batchPreviewMessage && !batchPreview?.length ? (
        <Text style={styles.batchStatusError}>{batchPreviewMessage}</Text>
      ) : null}

      {batchPreview?.length ? (
        <View style={styles.previewCard}>
          <Text style={styles.previewTitle}>Prévia — escala em bloco</Text>
          {batchPreviewMessage ? (
            <Text style={styles.previewSubtitle}>{batchPreviewMessage}</Text>
          ) : null}
          <ScrollView style={styles.previewScroll} nestedScrollEnabled>
            {batchPreview.map((entry, index) => (
              <View
                key={`${entry.serviceDate}-${entry.volunteerId}`}
                style={[styles.previewRow, index % 2 === 1 && styles.previewRowAlt]}
              >
                <Text style={styles.previewOrder}>{entry.sequenceOrder}</Text>
                <Text style={styles.previewDate}>{formatScaleServiceDateLabel(entry.serviceDate)}</Text>
                <Text style={styles.previewName} numberOfLines={2}>
                  {entry.volunteerName}
                </Text>
              </View>
            ))}
          </ScrollView>
          <View style={styles.previewActions}>
            <TouchableOpacity
              style={styles.previewCancelButton}
              onPress={cancelBatchPreview}
              disabled={actionsBusy}
              activeOpacity={0.85}
            >
              <Text style={styles.previewCancelText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.previewConfirmButton, actionsBusy && styles.saveButtonDisabled]}
              onPress={() => handleConfirmBatch()}
              disabled={actionsBusy}
              activeOpacity={0.85}
            >
              {saving ? (
                <ActivityIndicator color="#0f172a" size="small" />
              ) : (
                <Text style={styles.previewConfirmText}>Gravar bloco</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {showNewForm ? (
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Nova escala</Text>

          <Text style={styles.fieldLabel}>Servo</Text>
          {loadingVolunteers ? (
            <ActivityIndicator color="#818CF8" style={styles.formLoader} />
          ) : activeVolunteers.length ? (
            <View style={styles.pickerWrapper}>
              <Picker
                selectedValue={selectedVolunteerId || activeVolunteers[0]?.id}
                onValueChange={(value) => setSelectedVolunteerId(String(value))}
                dropdownIconColor="#F8FAFC"
                style={styles.picker}
                itemStyle={styles.pickerItem}
                mode="dropdown"
              >
                {activeVolunteers.map((volunteer) => (
                  <Picker.Item
                    key={volunteer.id}
                    label={volunteer.name}
                    value={volunteer.id}
                  />
                ))}
              </Picker>
            </View>
          ) : (
            <Text style={styles.panelHint}>
              Nenhum servo ativo para este tipo. Cadastre no card Servos.
            </Text>
          )}

          <Text style={styles.fieldLabel}>Data do serviço</Text>
          <TextInput
            style={styles.dateInput}
            placeholder="DD/MM/AA"
            placeholderTextColor="#64748B"
            value={serviceDateInput}
            keyboardType="numeric"
            onChangeText={(text) => setServiceDateInput(formatScaleServiceDateInputMask(text))}
          />

          <TouchableOpacity
            style={[styles.saveButton, (saving || !activeVolunteers.length) && styles.saveButtonDisabled]}
            onPress={() => void handleRegister()}
            disabled={saving || !activeVolunteers.length || rpcMissing}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color="#0f172a" size="small" />
            ) : (
              <Text style={styles.saveButtonText}>Salvar escala</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : null}

      <ScrollView style={styles.historyScroll} contentContainerStyle={styles.historyContent}>
        {historyForSelectedType.length ? (
          historyForSelectedType.map((entry, index) => {
            const isRemoving = removingScaleId === entry.id;

            return (
              <View
                key={entry.id}
                style={[styles.historyRow, index % 2 === 1 && styles.historyRowAlt]}
              >
                <Text style={styles.historyDate}>
                  {formatScaleServiceDateLabel(entry.serviceDate)}
                </Text>
                <Text style={styles.historyName} numberOfLines={2}>
                  {entry.volunteerName}
                </Text>
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
                    <ActivityIndicator color="#FCA5A5" size="small" />
                  ) : (
                    <FontAwesome name="trash-o" size={17} color="#FCA5A5" />
                  )}
                </TouchableOpacity>
              </View>
            );
          })
        ) : (
          <View style={styles.emptyHistory}>
            <Text style={styles.panelHint}>Nenhuma escala futura para este tipo.</Text>
          </View>
        )}
      </ScrollView>
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
  },
  panelSubtitle: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 2,
    marginBottom: 8,
  },
  panelTitleMuted: {
    color: '#94A3B8',
    fontSize: 17,
    fontWeight: '800',
  },
  panelHint: {
    color: '#94A3B8',
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
  typeChipScroll: {
    flexGrow: 0,
    maxHeight: 44,
    marginBottom: 8,
  },
  typeChipRow: {
    gap: 8,
    paddingHorizontal: 2,
  },
  typeChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#475569',
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  typeChipSelected: {
    borderColor: '#818CF8',
    backgroundColor: 'rgba(99, 102, 241, 0.35)',
  },
  typeChipText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  typeChipTextSelected: {
    color: '#E0E7FF',
    fontWeight: '800',
  },
  toolbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 12,
    marginBottom: 8,
  },
  toolbarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  historyTitle: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    flexShrink: 0,
  },
  batchStatusText: {
    color: '#A5B4FC',
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
    borderColor: '#A5B4FC',
    backgroundColor: 'rgba(99, 102, 241, 0.55)',
  },
  batchButtonText: {
    color: '#E0E7FF',
    fontSize: 11,
    fontWeight: '800',
  },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    backgroundColor: '#A5B4FC',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  newButtonActive: {
    backgroundColor: '#94A3B8',
  },
  newButtonText: {
    color: '#0f172a',
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
  },
  previewTitle: {
    color: '#E0E7FF',
    fontSize: 13,
    fontWeight: '800',
  },
  previewSubtitle: {
    color: '#A5B4FC',
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
  },
  previewDate: {
    minWidth: 88,
    flexShrink: 0,
    color: '#C7D2FE',
    fontSize: 12,
    fontWeight: '800',
  },
  previewName: {
    flex: 1,
    color: '#F8FAFC',
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
    borderColor: '#64748B',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  previewCancelText: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '700',
  },
  previewConfirmButton: {
    borderRadius: 8,
    backgroundColor: '#A5B4FC',
    paddingHorizontal: 14,
    paddingVertical: 8,
    minWidth: 108,
    alignItems: 'center',
  },
  previewConfirmText: {
    color: '#0f172a',
    fontSize: 12,
    fontWeight: '800',
  },
  formCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    padding: 12,
    gap: 8,
    marginBottom: 10,
  },
  formTitle: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '800',
  },
  fieldLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    backgroundColor: '#0f172a',
    overflow: 'hidden',
    minHeight: 44,
    justifyContent: 'center',
  },
  picker: {
    color: '#F8FAFC',
    height: 44,
  },
  pickerItem: {
    color: '#F8FAFC',
    fontSize: 14,
  },
  dateInput: {
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    backgroundColor: '#0f172a',
    color: '#F8FAFC',
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 10,
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
    borderBottomColor: '#334155',
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
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '600',
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
    borderColor: '#818CF8',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  retryButtonText: {
    color: '#C7D2FE',
    fontWeight: '700',
  },
});

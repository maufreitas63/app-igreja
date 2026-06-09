import { CardLoadingState } from '@/components/ui/CardLoadingState';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { useMaintenanceScaleTypes } from '@/hooks/useMaintenanceScaleTypes';
import {
  computeMaintenanceContentHeight,
  maintenancePanelStyles,
} from '@/lib/maintenanceCardStyles';
import { MAINTENANCE_SCALE_TYPES_SQL_HINT } from '@/hooks/useMaintenanceScaleTypes';
import { confirmDialog } from '@/lib/confirmDialog';
import { FontAwesome } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
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

export function MaintenanceScaleTypesCard({ isActive = true, panelHeight }: Props) {
  const {
    scaleTypes,
    loading,
    saving,
    deletingId,
    editingId,
    editingRow,
    error,
    rpcMissing,
    startEdit,
    cancelEdit,
    saveScaleType,
    removeScaleType,
    normalizeScaleTypeCode,
  } = useMaintenanceScaleTypes(isActive);

  const [codeInput, setCodeInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [vagasInput, setVagasInput] = useState('1');
  const [modoCiclo, setModoCiclo] = useState<'individual' | 'equipe'>('individual');

  const contentHeight = computeMaintenanceContentHeight(panelHeight);
  const formBusy = saving || deletingId !== null;

  useEffect(() => {
    if (editingRow) {
      setCodeInput(editingRow.code);
      setNameInput(editingRow.name);
      setVagasInput(String(editingRow.vagasPorServico));
      setModoCiclo(editingRow.modoCiclo);
      return;
    }

    setCodeInput('');
    setNameInput('');
    setVagasInput('1');
    setModoCiclo('individual');
  }, [editingId, editingRow]);

  const handleSave = async () => {
    const result = await saveScaleType(codeInput, nameInput);

    if (!result.success) {
      Toast.show({
        type: 'error',
        text1: 'Tipos de Escala',
        text2: result.message,
        visibilityTime: 4500,
      });
      return;
    }

    setCodeInput('');
    setNameInput('');
    setVagasInput('1');
    setModoCiclo('individual');

    Toast.show({
      type: 'success',
      text1: 'Tipos de Escala',
      text2: result.message,
      visibilityTime: 2500,
    });
  };

  const handleDelete = async (id: string, name: string) => {
    const prompt = `Excluir a escala «${name}»? Servos e registros vinculados também serão removidos.`;
    const confirmed = await confirmDialog('Excluir escala', prompt, 'Excluir', 'Cancelar', {
      destructive: true,
    });

    if (!confirmed) {
      return;
    }

    const result = await removeScaleType(id);

    if (!result.success) {
      Toast.show({
        type: 'error',
        text1: 'Tipos de Escala',
        text2: result.message,
        visibilityTime: 4500,
      });
    }
  };

  if (loading) {
    return (
      <View style={[styles.panel, maintenancePanelStyles.panelCentered, { height: contentHeight }]}>
        <CardLoadingState lines={4} />
        <Text style={maintenancePanelStyles.panelHint}>Carregando tipos de escala…</Text>
      </View>
    );
  }

  return (
    <View style={[styles.panel, { height: contentHeight }]}>
      <Text style={maintenancePanelStyles.panelTitle}>Tipos de Escala</Text>
      <Text style={maintenancePanelStyles.panelSubtitle}>Cadastro em tipos_escala</Text>

      {rpcMissing ? <Text style={styles.warningText}>{MAINTENANCE_SCALE_TYPES_SQL_HINT}</Text> : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={styles.formCard}>
        <Text style={styles.formTitle}>{editingId ? 'Editar escala' : 'Nova escala'}</Text>

        <Text style={styles.fieldLabel}>Código</Text>
        <TextInput
          style={styles.input}
          placeholder="ex.: vigilancia_estacionamento"
          placeholderTextColor="#64748B"
          value={codeInput}
          onChangeText={(text) => setCodeInput(normalizeScaleTypeCode(text))}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Text style={styles.fieldLabel}>Nome</Text>
        <TextInput
          style={styles.input}
          placeholder="Nome exibido no app"
          placeholderTextColor="#64748B"
          value={nameInput}
          onChangeText={setNameInput}
          autoCapitalize="words"
        />

        <Text style={styles.fieldLabel}>Vagas por domingo</Text>
        <TextInput
          style={styles.input}
          placeholder="1 a 50"
          placeholderTextColor="#64748B"
          value={vagasInput}
          onChangeText={(text) => setVagasInput(text.replace(/[^0-9]/g, ''))}
          keyboardType="number-pad"
          maxLength={2}
        />

        <Text style={styles.fieldLabel}>Modo do ciclo em bloco</Text>
        <View style={styles.modeRow}>
          <TouchableOpacity
            style={[styles.modeChip, modoCiclo === 'individual' && styles.modeChipActive]}
            onPress={() => setModoCiclo('individual')}
            disabled={formBusy}
            activeOpacity={0.85}
          >
            <Text
              style={[styles.modeChipText, modoCiclo === 'individual' && styles.modeChipTextActive]}
            >
              Individual
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeChip, modoCiclo === 'equipe' && styles.modeChipActive]}
            onPress={() => setModoCiclo('equipe')}
            disabled={formBusy}
            activeOpacity={0.85}
          >
            <Text style={[styles.modeChipText, modoCiclo === 'equipe' && styles.modeChipTextActive]}>
              Equipe
            </Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.fieldHint}>
          Individual: cada servo em domingo distinto. Equipe: até N servos no mesmo domingo.
        </Text>

        <View style={styles.formActions}>
          {editingId ? (
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={cancelEdit}
              disabled={formBusy}
              activeOpacity={0.85}
            >
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={[styles.saveButton, formBusy && styles.saveButtonDisabled]}
            onPress={() => void handleSave()}
            disabled={formBusy || rpcMissing}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color="#0f172a" size="small" />
            ) : (
              <Text style={styles.saveButtonText}>{editingId ? 'Salvar alterações' : 'Cadastrar'}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <SectionLabel variant="maintenance">Escalas cadastradas</SectionLabel>
      <ScrollView style={styles.listScroll} nestedScrollEnabled>
        {scaleTypes.length ? (
          scaleTypes.map((row, index) => {
            const isDeleting = deletingId === row.id;
            const isEditing = editingId === row.id;

            return (
              <View
                key={row.id}
                style={[styles.listRow, index % 2 === 1 && styles.listRowAlt, isEditing && styles.listRowEditing]}
              >
                <View style={styles.listMain}>
                  <Text style={styles.listName} numberOfLines={2}>
                    {row.name}
                  </Text>
                  <Text style={styles.listCode} numberOfLines={1}>
                    {row.code} · {row.vagasPorServico} vaga(s) ·{' '}
                    {row.modoCiclo === 'equipe' ? 'equipe' : 'individual'}
                  </Text>
                  {!row.isActive ? (
                    <Text style={styles.inactiveBadge}>Inativa</Text>
                  ) : null}
                </View>
                <TouchableOpacity
                  style={styles.iconButton}
                  onPress={() => startEdit(row)}
                  disabled={formBusy || rpcMissing}
                  activeOpacity={0.85}
                  accessibilityLabel={`Editar ${row.name}`}
                >
                  <FontAwesome name="pencil" size={16} color="#A5B4FC" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.iconButton}
                  onPress={() => void handleDelete(row.id, row.name)}
                  disabled={formBusy || rpcMissing}
                  activeOpacity={0.85}
                  accessibilityLabel={`Excluir ${row.name}`}
                >
                  {isDeleting ? (
                    <ActivityIndicator color="#FCA5A5" size="small" />
                  ) : (
                    <FontAwesome name="trash-o" size={17} color="#FCA5A5" />
                  )}
                </TouchableOpacity>
              </View>
            );
          })
        ) : (
          <Text style={styles.panelHint}>Nenhum tipo de escala cadastrado ainda.</Text>
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
  formCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    padding: 12,
    gap: 6,
    marginBottom: 10,
  },
  formTitle: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 2,
  },
  fieldLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 4,
  },
  fieldHint: {
    color: '#64748B',
    fontSize: 10,
    lineHeight: 14,
    marginTop: 2,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  modeChip: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#0f172a',
  },
  modeChipActive: {
    borderColor: '#A5B4FC',
    backgroundColor: 'rgba(99, 102, 241, 0.18)',
  },
  modeChipText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '700',
  },
  modeChipTextActive: {
    color: '#E2E8F0',
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
  formActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
  },
  cancelButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#64748B',
    paddingHorizontal: 14,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  cancelButtonText: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '700',
  },
  saveButton: {
    borderRadius: 10,
    backgroundColor: '#A5B4FC',
    paddingHorizontal: 16,
    paddingVertical: 10,
    minWidth: 132,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.55,
  },
  saveButtonText: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '800',
  },
  listScroll: {
    flex: 1,
    minHeight: 0,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#334155',
  },
  listRowAlt: {
    backgroundColor: 'rgba(30, 41, 59, 0.35)',
  },
  listRowEditing: {
    borderColor: 'rgba(165, 180, 252, 0.45)',
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
  },
  listMain: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  listName: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
  },
  listCode: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  inactiveBadge: {
    alignSelf: 'flex-start',
    marginTop: 2,
    color: '#FBBF24',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  iconButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});

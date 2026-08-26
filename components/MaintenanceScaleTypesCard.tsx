import { CardLoadingState } from '@/components/ui/CardLoadingState';
import { useMaintenanceScaleTypes } from '@/hooks/useMaintenanceScaleTypes';
import {
  computeMaintenanceContentHeight,
  maintenancePanelStyles,
} from '@/lib/maintenanceCardStyles';
import { MAINTENANCE_SCALE_TYPES_SQL_HINT } from '@/hooks/useMaintenanceScaleTypes';
import { confirmDialog } from '@/lib/confirmDialog';
import { mapLegacyRoomDisplayLabel } from '@/lib/roomDisplayLabels';
import { MINIMAL_SECTION_TITLE, MINIMAL_UI } from '@/lib/minimalUiTheme';
import { FontAwesome } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';

type Props = {
  isActive?: boolean;
  panelHeight: number;
  minimal?: boolean;
};

type ScaleTypesSectionKey = 'create' | 'registered';

type CollapsibleSectionProps = {
  title: string;
  subtitle: string;
  expanded: boolean;
  onToggle: () => void;
  fill?: boolean;
  minimal?: boolean;
  children: React.ReactNode;
};

function CollapsibleSection({
  title,
  subtitle,
  expanded,
  onToggle,
  fill = false,
  minimal = false,
  children,
}: CollapsibleSectionProps) {
  return (
    <View
      style={[
        styles.collapseSection,
        minimal && styles.collapseSectionMinimal,
        fill && expanded && styles.collapseSectionFill,
      ]}
    >
      <TouchableOpacity
        style={styles.collapseHeader}
        onPress={onToggle}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
      >
        <View style={styles.collapseHeaderTextWrap}>
          <View style={styles.collapseHeaderTitleRow}>
            <Text
              style={[styles.collapseHeaderTitle, minimal && styles.collapseHeaderTitleMinimal]}
              numberOfLines={1}
            >
              {title}
            </Text>
            <FontAwesome
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={14}
              color={minimal ? MINIMAL_UI.icon : '#A5B4FC'}
              style={styles.collapseChevron}
            />
          </View>
          {subtitle ? (
            <Text
              style={[
                styles.collapseHeaderSubtitle,
                minimal && styles.collapseHeaderSubtitleMinimal,
              ]}
              numberOfLines={2}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
      </TouchableOpacity>
      {expanded ? (
        <View
          style={[
            styles.collapseBody,
            minimal && styles.collapseBodyMinimal,
            fill && styles.collapseBodyFill,
          ]}
        >
          {children}
        </View>
      ) : null}
    </View>
  );
}

export function MaintenanceScaleTypesCard({
  isActive = true,
  panelHeight,
  minimal = false,
}: Props) {
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
  const [allowSwap, setAllowSwap] = useState(true);
  const [expandedSection, setExpandedSection] = useState<ScaleTypesSectionKey | null>(null);

  const contentHeight = computeMaintenanceContentHeight(panelHeight);
  const formBusy = saving || deletingId !== null;

  const toggleSection = useCallback((section: ScaleTypesSectionKey) => {
    setExpandedSection((current) => (current === section ? null : section));
  }, []);

  useEffect(() => {
    if (editingId) {
      setExpandedSection('registered');
    }
  }, [editingId]);

  useEffect(() => {
    if (editingRow) {
      setCodeInput(editingRow.code);
      setNameInput(editingRow.name);
      setVagasInput(String(editingRow.vagasPorServico));
      setModoCiclo(editingRow.modoCiclo);
      setAllowSwap(editingRow.allowSwap !== false);
      return;
    }

    setCodeInput('');
    setNameInput('');
    setVagasInput('1');
    setModoCiclo('individual');
    setAllowSwap(true);
  }, [editingId, editingRow]);

  const handleSave = async () => {
    const vagasPorServico = Number.parseInt(vagasInput, 10) || 1;
    const result = await saveScaleType(codeInput, nameInput, vagasPorServico, modoCiclo, allowSwap);

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
    setAllowSwap(true);

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

  const handleNameChange = (text: string, mode: 'create' | 'edit') => {
    setNameInput(text);
    if (mode === 'create') {
      setCodeInput(normalizeScaleTypeCode(text));
    }
  };

  const renderScaleTypeForm = (mode: 'create' | 'edit') => (
    <View style={[styles.formCard, minimal && styles.formCardMinimal]}>
      <Text style={[styles.formTitle, minimal && styles.formTitleMinimal]}>
        {mode === 'edit' ? 'Editar tipo de escala' : 'Novo tipo'}
      </Text>

      <Text style={[styles.fieldLabel, minimal && styles.fieldLabelMinimal]}>Nome</Text>
      <TextInput
        style={[styles.input, minimal && styles.inputMinimal]}
        placeholder="Nome exibido no app"
        placeholderTextColor="#64748B"
        value={nameInput}
        onChangeText={(text) => handleNameChange(text, mode)}
        autoCapitalize="words"
      />

      <Text style={[styles.fieldLabel, minimal && styles.fieldLabelMinimal]}>Código</Text>
      <TextInput
        style={[
          styles.input,
          styles.codeInputReadonly,
          minimal && styles.inputMinimal,
          minimal && styles.codeInputReadonlyMinimal,
        ]}
        placeholder="gerado automaticamente do nome"
        placeholderTextColor="#64748B"
        value={codeInput}
        editable={false}
        selectTextOnFocus={false}
        autoCapitalize="none"
        autoCorrect={false}
        accessibilityLabel="Código gerado automaticamente a partir do nome"
      />

      <Text style={[styles.fieldLabel, minimal && styles.fieldLabelMinimal]}>Vagas por domingo</Text>
      <TextInput
        style={[styles.input, minimal && styles.inputMinimal]}
        placeholder="1 a 50"
        placeholderTextColor="#64748B"
        value={vagasInput}
        onChangeText={(text) => setVagasInput(text.replace(/[^0-9]/g, ''))}
        keyboardType="number-pad"
        maxLength={2}
      />

      <Text style={[styles.fieldLabel, minimal && styles.fieldLabelMinimal]}>Modo do ciclo em bloco</Text>
      <View style={styles.modeRow}>
        <TouchableOpacity
          style={[
            styles.modeChip,
            minimal && styles.modeChipMinimal,
            modoCiclo === 'individual' && styles.modeChipActive,
            minimal && modoCiclo === 'individual' && styles.modeChipActiveMinimal,
          ]}
          onPress={() => setModoCiclo('individual')}
          disabled={formBusy}
          activeOpacity={0.85}
        >
          <Text
            style={[
              styles.modeChipText,
              minimal && styles.modeChipTextMinimal,
              modoCiclo === 'individual' && styles.modeChipTextActive,
              minimal && modoCiclo === 'individual' && styles.modeChipTextActiveMinimal,
            ]}
          >
            Individual
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.modeChip,
            minimal && styles.modeChipMinimal,
            modoCiclo === 'equipe' && styles.modeChipActive,
            minimal && modoCiclo === 'equipe' && styles.modeChipActiveMinimal,
          ]}
          onPress={() => setModoCiclo('equipe')}
          disabled={formBusy}
          activeOpacity={0.85}
        >
          <Text
            style={[
              styles.modeChipText,
              minimal && styles.modeChipTextMinimal,
              modoCiclo === 'equipe' && styles.modeChipTextActive,
              minimal && modoCiclo === 'equipe' && styles.modeChipTextActiveMinimal,
            ]}
          >
            Equipe
          </Text>
        </TouchableOpacity>
      </View>
      <Text style={[styles.fieldHint, minimal && styles.fieldHintMinimal]}>
        Individual: cada servo em domingo distinto. Equipe: até N servos no mesmo domingo.
      </Text>

      <View style={styles.swapToggleRow}>
        <View style={styles.swapToggleText}>
          <Text style={[styles.fieldLabel, minimal && styles.fieldLabelMinimal]}>
            Permitir troca autônoma
          </Text>
          <Text style={[styles.fieldHint, minimal && styles.fieldHintMinimal]}>
            O servo escalado pode pedir substituto do mesmo tipo nesta escala.
          </Text>
        </View>
        <Switch
          value={allowSwap}
          onValueChange={setAllowSwap}
          disabled={formBusy || mode === 'create'}
        />
      </View>

      <View style={styles.formActions}>
        {mode === 'edit' ? (
          <TouchableOpacity
            style={[styles.cancelButton, minimal && styles.cancelButtonMinimal]}
            onPress={cancelEdit}
            disabled={formBusy}
            activeOpacity={0.85}
          >
            <Text style={[styles.cancelButtonText, minimal && styles.cancelButtonTextMinimal]}>
              Cancelar
            </Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          style={[
            styles.saveButton,
            minimal && styles.saveButtonMinimal,
            formBusy && styles.saveButtonDisabled,
          ]}
          onPress={() => void handleSave()}
          disabled={formBusy || rpcMissing}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator color={minimal ? MINIMAL_UI.onDark : '#0f172a'} size="small" />
          ) : (
            <Text style={[styles.saveButtonText, minimal && styles.saveButtonTextMinimal]}>
              {mode === 'edit' ? 'Salvar alterações' : 'Cadastrar'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

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

  return (
    <View style={[styles.panel, minimal && styles.panelMinimal, { height: contentHeight }]}>
      <Text style={minimal ? styles.sectionTitleMinimal : maintenancePanelStyles.panelTitle}>
        Tipos de Escala
      </Text>
      {!minimal ? <View style={maintenancePanelStyles.panelSubtitleSpacer} /> : null}

      {rpcMissing ? (
        <Text style={[styles.warningText, minimal && styles.warningTextMinimal]}>
          {MAINTENANCE_SCALE_TYPES_SQL_HINT}
        </Text>
      ) : null}
      {error ? (
        <Text style={[styles.errorText, minimal && styles.errorTextMinimal]}>{error}</Text>
      ) : null}

      {!editingId ? (
        <CollapsibleSection
          title="Novo tipo de escala"
          subtitle="Cadastrar código, nome, vagas e modo do ciclo"
          expanded={expandedSection === 'create'}
          onToggle={() => toggleSection('create')}
          minimal={minimal}
        >
          {renderScaleTypeForm('create')}
        </CollapsibleSection>
      ) : null}

      <View style={[styles.registeredSectionWrap, minimal && styles.registeredSectionWrapMinimal]}>
        <CollapsibleSection
          title="Escalas cadastradas"
          subtitle={
            scaleTypes.length
              ? `${scaleTypes.length} tipo(s) cadastrado(s)`
              : 'Nenhum tipo cadastrado ainda'
          }
          expanded={expandedSection === 'registered'}
          onToggle={() => toggleSection('registered')}
          fill={expandedSection === 'registered'}
          minimal={minimal}
        >
          {editingId ? renderScaleTypeForm('edit') : null}
          <ScrollView style={styles.listScroll} nestedScrollEnabled>
            {scaleTypes.length ? (
              scaleTypes.map((row, index) => {
                const isDeleting = deletingId === row.id;
                const isEditing = editingId === row.id;

                return (
                  <View
                    key={row.id}
                    style={[
                      styles.listRow,
                      minimal && styles.listRowMinimal,
                      index % 2 === 1 && (minimal ? styles.listRowAltMinimal : styles.listRowAlt),
                      isEditing && (minimal ? styles.listRowEditingMinimal : styles.listRowEditing),
                    ]}
                  >
                    <View style={styles.listMain}>
                      <Text
                        style={[styles.listName, minimal && styles.listNameMinimal]}
                        numberOfLines={2}
                      >
                        {mapLegacyRoomDisplayLabel(row.name)}
                      </Text>
                      <Text
                        style={[styles.listCode, minimal && styles.listCodeMinimal]}
                        numberOfLines={1}
                      >
                        {row.code} · {row.vagasPorServico} vaga(s) ·{' '}
                        {row.modoCiclo === 'equipe' ? 'equipe' : 'individual'}
                        {row.allowSwap === false ? ' · troca bloqueada' : ''}
                      </Text>
                      {!row.isActive ? (
                        <Text
                          style={[styles.inactiveBadge, minimal && styles.inactiveBadgeMinimal]}
                        >
                          Inativa
                        </Text>
                      ) : null}
                    </View>
                    <TouchableOpacity
                      style={styles.iconButton}
                      onPress={() => startEdit(row)}
                      disabled={formBusy || rpcMissing}
                      activeOpacity={0.85}
                      accessibilityLabel={`Editar ${row.name}`}
                    >
                      <FontAwesome
                        name="pencil"
                        size={16}
                        color={minimal ? MINIMAL_UI.icon : '#A5B4FC'}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.iconButton}
                      onPress={() => void handleDelete(row.id, row.name)}
                      disabled={formBusy || rpcMissing}
                      activeOpacity={0.85}
                      accessibilityLabel={`Excluir ${row.name}`}
                    >
                      {isDeleting ? (
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
              <Text style={[styles.panelHint, minimal && styles.panelHintMinimal]}>
                Nenhum tipo de escala cadastrado ainda.
              </Text>
            )}
          </ScrollView>
        </CollapsibleSection>
      </View>
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
  registeredSectionWrap: {
    flex: 1,
    minHeight: 0,
  },
  collapseSection: {
    borderWidth: 1,
    borderColor: 'rgba(129, 140, 248, 0.28)',
    borderRadius: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    marginBottom: 8,
    overflow: 'hidden',
  },
  collapseSectionFill: {
    flex: 1,
    minHeight: 0,
    marginBottom: 0,
  },
  collapseHeader: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    minHeight: 44,
  },
  collapseHeaderTextWrap: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  collapseHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 18,
  },
  collapseHeaderTitle: {
    flex: 1,
    color: '#3A96DD',
    fontSize: 12,
    fontWeight: '800',
  },
  collapseHeaderSubtitle: {
    color: 'rgba(58, 150, 221, 0.82)',
    fontSize: 11,
    lineHeight: 14,
  },
  collapseChevron: {
    flexShrink: 0,
  },
  collapseBody: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(129, 140, 248, 0.18)',
    paddingHorizontal: 8,
    paddingBottom: 8,
    gap: 6,
  },
  collapseBodyFill: {
    flex: 1,
    minHeight: 0,
  },
  panelHint: {
    color: 'rgba(58, 150, 221, 0.82)',
    fontSize: 12,
    lineHeight: 17,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  formCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(51, 65, 85, 0.85)',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    padding: 12,
    gap: 6,
  },
  formTitle: {
    color: '#3A96DD',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 2,
  },
  fieldLabel: {
    color: 'rgba(58, 150, 221, 0.82)',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 4,
  },
  fieldHint: {
    color: 'rgba(58, 150, 221, 0.82)',
    fontSize: 10,
    lineHeight: 14,
    marginTop: 2,
  },
  swapToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  swapToggleText: {
    flex: 1,
    minWidth: 0,
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
    borderColor: 'rgba(52, 211, 153, 0.35)',
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  modeChipActive: {
    borderColor: '#3A96DD',
    backgroundColor: 'rgba(99, 102, 241, 0.18)',
  },
  modeChipText: {
    color: 'rgba(58, 150, 221, 0.82)',
    fontSize: 13,
    fontWeight: '700',
  },
  modeChipTextActive: {
    color: '#3A96DD',
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    color: '#3A96DD',
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  codeInputReadonly: {
    backgroundColor: '#F8FAFC',
    color: 'rgba(58, 150, 221, 0.82)',
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
    borderColor: 'rgba(52, 211, 153, 0.35)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  cancelButtonText: {
    color: '#3A96DD',
    fontSize: 13,
    fontWeight: '700',
  },
  saveButton: {
    borderRadius: 10,
    backgroundColor: '#3A96DD',
    paddingHorizontal: 16,
    paddingVertical: 10,
    minWidth: 132,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.55,
  },
  saveButtonText: {
    color: '#FFFFFF',
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
    borderBottomColor: 'rgba(52, 211, 153, 0.35)',
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
    color: '#3A96DD',
    fontSize: 14,
    fontWeight: '700',
  },
  listCode: {
    color: 'rgba(58, 150, 221, 0.82)',
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
  registeredSectionWrapMinimal: {
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
  },
  formCardMinimal: {
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    borderColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.background,
  },
  formTitleMinimal: {
    color: MINIMAL_UI.text,
  },
  fieldLabelMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  fieldHintMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  inputMinimal: {
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    alignSelf: 'stretch',
    borderColor: MINIMAL_UI.border,
    color: MINIMAL_UI.text,
    backgroundColor: MINIMAL_UI.background,
  },
  codeInputReadonlyMinimal: {
    backgroundColor: MINIMAL_UI.rowHover,
    color: MINIMAL_UI.textMuted,
  },
  modeChipMinimal: {
    borderColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.background,
  },
  modeChipActiveMinimal: {
    borderColor: MINIMAL_UI.accent,
    backgroundColor: '#EFF6FF',
  },
  modeChipTextMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  modeChipTextActiveMinimal: {
    color: MINIMAL_UI.accent,
  },
  cancelButtonMinimal: {
    borderColor: MINIMAL_UI.border,
  },
  cancelButtonTextMinimal: {
    color: MINIMAL_UI.text,
  },
  saveButtonMinimal: {
    flex: 1,
    minWidth: 0,
    maxWidth: '100%',
    backgroundColor: MINIMAL_UI.accent,
  },
  saveButtonTextMinimal: {
    color: MINIMAL_UI.onDark,
  },
  collapseSectionMinimal: {
    borderColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.background,
    borderRadius: 12,
  },
  collapseHeaderTitleMinimal: {
    color: MINIMAL_UI.text,
  },
  collapseHeaderSubtitleMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  collapseBodyMinimal: {
    borderTopColor: MINIMAL_UI.divider,
  },
  listRowMinimal: {
    borderBottomColor: MINIMAL_UI.divider,
    backgroundColor: MINIMAL_UI.background,
  },
  listRowAltMinimal: {
    backgroundColor: MINIMAL_UI.rowHover,
  },
  listRowEditingMinimal: {
    borderColor: MINIMAL_UI.border,
    backgroundColor: '#EFF6FF',
  },
  listNameMinimal: {
    color: MINIMAL_UI.text,
  },
  listCodeMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  inactiveBadgeMinimal: {
    color: '#B45309',
  },
});

import { PrimiciasCollapsibleSection } from '@/components/PrimiciasCollapsibleSection';
import { DropdownSelect } from '@/components/ui/DropdownSelect';
import { MaintenanceHelpInfoTitle } from '@/components/ui/MaintenanceHelpInfoTitle';
import { MonthlyDatePickerModal } from '@/components/ui/MonthlyDatePickerModal';
import { confirmDialog } from '@/lib/confirmDialog';
import { calendarDateInputToBr, calendarDateInputToIso } from '@/lib/monthlyDatePicker';
import {
  createPrimiciasItem,
  deletePrimiciasItem,
  formatPrimiciasIsoDate,
  formatPrimiciasItemLine,
  formatPrimiciasPendingCount,
  listPrimiciasHistory,
  listPrimiciasItems,
  PRIMICIAS_CATEGORIES,
  PRIMICIAS_CATEGORY_LABEL,
  savePrimiciasEventDate,
  type PrimiciasCategory,
  type PrimiciasHistoryDay,
  type PrimiciasItem,
  type PrimiciasOccurrence,
} from '@/lib/primiciasApi';
import {
  computeMaintenanceContentHeight,
  MAINTENANCE_SCROLL_PROPS,
  maintenancePanelStyles,
} from '@/lib/maintenanceCardStyles';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import { FontAwesome } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  minimal?: boolean;
};

const CATEGORY_OPTIONS = PRIMICIAS_CATEGORIES.map((value) => ({
  value,
  label: PRIMICIAS_CATEGORY_LABEL[value],
}));

export function MaintenancePrimiciasCard({ isActive = true, panelHeight, minimal = false }: Props) {
  const contentHeight = computeMaintenanceContentHeight(panelHeight);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<PrimiciasItem[]>([]);
  const [occurrence, setOccurrence] = useState<PrimiciasOccurrence | null>(null);
  const [history, setHistory] = useState<PrimiciasHistoryDay[]>([]);
  const [eventDateInput, setEventDateInput] = useState('');
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [savingDate, setSavingDate] = useState(false);
  const [category, setCategory] = useState<PrimiciasCategory>('alimenticios');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('');
  const [productName, setProductName] = useState('');
  const [weight, setWeight] = useState('');

  const load = useCallback(async () => {
    const [result, historyRows] = await Promise.all([
      listPrimiciasItems(),
      listPrimiciasHistory().catch(() => [] as PrimiciasHistoryDay[]),
    ]);
    setItems(result.items);
    setOccurrence(result.occurrence);
    setHistory(historyRows);

    if (result.occurrence?.eventDate) {
      setEventDateInput(formatPrimiciasIsoDate(result.occurrence.eventDate));
    }
  }, []);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    let cancelled = false;

    void (async () => {
      setLoading(true);
      setError(null);

      try {
        await load();
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Não foi possível carregar os itens.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isActive, load]);

  const grouped = useMemo(() => {
    return PRIMICIAS_CATEGORIES.map((key) => ({
      category: key,
      items: items.filter((item) => item.category === key),
    })).filter((group) => group.items.length > 0);
  }, [items]);

  const resetForm = () => {
    setQuantity('1');
    setUnit('');
    setProductName('');
    setWeight('');
  };

  const handleSaveDate = async () => {
    const iso = calendarDateInputToIso(eventDateInput);

    if (!iso) {
      Toast.show({ type: 'error', text1: 'Prímicias', text2: 'Informe a data da campanha.' });
      return;
    }

    setSavingDate(true);

    try {
      const message = await savePrimiciasEventDate(iso);
      await load();
      Toast.show({ type: 'success', text1: 'Prímicias', text2: message });
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Prímicias',
        text2: err instanceof Error ? err.message : 'Não foi possível gravar a data.',
      });
    } finally {
      setSavingDate(false);
    }
  };

  const handleCreate = async () => {
    const qty = Number.parseInt(quantity.replace(/\D/g, ''), 10);

    if (!Number.isFinite(qty) || qty < 1) {
      Toast.show({ type: 'error', text1: 'Prímicias', text2: 'Informe a quantidade.' });
      return;
    }

    setSaving(true);

    try {
      const message = await createPrimiciasItem({
        category,
        quantity: qty,
        unit,
        productName,
        weight,
      });
      resetForm();
      await load();
      Toast.show({ type: 'success', text1: 'Prímicias', text2: message });
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Prímicias',
        text2: err instanceof Error ? err.message : 'Não foi possível cadastrar.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: PrimiciasItem) => {
    const confirmed = await confirmDialog(
      'Excluir item',
      `Excluir “${formatPrimiciasItemLine(item)}”? Os compromissos deste item também serão removidos.`,
      'Excluir',
      'Cancelar',
      { destructive: true }
    );

    if (!confirmed) {
      return;
    }

    setDeletingId(item.id);

    try {
      const message = await deletePrimiciasItem(item.id);
      await load();
      Toast.show({ type: 'success', text1: 'Prímicias', text2: message });
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Prímicias',
        text2: err instanceof Error ? err.message : 'Não foi possível excluir.',
      });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <View style={[maintenancePanelStyles.panel, { height: contentHeight }]}>
      <MaintenanceHelpInfoTitle
        title="Gestão de Prímicias"
        helpText="Trate a campanha como um evento: defina a data, cadastre ou exclua itens (quantidade, unidade, nome e peso). Ao doar, o membro entra na agenda. Dez dias após a data, os compromissos são arquivados no histórico e os itens ficam livres para a próxima data."
        minimal={minimal}
      />

      {loading ? (
        <View style={maintenancePanelStyles.panelCentered}>
          <ActivityIndicator color={MINIMAL_UI.accent} />
        </View>
      ) : error ? (
        <Text style={maintenancePanelStyles.panelHint}>{error}</Text>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} {...MAINTENANCE_SCROLL_PROPS}>
          <Text style={styles.formLabel}>Data da campanha</Text>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setDatePickerOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Escolher data da campanha"
          >
            <Text style={styles.dateButtonText}>
              {eventDateInput.trim() || 'Toque para escolher a data'}
            </Text>
          </TouchableOpacity>
          {occurrence ? (
            <Text style={styles.pledgeMeta}>
              Evento na agenda em {formatPrimiciasIsoDate(occurrence.eventDate)}. Itens liberam de
              novo em {formatPrimiciasIsoDate(occurrence.resetOn)}.
            </Text>
          ) : (
            <Text style={styles.pledgeMeta}>
              Sem data, o membro ainda não consegue se comprometer nem gerar inscrição na agenda.
            </Text>
          )}
          <TouchableOpacity
            style={styles.saveButton}
            onPress={() => void handleSaveDate()}
            disabled={savingDate}
            accessibilityRole="button"
            accessibilityLabel="Gravar data da campanha"
          >
            {savingDate ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.saveButtonText}>Gravar data do evento</Text>
            )}
          </TouchableOpacity>

          <PrimiciasCollapsibleSection title="Novo item">
          <DropdownSelect
            options={CATEGORY_OPTIONS}
            selectedValue={category}
            onValueChange={(value) => setCategory(value as PrimiciasCategory)}
            modalTitle="Categoria"
            variant={minimal ? 'minimal' : 'vigilance'}
            size="compact"
          />
          <View style={styles.formRow}>
            <TextInput
              style={[maintenancePanelStyles.input, styles.qtyInput]}
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="number-pad"
              placeholder="Qtd"
              placeholderTextColor={MINIMAL_UI.textMuted}
            />
            <TextInput
              style={[maintenancePanelStyles.input, styles.flexInput]}
              value={unit}
              onChangeText={setUnit}
              placeholder="Unidade (pacote, lata…)"
              placeholderTextColor={MINIMAL_UI.textMuted}
            />
          </View>
          <TextInput
            style={maintenancePanelStyles.input}
            value={productName}
            onChangeText={setProductName}
            placeholder="Nome do produto"
            placeholderTextColor={MINIMAL_UI.textMuted}
          />
          <TextInput
            style={maintenancePanelStyles.input}
            value={weight}
            onChangeText={setWeight}
            placeholder="Peso (5kg, 400g, conforme embalagem)"
            placeholderTextColor={MINIMAL_UI.textMuted}
          />
          <TouchableOpacity
            style={styles.saveButton}
            onPress={() => void handleCreate()}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel="Cadastrar item"
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.saveButtonText}>Cadastrar item</Text>
            )}
          </TouchableOpacity>
          </PrimiciasCollapsibleSection>

          {grouped.map((group) => (
            <PrimiciasCollapsibleSection
              key={group.category}
              title={PRIMICIAS_CATEGORY_LABEL[group.category]}
              subtitle={formatPrimiciasPendingCount(group.items)}
            >
              {group.items.map((item) => {
                const pledged = item.pledges.length > 0;

                return (
                  <View key={item.id} style={styles.itemRow}>
                    <View style={styles.itemText}>
                      <Text style={[styles.itemLine, pledged && styles.itemLinePledged]}>
                        {formatPrimiciasItemLine(item)}
                      </Text>
                      <Text style={styles.pledgeMeta}>
                        {pledged
                          ? item.pledges.map((pledge) => pledge.name).join(', ')
                          : 'Pendente'}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => void handleDelete(item)}
                      disabled={deletingId === item.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Excluir ${item.productName}`}
                    >
                      {deletingId === item.id ? (
                        <ActivityIndicator size="small" color="#B91C1C" />
                      ) : (
                        <FontAwesome name="trash-o" size={16} color="#B91C1C" />
                      )}
                    </TouchableOpacity>
                  </View>
                );
              })}
            </PrimiciasCollapsibleSection>
          ))}

          {history.length > 0 ? (
            <PrimiciasCollapsibleSection
              title="Histórico por data"
              subtitle={`${history.length} ${history.length === 1 ? 'campanha' : 'campanhas'}`}
            >
              {history.map((day) => (
                <View key={day.occurrenceId} style={styles.historyDay}>
                  <Text style={styles.itemLine}>{formatPrimiciasIsoDate(day.eventDate)}</Text>
                  {day.donors.map((donor) => (
                    <Text key={`${day.occurrenceId}-${donor.profileId ?? donor.name}`} style={styles.pledgeMeta}>
                      {donor.name}: {donor.items.map((item) => formatPrimiciasItemLine(item)).join('; ')}
                    </Text>
                  ))}
                </View>
              ))}
            </PrimiciasCollapsibleSection>
          ) : null}
        </ScrollView>
      )}
      <MonthlyDatePickerModal
        visible={datePickerOpen}
        value={eventDateInput}
        title="Data da campanha"
        variant={minimal ? 'minimal' : 'default'}
        onClose={() => setDatePickerOpen(false)}
        onConfirm={(dateInput) => {
          setEventDateInput(calendarDateInputToBr(dateInput));
          setDatePickerOpen(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    minHeight: 0,
  },
  content: {
    gap: 10,
    paddingBottom: 16,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: MINIMAL_UI.blueDark,
  },
  formRow: {
    flexDirection: 'row',
    gap: 8,
  },
  qtyInput: {
    width: 72,
  },
  flexInput: {
    flex: 1,
  },
  saveButton: {
    backgroundColor: MINIMAL_UI.accent,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  section: {
    gap: 8,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: MINIMAL_UI.blueDark,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    borderRadius: 10,
    backgroundColor: MINIMAL_UI.background,
  },
  itemText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  itemLine: {
    fontSize: 13,
    fontWeight: '600',
    color: MINIMAL_UI.text,
  },
  itemLinePledged: {
    textDecorationLine: 'line-through',
    color: MINIMAL_UI.textMuted,
  },
  pledgeMeta: {
    fontSize: 12,
    color: MINIMAL_UI.textMuted,
  },
  deleteButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateButton: {
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: MINIMAL_UI.background,
  },
  dateButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: MINIMAL_UI.text,
  },
  historyDay: {
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    borderRadius: 10,
  },
});

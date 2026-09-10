import { DropdownSelect } from '@/components/ui/DropdownSelect';
import { MaintenanceHelpInfoTitle } from '@/components/ui/MaintenanceHelpInfoTitle';
import { confirmDialog } from '@/lib/confirmDialog';
import {
  createPrimiciasItem,
  deletePrimiciasItem,
  formatPrimiciasItemLine,
  listPrimiciasItems,
  PRIMICIAS_CATEGORIES,
  PRIMICIAS_CATEGORY_LABEL,
  type PrimiciasCategory,
  type PrimiciasItem,
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
  const [category, setCategory] = useState<PrimiciasCategory>('alimenticios');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('');
  const [productName, setProductName] = useState('');
  const [weight, setWeight] = useState('');

  const load = useCallback(async () => {
    const result = await listPrimiciasItems();
    setItems(result.items);
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
        helpText="Cadastre ou exclua itens da campanha. Cada item precisa de quantidade, unidade de medida, nome do produto e peso. Itens padrão excluídos não voltam sozinhos."
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
          <Text style={styles.formLabel}>Novo item</Text>
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

          {grouped.map((group) => (
            <View key={group.category} style={styles.section}>
              <Text style={styles.sectionTitle}>{PRIMICIAS_CATEGORY_LABEL[group.category]}</Text>
              {group.items.map((item) => {
                const pledgeCount = item.pledges.length;

                return (
                  <View key={item.id} style={styles.itemRow}>
                    <View style={styles.itemText}>
                      <Text style={styles.itemLine}>{formatPrimiciasItemLine(item)}</Text>
                      <Text style={styles.pledgeMeta}>
                        {pledgeCount === 0
                          ? 'Nenhum compromisso'
                          : `${pledgeCount} ${pledgeCount === 1 ? 'doador' : 'doadores'}: ${item.pledges
                              .map((pledge) => pledge.name)
                              .join(', ')}`}
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
            </View>
          ))}
        </ScrollView>
      )}
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
});

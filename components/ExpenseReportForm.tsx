import { DropdownSelect } from '@/components/ui/DropdownSelect';
import { SectionLabel } from '@/components/ui/SectionLabel';
import {
  createEmptyExpenseReportDraftItem,
  getExpenseReportTodayDateInput,
  parseExpenseReportAmountInputLenient,
  sanitizeExpenseAmountCentsInput,
  sanitizeExpenseReportDateInput,
  type ExpenseReportDraftItem,
  type ExpenseReportHeader,
} from '@/lib/expenseReport';
import {
  buildFinancialMaintenanceMonthOptions,
  formatFinancialMonthKey,
  formatFinancialMonthLabel,
  getCalendarMonthKey,
  parseFinancialMonthKey,
  type FinancialMonthKey,
} from '@/lib/financialMonth';
import {
  pasteFinancialReceiptFromClipboard,
  pickFinancialReceiptFromGallery,
} from '@/lib/financialReceipt';
import { MINIMAL_SECTION_TITLE, MINIMAL_TYPO, MINIMAL_UI } from '@/lib/minimalUiTheme';
import { FontAwesome } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';

type Props = {
  header: ExpenseReportHeader;
  submitting: boolean;
  initialReferenceMonth?: FinancialMonthKey | null;
  allowAnyReferenceMonth?: boolean;
  onSubmit: (input: {
    pixKey: string;
    items: ExpenseReportDraftItem[];
    referenceMonthKey: string;
  }) => void;
  onCancel: () => void;
};

export function ExpenseReportForm({
  header,
  submitting,
  initialReferenceMonth,
  allowAnyReferenceMonth = false,
  onSubmit,
  onCancel,
}: Props) {
  const [pixKey, setPixKey] = useState(header.pixKey);
  const [items, setItems] = useState<ExpenseReportDraftItem[]>([createEmptyExpenseReportDraftItem()]);
  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null);
  const [referenceMonth, setReferenceMonth] = useState<FinancialMonthKey>(
    () => initialReferenceMonth ?? getCalendarMonthKey()
  );

  const referenceMonthOptions = useMemo(() => {
    if (allowAnyReferenceMonth) {
      return buildFinancialMaintenanceMonthOptions();
    }

    return [getCalendarMonthKey()];
  }, [allowAnyReferenceMonth]);

  const referenceMonthDropdownOptions = useMemo(
    () =>
      referenceMonthOptions.map((monthKey) => ({
        value: formatFinancialMonthKey(monthKey),
        label: formatFinancialMonthLabel(monthKey),
      })),
    [referenceMonthOptions]
  );

  useEffect(() => {
    if (initialReferenceMonth) {
      setReferenceMonth(initialReferenceMonth);
    }
  }, [initialReferenceMonth]);

  const totalAmount = useMemo(
    () =>
      items.reduce(
        (sum, item) => sum + parseExpenseReportAmountInputLenient(item.amountInput),
        0
      ),
    [items]
  );

  const updateItem = (itemId: string, patch: Partial<ExpenseReportDraftItem>) => {
    setItems((current) =>
      current.map((item) => (item.id === itemId ? { ...item, ...patch } : item))
    );
  };

  const addItem = () => {
    setItems((current) => [...current, createEmptyExpenseReportDraftItem()]);
  };

  const removeItem = (itemId: string) => {
    setItems((current) => {
      if (current.length <= 1) {
        return current;
      }

      return current.filter((item) => item.id !== itemId);
    });
  };

  const attachReceipt = async (itemId: string, source: 'clipboard' | 'gallery') => {
    setUploadingItemId(itemId);

    try {
      const imageInput =
        source === 'clipboard'
          ? await pasteFinancialReceiptFromClipboard()
          : await pickFinancialReceiptFromGallery();

      if (!imageInput) {
        if (source === 'clipboard') {
          Toast.show({
            type: 'info',
            text1: 'RD',
            text2: 'Nenhuma imagem encontrada na área de transferência.',
          });
        }

        return;
      }

      updateItem(itemId, { receiptImage: imageInput, receiptUrl: null });
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'RD',
        text2: err instanceof Error ? err.message : 'Não foi possível anexar o comprovante.',
      });
    } finally {
      setUploadingItemId(null);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Novo Relatório de Despesas</Text>

      <View style={styles.headerCard}>
        <SectionLabel label="Cabeçalho" />
        <Text style={styles.headerLine}>Nome: {header.fullName}</Text>
        <Text style={styles.headerLine}>Telefone: {header.phone}</Text>
        <Text style={styles.fieldLabel}>Chave PIX</Text>
        <TextInput
          style={styles.input}
          value={pixKey}
          onChangeText={setPixKey}
          placeholder="Informe sua chave PIX"
          placeholderTextColor={MINIMAL_UI.textMuted}
          editable={!submitting}
        />
      </View>

      <View style={styles.itemsSection}>
        <SectionLabel label="Despesas" />
        <View style={styles.itemsToolbar}>
          <View style={styles.referenceMonthPicker}>
            <Text style={styles.referenceMonthLabel}>Competência</Text>
            <DropdownSelect
              options={referenceMonthDropdownOptions}
              selectedValue={formatFinancialMonthKey(referenceMonth)}
              onValueChange={(value) => {
                const parsed = parseFinancialMonthKey(value);

                if (parsed) {
                  setReferenceMonth(parsed);
                }
              }}
              modalTitle="Competência do RD"
              placeholder="Mês/Ano"
              size="compact"
              style={styles.referenceMonthDropdown}
              disabled={submitting || !allowAnyReferenceMonth}
            />
          </View>
          <TouchableOpacity
            style={styles.addButton}
            onPress={addItem}
            disabled={submitting}
            activeOpacity={0.85}
          >
            <FontAwesome name="plus" size={12} color={MINIMAL_UI.blueDark} />
            <Text style={styles.addButtonText}>Adicionar linha</Text>
          </TouchableOpacity>
        </View>
      </View>

      {items.map((item, index) => (
        <View key={item.id} style={styles.itemCard}>
          <View style={styles.itemCardHeader}>
            <Text style={styles.itemTitle}>Linha {index + 1}</Text>
            {items.length > 1 ? (
              <TouchableOpacity
                onPress={() => removeItem(item.id)}
                disabled={submitting}
                hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
              >
                <FontAwesome name="trash" size={14} color={MINIMAL_UI.blueDark} />
              </TouchableOpacity>
            ) : null}
          </View>

          <Text style={styles.fieldLabel}>Data de preenchimento (DD/MM/AAAA)</Text>
          <TextInput
            style={styles.input}
            value={item.dateInput}
            onChangeText={(value) =>
              updateItem(item.id, { dateInput: sanitizeExpenseReportDateInput(value) })
            }
            placeholder={getExpenseReportTodayDateInput()}
            placeholderTextColor={MINIMAL_UI.textMuted}
            keyboardType="numeric"
            inputMode="numeric"
            maxLength={10}
            editable={!submitting}
          />

          <Text style={styles.fieldLabel}>Descrição</Text>
          <TextInput
            style={styles.input}
            value={item.description}
            onChangeText={(value) => updateItem(item.id, { description: value })}
            placeholder="Ex.: combustível, alimentação"
            placeholderTextColor={MINIMAL_UI.textMuted}
            editable={!submitting}
          />

          <Text style={styles.fieldLabel}>Valor (R$)</Text>
          <TextInput
            style={[styles.input, styles.amountInput]}
            value={item.amountInput}
            onChangeText={(value) =>
              updateItem(item.id, { amountInput: sanitizeExpenseAmountCentsInput(value) })
            }
            placeholder="0,00"
            placeholderTextColor={MINIMAL_UI.textMuted}
            keyboardType="number-pad"
            inputMode="numeric"
            editable={!submitting}
          />

          <View style={styles.receiptRow}>
            <TouchableOpacity
              style={styles.receiptButton}
              onPress={() => void attachReceipt(item.id, 'clipboard')}
              disabled={submitting || uploadingItemId !== null}
              activeOpacity={0.85}
            >
              {uploadingItemId === item.id ? (
                <ActivityIndicator color={MINIMAL_UI.blueDark} size="small" />
              ) : (
                <>
                  <FontAwesome name="clipboard" size={13} color={MINIMAL_UI.blueDark} />
                  <Text style={styles.receiptButtonText}>Colar comprovante</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.receiptButton}
              onPress={() => void attachReceipt(item.id, 'gallery')}
              disabled={submitting || uploadingItemId !== null}
              activeOpacity={0.85}
            >
              <FontAwesome name="image" size={13} color={MINIMAL_UI.blueDark} />
              <Text style={styles.receiptButtonText}>Galeria</Text>
            </TouchableOpacity>
          </View>
          {item.receiptImage ? (
            <Text style={styles.receiptAttached}>Comprovante anexado nesta linha</Text>
          ) : null}
        </View>
      ))}

      <View style={styles.totalCard}>
        <Text style={styles.totalLabel}>Total do relatório</Text>
        <Text style={styles.totalValue}>
          {totalAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.cancelButton, submitting && styles.submitButtonDisabled]}
        onPress={() => void onCancel()}
        disabled={submitting}
        activeOpacity={0.85}
      >
        <Text style={styles.cancelButtonText}>Cancelar relatório</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
        onPress={() =>
          onSubmit({
            pixKey,
            items,
            referenceMonthKey: formatFinancialMonthKey(referenceMonth),
          })
        }
        disabled={submitting}
        activeOpacity={0.85}
      >
        {submitting ? (
          <ActivityIndicator color={MINIMAL_UI.onDark} size="small" />
        ) : (
          <Text style={styles.submitButtonText}>Submeter e Finalizar</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 14,
  },
  title: {
    ...MINIMAL_SECTION_TITLE,
    alignSelf: 'stretch',
    marginBottom: 0,
    paddingVertical: 8,
  },
  headerCard: {
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    borderRadius: 12,
    backgroundColor: MINIMAL_UI.rowHover,
    padding: 12,
    gap: 8,
  },
  headerLine: {
    color: MINIMAL_UI.blueDark,
    fontSize: 14,
  },
  fieldLabel: {
    ...MINIMAL_TYPO.sectionLabel,
    color: MINIMAL_UI.blueDark,
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    borderRadius: 10,
    backgroundColor: MINIMAL_UI.background,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: MINIMAL_UI.blueDark,
    fontSize: 14,
  },
  amountInput: {
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  itemsSection: {
    gap: 8,
  },
  itemsToolbar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
  referenceMonthPicker: {
    flex: 1,
    gap: 4,
    alignItems: 'flex-start',
    minWidth: 0,
  },
  referenceMonthLabel: {
    ...MINIMAL_TYPO.sectionLabel,
    color: MINIMAL_UI.blueDark,
  },
  referenceMonthDropdown: {
    minWidth: 132,
    maxWidth: 200,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.rowHover,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 31,
    flexShrink: 0,
  },
  addButtonText: {
    color: MINIMAL_UI.blueDark,
    fontSize: 12,
    fontWeight: '700',
  },
  itemCard: {
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    borderRadius: 12,
    backgroundColor: MINIMAL_UI.background,
    padding: 12,
    gap: 6,
  },
  itemCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemTitle: {
    color: MINIMAL_UI.blueDark,
    fontSize: 14,
    fontWeight: '800',
  },
  receiptRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  receiptButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    borderRadius: 10,
    backgroundColor: MINIMAL_UI.rowHover,
    paddingVertical: 10,
    minHeight: 40,
  },
  receiptButtonText: {
    color: MINIMAL_UI.blueDark,
    fontSize: 12,
    fontWeight: '700',
  },
  receiptAttached: {
    color: MINIMAL_UI.blue,
    fontSize: 12,
    fontWeight: '600',
  },
  totalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    borderRadius: 12,
    backgroundColor: MINIMAL_UI.rowHover,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  totalLabel: {
    color: MINIMAL_UI.blueDark,
    fontSize: 13,
    fontWeight: '700',
  },
  totalValue: {
    color: MINIMAL_UI.blueDark,
    fontSize: 16,
    fontWeight: '800',
  },
  cancelButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: MINIMAL_UI.blueDark,
    backgroundColor: MINIMAL_UI.background,
    paddingVertical: 14,
    minHeight: 48,
  },
  cancelButtonText: {
    color: MINIMAL_UI.blueDark,
    fontSize: 15,
    fontWeight: '700',
  },
  submitButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: MINIMAL_UI.blueDark,
    paddingVertical: 14,
    minHeight: 48,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: MINIMAL_UI.onDark,
    fontSize: 15,
    fontWeight: '800',
  },
});

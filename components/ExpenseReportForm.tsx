import { SectionLabel } from '@/components/ui/SectionLabel';
import {
  createEmptyExpenseReportDraftItem,
  getExpenseReportTodayDateInput,
  parseExpenseReportAmountInputLenient,
  sanitizeExpenseAmountInput,
  type ExpenseReportDraftItem,
  type ExpenseReportHeader,
} from '@/lib/expenseReport';
import {
  pasteFinancialReceiptFromClipboard,
  pickFinancialReceiptFromGallery,
} from '@/lib/financialReceipt';
import { FontAwesome } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
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
  onSubmit: (input: { pixKey: string; items: ExpenseReportDraftItem[] }) => void;
};

export function ExpenseReportForm({ header, submitting, onSubmit }: Props) {
  const [pixKey, setPixKey] = useState(header.pixKey);
  const [items, setItems] = useState<ExpenseReportDraftItem[]>([createEmptyExpenseReportDraftItem()]);
  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null);

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
          placeholderTextColor="#94A3B8"
          editable={!submitting}
        />
      </View>

      <View style={styles.itemsHeader}>
        <SectionLabel label="Despesas" />
        <TouchableOpacity
          style={styles.addButton}
          onPress={addItem}
          disabled={submitting}
          activeOpacity={0.85}
        >
          <FontAwesome name="plus" size={12} color="#0F172A" />
          <Text style={styles.addButtonText}>Adicionar linha</Text>
        </TouchableOpacity>
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
                <FontAwesome name="trash" size={14} color="#B91C1C" />
              </TouchableOpacity>
            ) : null}
          </View>

          <Text style={styles.fieldLabel}>Data de preenchimento (DD/MM/AA)</Text>
          <TextInput
            style={styles.input}
            value={item.dateInput}
            onChangeText={(value) => updateItem(item.id, { dateInput: value })}
            placeholder={getExpenseReportTodayDateInput()}
            placeholderTextColor="#94A3B8"
            editable={!submitting}
          />

          <Text style={styles.fieldLabel}>Descrição</Text>
          <TextInput
            style={styles.input}
            value={item.description}
            onChangeText={(value) => updateItem(item.id, { description: value })}
            placeholder="Ex.: combustível, alimentação"
            placeholderTextColor="#94A3B8"
            editable={!submitting}
          />

          <Text style={styles.fieldLabel}>Valor (R$)</Text>
          <TextInput
            style={styles.input}
            value={item.amountInput}
            onChangeText={(value) =>
              updateItem(item.id, { amountInput: sanitizeExpenseAmountInput(value) })
            }
            placeholder="0,00"
            placeholderTextColor="#94A3B8"
            keyboardType="numeric"
            inputMode="decimal"
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
                <ActivityIndicator color="#1D4ED8" size="small" />
              ) : (
                <>
                  <FontAwesome name="clipboard" size={13} color="#1D4ED8" />
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
              <FontAwesome name="image" size={13} color="#1D4ED8" />
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
        style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
        onPress={() => onSubmit({ pixKey, items })}
        disabled={submitting}
        activeOpacity={0.85}
      >
        {submitting ? (
          <ActivityIndicator color="#FFFFFF" size="small" />
        ) : (
          <Text style={styles.submitButtonText}>Finalizar</Text>
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
    color: '#0F172A',
    fontSize: 18,
    fontWeight: '800',
  },
  headerCard: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    padding: 12,
    gap: 8,
  },
  headerLine: {
    color: '#334155',
    fontSize: 14,
  },
  fieldLabel: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#0F172A',
    fontSize: 14,
  },
  itemsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  addButtonText: {
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '700',
  },
  itemCard: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    padding: 12,
    gap: 6,
  },
  itemCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemTitle: {
    color: '#0F172A',
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
    borderColor: '#BFDBFE',
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    paddingVertical: 10,
    minHeight: 40,
  },
  receiptButtonText: {
    color: '#1D4ED8',
    fontSize: 12,
    fontWeight: '700',
  },
  receiptAttached: {
    color: '#059669',
    fontSize: 12,
    fontWeight: '600',
  },
  totalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 12,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  totalLabel: {
    color: '#065F46',
    fontSize: 13,
    fontWeight: '700',
  },
  totalValue: {
    color: '#065F46',
    fontSize: 16,
    fontWeight: '800',
  },
  submitButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#059669',
    paddingVertical: 14,
    minHeight: 48,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});

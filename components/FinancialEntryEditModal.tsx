import { DropdownSelect } from '@/components/ui/DropdownSelect';
import { formatFinancialBulkDateLabel } from '@/lib/maintenanceFinancialBulk';
import {
  buildFinancialEntryEditForm,
  FINANCIAL_ENTRY_BUDGET_VERSION_OPTIONS,
  FINANCIAL_ENTRY_MOVEMENT_OPTIONS,
  FINANCIAL_ENTRY_TRANSACTION_KIND_OPTIONS,
  validateFinancialEntryEditForm,
  type FinancialEntryEditDraft,
  type FinancialEntryEditFormState,
} from '@/lib/maintenanceFinancialEntryForm';
import type { FinancialEntry } from '@/lib/financialEntry';
import { FontAwesome } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

type Props = {
  visible: boolean;
  entry: FinancialEntry | null;
  saving: boolean;
  onClose: () => void;
  onSave: (entryId: string, draft: FinancialEntryEditDraft) => void;
};

export function FinancialEntryEditModal({ visible, entry, saving, onClose, onSave }: Props) {
  const [form, setForm] = useState<FinancialEntryEditFormState | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !entry) {
      setForm(null);
      setFormError(null);
      return;
    }

    setForm(buildFinancialEntryEditForm(entry));
    setFormError(null);
  }, [entry, visible]);

  const updateField = <K extends keyof FinancialEntryEditFormState>(
    field: K,
    value: FinancialEntryEditFormState[K]
  ) => {
    setForm((current) => (current ? { ...current, [field]: value } : current));
    setFormError(null);
  };

  const handleSave = () => {
    if (!entry || !form) {
      return;
    }

    const validation = validateFinancialEntryEditForm(form);

    if (!validation.valid) {
      setFormError(validation.message);
      return;
    }

    onSave(entry.id, validation.draft);
  };

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={(event) => event.stopPropagation()}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.title}>Editar registro</Text>
            {entry ? (
              <Text style={styles.subtitle} numberOfLines={2}>
                {entry.account} · {entry.ministry} ·{' '}
                {formatFinancialBulkDateLabel(entry.transaction_date)}
              </Text>
            ) : null}

            {form ? (
              <>
                <Text style={styles.fieldLabel}>Data (DD/MM/AA)</Text>
                <TextInput
                  style={styles.input}
                  value={form.transactionDateInput}
                  onChangeText={(value) => updateField('transactionDateInput', value)}
                  placeholder="04/05/26"
                  placeholderTextColor="#64748B"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!saving}
                />

                <Text style={styles.fieldLabel}>Conta</Text>
                <TextInput
                  style={styles.input}
                  value={form.account}
                  onChangeText={(value) => updateField('account', value)}
                  placeholder="Ex.: SICREDI"
                  placeholderTextColor="#64748B"
                  autoCapitalize="characters"
                  editable={!saving}
                />

                <Text style={styles.fieldLabel}>Ministério</Text>
                <TextInput
                  style={styles.input}
                  value={form.ministry}
                  onChangeText={(value) => updateField('ministry', value)}
                  placeholder="Ex.: PROJETOS"
                  placeholderTextColor="#64748B"
                  autoCapitalize="characters"
                  editable={!saving}
                />

                <Text style={styles.fieldLabel}>Transação</Text>
                <DropdownSelect
                  options={FINANCIAL_ENTRY_TRANSACTION_KIND_OPTIONS}
                  selectedValue={form.transactionKind}
                  onValueChange={(value) => updateField('transactionKind', value)}
                  modalTitle="Tipo de transação"
                  placeholder="Selecionar transação"
                  disabled={saving}
                />

                <Text style={styles.fieldLabel}>Movimento</Text>
                <DropdownSelect
                  options={FINANCIAL_ENTRY_MOVEMENT_OPTIONS}
                  selectedValue={form.movement}
                  onValueChange={(value) => updateField('movement', value)}
                  modalTitle="Movimento"
                  placeholder="Selecionar movimento"
                  disabled={saving}
                />

                <Text style={styles.fieldLabel}>Versão</Text>
                <DropdownSelect
                  options={FINANCIAL_ENTRY_BUDGET_VERSION_OPTIONS}
                  selectedValue={form.budgetVersion}
                  onValueChange={(value) => updateField('budgetVersion', value)}
                  modalTitle="Versão do lançamento"
                  placeholder="Selecionar versão"
                  disabled={saving}
                />

                <Text style={styles.fieldLabel}>Valor</Text>
                <TextInput
                  style={styles.input}
                  value={form.amountInput}
                  onChangeText={(value) => updateField('amountInput', value)}
                  placeholder="Ex.: 1348 ou 12086.19"
                  placeholderTextColor="#64748B"
                  keyboardType="decimal-pad"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!saving}
                />

                {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
              </>
            ) : null}

            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={onClose}
                disabled={saving}
                activeOpacity={0.85}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                onPress={handleSave}
                disabled={saving || !form}
                activeOpacity={0.85}
              >
                {saving ? (
                  <ActivityIndicator color="#0f172a" size="small" />
                ) : (
                  <>
                    <FontAwesome name="save" size={14} color="#0f172a" />
                    <Text style={styles.saveButtonText}>Salvar</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.72)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    backgroundColor: '#0f172a',
    maxHeight: '88%',
    width: '100%',
    maxWidth: 420,
    overflow: 'hidden',
  },
  scrollContent: {
    padding: 14,
    gap: 8,
  },
  title: {
    color: '#ECFDF5',
    fontSize: 16,
    fontWeight: '800',
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 12,
    marginBottom: 4,
  },
  fieldLabel: {
    color: '#A7F3D0',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 2,
  },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    borderRadius: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    color: '#FFF',
    fontSize: 13,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  errorText: {
    color: '#FECACA',
    fontSize: 12,
    lineHeight: 17,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 8,
  },
  cancelButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  cancelButtonText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '700',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 12,
    backgroundColor: '#34D399',
    paddingHorizontal: 14,
    paddingVertical: 10,
    minWidth: 108,
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.55,
  },
  saveButtonText: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '800',
  },
});

import { confirmDialog } from '@/lib/confirmDialog';
import { formatBrazilDateInput } from '@/lib/inputMasks';
import {
  decidePettyCashExpenseDeletion,
  formatPettyCashBrl,
  formatPettyCashDate,
  parsePettyCashAmount,
  parsePettyCashBrDate,
  removePettyCashReceipt,
  updatePettyCashExpenseRequest,
  type PettyCashDeletionRequest,
} from '@/lib/pettyCashApi';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Toast from 'react-native-toast-message';

type Props = {
  request: PettyCashDeletionRequest;
  onChanged: () => Promise<void>;
};

export function PettyCashDeletionEditor({ request, onChanged }: Props) {
  const [valor, setValor] = useState('');
  const [descricao, setDescricao] = useState('');
  const [data, setData] = useState('');
  const [busy, setBusy] = useState<'save' | 'delete' | null>(null);

  useEffect(() => {
    setValor(request.valor.toFixed(2).replace('.', ','));
    setDescricao(request.descricao);
    setData(formatPettyCashDate(request.dataMovimento));
  }, [request.id, request.valor, request.descricao, request.dataMovimento]);

  const save = async () => {
    const amount = parsePettyCashAmount(valor);
    const dataIso = parsePettyCashBrDate(data);

    if (amount == null || amount <= 0) {
      Toast.show({ type: 'error', text1: 'Informe o valor da despesa.' });
      return;
    }

    if (!dataIso) {
      Toast.show({ type: 'error', text1: 'Informe a data no formato DD/MM/AAAA.' });
      return;
    }

    if (descricao.trim().length < 3) {
      Toast.show({ type: 'error', text1: 'Descreva a despesa.' });
      return;
    }

    setBusy('save');

    try {
      await updatePettyCashExpenseRequest({
        movimentoId: request.id,
        valor: amount,
        descricao: descricao.trim(),
        dataIso,
      });
      await onChanged();
      Toast.show({ type: 'success', text1: 'Lançamento atualizado' });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Pequeno caixa',
        text2: error instanceof Error ? error.message : 'Não foi possível salvar o lançamento.',
      });
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    const confirmed = await confirmDialog(
      'Excluir lançamento',
      'A despesa sai do histórico e o comprovante é apagado.',
      'Excluir',
      'Cancelar',
      { destructive: true }
    );

    if (!confirmed) {
      return;
    }

    setBusy('delete');

    try {
      const storagePath = await decidePettyCashExpenseDeletion(request.id, 'confirmada');

      if (storagePath) {
        try {
          await removePettyCashReceipt(storagePath);
        } catch {
          await onChanged();
          Toast.show({
            type: 'error',
            text1: 'Pequeno caixa',
            text2: 'A despesa saiu do caixa, mas o comprovante não pôde ser apagado.',
          });
          return;
        }
      }

      await onChanged();
      Toast.show({ type: 'success', text1: 'Lançamento excluído' });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Pequeno caixa',
        text2: error instanceof Error ? error.message : 'Não foi possível excluir o lançamento.',
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={styles.panel}>
      <Text style={styles.title}>Solicitação de exclusão</Text>
      <Text style={styles.message}>
        {request.descricao} · {formatPettyCashBrl(request.valor)} · {formatPettyCashDate(request.dataMovimento)}.
        Edite o lançamento e, em seguida, exclua.
      </Text>
      <Text style={styles.label}>Valor</Text>
      <TextInput
        value={valor}
        onChangeText={setValor}
        keyboardType="decimal-pad"
        placeholder="0,00"
        placeholderTextColor="#92400E"
        style={styles.input}
        accessibilityLabel="Valor do lançamento"
      />
      <Text style={styles.label}>Descrição</Text>
      <TextInput
        value={descricao}
        onChangeText={setDescricao}
        placeholder="Descrição da despesa"
        placeholderTextColor="#92400E"
        style={styles.input}
        accessibilityLabel="Descrição do lançamento"
      />
      <Text style={styles.label}>Data</Text>
      <TextInput
        value={data}
        onChangeText={(value) => setData(formatBrazilDateInput(value))}
        placeholder="DD/MM/AAAA"
        placeholderTextColor="#92400E"
        style={styles.input}
        accessibilityLabel="Data do lançamento"
      />
      <View style={styles.actions}>
        <TouchableOpacity style={styles.save} disabled={busy != null} onPress={() => void save()}>
          <Text style={styles.saveText}>{busy === 'save' ? 'Salvando…' : 'Salvar edição'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.remove} disabled={busy != null} onPress={() => void remove()}>
          <Text style={styles.removeText}>{busy === 'delete' ? 'Excluindo…' : 'Excluir lançamento'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: 6,
    padding: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#D97706',
    backgroundColor: '#FEF3C7',
  },
  title: {
    color: '#92400E',
    fontSize: 16,
    fontWeight: '800',
  },
  message: {
    color: '#78350F',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  label: {
    color: '#78350F',
    fontSize: 13,
    fontWeight: '800',
  },
  input: {
    borderWidth: 1,
    borderColor: '#D97706',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    color: '#0F172A',
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  save: {
    backgroundColor: '#B45309',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  saveText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  remove: {
    backgroundColor: '#991B1B',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  removeText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
});

import { CloseFooterBar } from '@/components/minimal/CloseFooterBar';
import { MinimalScreenLayout } from '@/components/minimal/MinimalScreenLayout';
import { ScreenAccessGate } from '@/components/ScreenAccessGate';
import { useScreenAccessGuard } from '@/hooks/useScreenAccessGuard';
import { confirmDialog } from '@/lib/confirmDialog';
import { pickFinancialReceiptFromCamera, pickFinancialReceiptFromGallery } from '@/lib/financialReceipt';
import { formatBrazilDateInput } from '@/lib/inputMasks';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import {
  deletePettyCashExpense,
  fetchMyPettyCashBoxes,
  fetchPettyCashMovements,
  formatPettyCashBrl,
  formatPettyCashDate,
  openPettyCashReceipt,
  parsePettyCashBrDate,
  PETTY_CASH_CONTROL_SCREEN,
  pettyCashAlertLines,
  registerPettyCashMovement,
  removePettyCashReceipt,
  todayPettyCashBrDate,
  uploadPettyCashReceipt,
  type PettyCashBox,
  type PettyCashMovement,
} from '@/lib/pettyCashApi';
import { brlCentsDigitsToAmount, formatBrlCentsDigits, parseBrlCentsDigits } from '@/lib/pixEmvPayload';
import { useReturnToCallerOnLeave } from '@/hooks/useReturnToCallerOnLeave';
import { FontAwesome } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';

const STATUS_LABEL: Record<PettyCashMovement['status_aprovacao'], string> = {
  pendente: 'Pendente',
  aprovado: 'Aprovado',
  rejeitado: 'Rejeitado',
};

export default function PequenoCaixaScreen() {
  const accessStatus = useScreenAccessGuard({
    resourceKey: PETTY_CASH_CONTROL_SCREEN,
    deniedMessage: 'Você não tem permissão para controlar um pequeno caixa.',
  });
  const returnToCaller = useReturnToCallerOnLeave();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [boxes, setBoxes] = useState<PettyCashBox[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [movements, setMovements] = useState<PettyCashMovement[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [amountDigits, setAmountDigits] = useState('');
  const [description, setDescription] = useState('');
  const [movementDate, setMovementDate] = useState(todayPettyCashBrDate);
  const [receipt, setReceipt] = useState<string | null>(null);
  const [replenishReceipt, setReplenishReceipt] = useState<string | null>(null);

  const selected = boxes.find((box) => box.id === selectedId) ?? null;

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const list = await fetchMyPettyCashBoxes();
      setBoxes(list.caixas);
      setSelectedId((current) => current ?? list.caixas[0]?.id ?? null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Não foi possível carregar o caixa.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMovements = useCallback(async (caixaId: string) => {
    try {
      setMovements(await fetchPettyCashMovements(caixaId));
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Pequeno caixa',
        text2: error instanceof Error ? error.message : 'Não foi possível carregar o histórico.',
      });
    }
  }, []);

  useEffect(() => {
    if (accessStatus === 'allowed' || accessStatus === 'skipped') {
      void load();
    }
  }, [accessStatus, load]);

  useEffect(() => {
    if (selectedId) {
      void loadMovements(selectedId);
    }
  }, [loadMovements, selectedId]);

  const submitMovement = async (tipo: 'despesa' | 'reposicao') => {
    if (!selected || submitting) {
      return;
    }

    const image = tipo === 'despesa' ? receipt : replenishReceipt;

    if (!image) {
      Toast.show({
        type: 'error',
        text1: 'Comprovante obrigatório',
        text2: 'Anexe a imagem para concluir o registro.',
      });
      return;
    }

    const dataIso = parsePettyCashBrDate(movementDate);
    const valor = tipo === 'despesa' ? brlCentsDigitsToAmount(amountDigits) : selected.valor_recomposicao;

    if (!dataIso) {
      Toast.show({ type: 'error', text1: 'Informe a data no formato DD/MM/AAAA.' });
      return;
    }

    if (tipo === 'despesa' && (valor == null || valor <= 0)) {
      Toast.show({ type: 'error', text1: 'Informe o valor da despesa.' });
      return;
    }

    if (tipo === 'despesa' && description.trim().length < 3) {
      Toast.show({ type: 'error', text1: 'Descreva a despesa.' });
      return;
    }

    setSubmitting(true);
    let storagePath: string | null = null;

    try {
      storagePath = await uploadPettyCashReceipt(selected.id, image);
      await registerPettyCashMovement({
        caixaId: selected.id,
        tipo,
        valor: valor ?? 0,
        descricao: tipo === 'despesa' ? description.trim() : 'Reposição ao valor-base',
        dataIso,
        comprovantePath: storagePath,
      });
      setAmountDigits('');
      setDescription('');
      setReceipt(null);
      setReplenishReceipt(null);
      setMovementDate(todayPettyCashBrDate());
      await load();
      await loadMovements(selected.id);
      Toast.show({
        type: 'success',
        text1: tipo === 'despesa' ? 'Despesa enviada para conferência' : 'Reposição enviada para conferência',
      });
    } catch (error) {
      if (storagePath) {
        await removePettyCashReceipt(storagePath);
      }

      Toast.show({
        type: 'error',
        text1: 'Pequeno caixa',
        text2: error instanceof Error ? error.message : 'Não foi possível registrar.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const expenseDraftFilled = amountDigits.length > 0 || description.trim().length > 0 || receipt != null;

  const clearExpenseDraft = async () => {
    if (!expenseDraftFilled) {
      Toast.show({ type: 'info', text1: 'Não há despesa preenchida para excluir.' });
      return;
    }

    const confirmed = await confirmDialog(
      'Excluir despesa',
      'A despesa preenchida e o comprovante anexado serão descartados.',
      'Excluir',
      'Cancelar',
      { destructive: true }
    );

    if (!confirmed) {
      return;
    }

    setAmountDigits('');
    setDescription('');
    setReceipt(null);
    setMovementDate(todayPettyCashBrDate());
  };

  const deleteSavedExpense = async (movement: PettyCashMovement) => {
    if (!selected || deletingId || movement.tipo !== 'despesa') {
      return;
    }

    const confirmed = await confirmDialog(
      'Excluir despesa',
      'O registro e o comprovante associado serão excluídos.',
      'Excluir',
      'Cancelar',
      { destructive: true }
    );

    if (!confirmed) {
      return;
    }

    setDeletingId(movement.id);

    try {
      const storagePath = await deletePettyCashExpense(movement.id);

      if (storagePath) {
        await removePettyCashReceipt(storagePath);
      }

      await load();
      await loadMovements(selected.id);
      Toast.show({ type: 'success', text1: 'Despesa excluída' });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Pequeno caixa',
        text2: error instanceof Error ? error.message : 'Não foi possível excluir a despesa.',
      });
    } finally {
      setDeletingId(null);
    }
  };

  const pickReceipt = async (target: 'despesa' | 'reposicao') => {
    try {
      const image = await pickFinancialReceiptFromGallery();

      if (!image) {
        return;
      }

      if (target === 'despesa') {
        setReceipt(image);
      } else {
        setReplenishReceipt(image);
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Comprovante',
        text2: error instanceof Error ? error.message : 'Não foi possível anexar a imagem.',
      });
    }
  };

  const pickExpensePhoto = async () => {
    try {
      const image = await pickFinancialReceiptFromCamera();

      if (image) {
        setReceipt(image);
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Comprovante',
        text2: error instanceof Error ? error.message : 'Não foi possível fotografar o comprovante.',
      });
    }
  };

  return (
    <ScreenAccessGate status={accessStatus}>
      <MinimalScreenLayout
        footer={<CloseFooterBar onPress={returnToCaller} />}
        fixedTop={
          <View style={styles.header}>
            <FontAwesome name="money" size={18} color={MINIMAL_UI.icon} />
            <Text style={styles.title}>Pequeno caixa</Text>
          </View>
        }
      >
        {loading ? <ActivityIndicator color={MINIMAL_UI.accent} /> : null}
        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
        {!loading && boxes.length === 0 ? (
          <Text style={styles.note}>
            Nenhum pequeno caixa ativo está atribuído a você. A manutenção escolhe o responsável na engrenagem.
          </Text>
        ) : null}

        {boxes.length > 1 ? (
          <View style={styles.switchRow}>
            {boxes.map((box) => (
              <TouchableOpacity
                key={box.id}
                style={[styles.switchChip, box.id === selectedId && styles.switchChipOn]}
                onPress={() => setSelectedId(box.id)}
              >
                <Text style={[styles.switchText, box.id === selectedId && styles.switchTextOn]}>{box.nome_caixa}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        {selected ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{selected.nome_caixa}</Text>
            {pettyCashAlertLines(selected).map((alert) => (
              <Text
                key={alert.tone}
                style={[
                  styles.alert,
                  alert.tone === 'late' && styles.alertLate,
                  alert.tone === 'soon' && styles.alertSoon,
                  alert.tone === 'resend' && styles.alertResend,
                ]}
              >
                {alert.text}
              </Text>
            ))}
            <Text style={styles.line}>
              Valor-base {formatPettyCashBrl(selected.valor_base)} · fecha todo dia {selected.dia_fechamento}
            </Text>
            <Text style={styles.line}>Saldo inicial {formatPettyCashBrl(selected.saldo_inicial)}</Text>
            <Text style={styles.line}>Despesas comprovadas {formatPettyCashBrl(selected.total_despesas)}</Text>
            <Text style={styles.line}>Saldo remanescente {formatPettyCashBrl(selected.saldo_remanescente)}</Text>
            <Text style={styles.line}>Recomposição {formatPettyCashBrl(selected.valor_recomposicao)}</Text>
            <Text style={styles.line}>
              Prestação até {selected.prazo ? formatPettyCashDate(selected.prazo) : '—'}
              {selected.prestacao_atrasada ? ' · em atraso' : ''}
            </Text>

            <Text style={styles.section}>Nova despesa</Text>
            <TextInput
              value={amountDigits ? `R$ ${formatBrlCentsDigits(amountDigits)}` : ''}
              onChangeText={(value) => setAmountDigits(parseBrlCentsDigits(value))}
              placeholder="R$ 0,00"
              keyboardType="number-pad"
              inputMode="numeric"
              accessibilityLabel="Valor em reais, com centavos"
              placeholderTextColor="#94A3B8"
              style={styles.input}
            />
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Descrição"
              placeholderTextColor="#94A3B8"
              style={styles.input}
            />
            <TextInput
              value={movementDate}
              onChangeText={(value) => setMovementDate(formatBrazilDateInput(value))}
              placeholder="DD/MM/AAAA"
              keyboardType="number-pad"
              placeholderTextColor="#94A3B8"
              style={styles.input}
            />
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.secondary, styles.actionFlex]}
                onPress={() => void pickReceipt('despesa')}
              >
                <Text style={styles.secondaryText}>{receipt ? 'Comprovante anexado' : 'Anexar comprovante'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cameraButton}
                onPress={() => void pickExpensePhoto()}
                accessibilityRole="button"
                accessibilityLabel="Fotografar comprovante"
              >
                <FontAwesome name="camera" size={18} color={MINIMAL_UI.blue} />
              </TouchableOpacity>
            </View>
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.primary, styles.actionFlex]}
                disabled={submitting}
                onPress={() => void submitMovement('despesa')}
              >
                <Text style={styles.primaryText}>{submitting ? 'Enviando…' : 'Registrar despesa'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => void clearExpenseDraft()}
                accessibilityRole="button"
                accessibilityLabel="Excluir despesa"
              >
                <Text style={styles.deleteText}>Excluir despesa</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.section}>Reposição até {formatPettyCashBrl(selected.valor_base)}</Text>
            <Text style={styles.note}>
              O valor da reposição é {formatPettyCashBrl(selected.valor_recomposicao)}. A imagem do comprovante é
              obrigatória e a aprovação só acontece se ela estiver salva. Se a conferência rejeitar, corrija e envie
              de novo.
              {selected.despesas_pendentes > 0
                ? ' Aguarde a conferência das despesas pendentes.'
                : ''}
            </Text>
            <TouchableOpacity style={styles.secondary} onPress={() => void pickReceipt('reposicao')}>
              <Text style={styles.secondaryText}>
                {replenishReceipt ? 'Comprovante da reposição anexado' : 'Anexar comprovante da reposição'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.primary}
              disabled={
                submitting
                || selected.valor_recomposicao <= 0
                || selected.despesas_pendentes > 0
                || selected.reposicao_pendente
              }
              onPress={() => void submitMovement('reposicao')}
            >
              <Text style={styles.primaryText}>Pedir reposição</Text>
            </TouchableOpacity>

            <Text style={styles.section}>Histórico</Text>
            {movements.map((movement) => (
              <View key={movement.id} style={styles.movement}>
                <Text style={styles.line}>
                  {movement.tipo === 'despesa' ? 'Despesa' : 'Reposição'} · {formatPettyCashBrl(movement.valor)} ·{' '}
                  {STATUS_LABEL[movement.status_aprovacao]}
                </Text>
                <Text style={styles.line}>
                  {formatPettyCashDate(movement.data_movimento)} · {movement.descricao}
                </Text>
                {movement.status_aprovacao === 'rejeitado' ? (
                  <Text style={styles.line}>
                    Motivo: {movement.motivo_decisao || 'Corrija os dados e envie novamente.'}
                  </Text>
                ) : null}
                <TouchableOpacity
                  onPress={() => {
                    void openPettyCashReceipt(movement.comprovante_url)
                      .then((url) => Linking.openURL(url))
                      .catch((error: unknown) => {
                        Toast.show({
                          type: 'error',
                          text1: 'Comprovante',
                          text2: error instanceof Error ? error.message : 'Não foi possível abrir a imagem.',
                        });
                      });
                  }}
                >
                  <Text style={styles.link}>Ver comprovante</Text>
                </TouchableOpacity>
                {movement.tipo === 'despesa' ? (
                  <TouchableOpacity
                    style={styles.deleteButton}
                    disabled={deletingId === movement.id}
                    onPress={() => void deleteSavedExpense(movement)}
                    accessibilityRole="button"
                    accessibilityLabel="Excluir despesa do histórico"
                  >
                    <Text style={styles.deleteText}>
                      {deletingId === movement.id ? 'Excluindo…' : 'Excluir despesa'}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}
      </MinimalScreenLayout>
    </ScreenAccessGate>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: MINIMAL_UI.blueDark,
  },
  note: {
    color: MINIMAL_UI.text,
    fontSize: 14,
    lineHeight: 20,
  },
  alert: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  alertLate: {
    backgroundColor: '#FEE2E2',
    color: '#991B1B',
  },
  alertSoon: {
    backgroundColor: '#FEF3C7',
    color: '#92400E',
  },
  alertResend: {
    backgroundColor: '#E0E7FF',
    color: '#312E81',
  },
  error: {
    color: '#B91C1C',
  },
  switchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  switchChip: {
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  switchChipOn: {
    backgroundColor: MINIMAL_UI.blue,
    borderColor: MINIMAL_UI.blue,
  },
  switchText: {
    color: MINIMAL_UI.text,
    fontWeight: '700',
  },
  switchTextOn: {
    color: '#FFFFFF',
  },
  card: {
    gap: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: MINIMAL_UI.blueDark,
  },
  section: {
    marginTop: 8,
    fontWeight: '800',
    color: MINIMAL_UI.blueDark,
  },
  line: {
    color: MINIMAL_UI.text,
    fontSize: 14,
    lineHeight: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: MINIMAL_UI.blueDark,
    backgroundColor: '#FFFFFF',
  },
  primary: {
    backgroundColor: MINIMAL_UI.blue,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  secondary: {
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryText: {
    color: MINIMAL_UI.blue,
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionFlex: {
    flex: 1,
  },
  cameraButton: {
    width: 48,
    height: 45,
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  deleteButton: {
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  deleteText: {
    color: '#B91C1C',
    fontWeight: '800',
  },
  link: {
    color: MINIMAL_UI.icon,
    fontWeight: '700',
  },
  movement: {
    gap: 2,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: MINIMAL_UI.divider,
  },
});

import { CloseFooterBar } from '@/components/minimal/CloseFooterBar';
import { MinimalScreenLayout } from '@/components/minimal/MinimalScreenLayout';
import { ScreenAccessGate } from '@/components/ScreenAccessGate';
import { useScreenAccessGuard } from '@/hooks/useScreenAccessGuard';
import { pickFinancialReceiptFromGallery } from '@/lib/financialReceipt';
import { formatBrazilDateInput } from '@/lib/inputMasks';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import {
  fetchMyPettyCashBoxes,
  fetchPettyCashMovements,
  formatPettyCashBrl,
  formatPettyCashDate,
  openPettyCashReceipt,
  parsePettyCashAmount,
  parsePettyCashBrDate,
  PETTY_CASH_CONTROL_SCREEN,
  registerPettyCashMovement,
  removePettyCashReceipt,
  todayPettyCashBrDate,
  uploadPettyCashReceipt,
  type PettyCashBox,
  type PettyCashMovement,
} from '@/lib/pettyCashApi';
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
  const [boxes, setBoxes] = useState<PettyCashBox[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [movements, setMovements] = useState<PettyCashMovement[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
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
    const valor = tipo === 'despesa' ? parsePettyCashAmount(amount) : selected.valor_recomposicao;

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
      setAmount('');
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
              value={amount}
              onChangeText={setAmount}
              placeholder="Valor"
              keyboardType="decimal-pad"
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
            <TouchableOpacity style={styles.secondary} onPress={() => void pickReceipt('despesa')}>
              <Text style={styles.secondaryText}>{receipt ? 'Comprovante anexado' : 'Anexar comprovante'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.primary}
              disabled={submitting}
              onPress={() => void submitMovement('despesa')}
            >
              <Text style={styles.primaryText}>{submitting ? 'Enviando…' : 'Registrar despesa'}</Text>
            </TouchableOpacity>

            <Text style={styles.section}>Reposição ao valor-base</Text>
            <Text style={styles.note}>
              O valor da reposição é {formatPettyCashBrl(selected.valor_recomposicao)}. O registro só conclui com a
              imagem do comprovante de transferência, Pix ou recibo.
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

import { PettyCashDeletionEditor } from '@/components/PettyCashDeletionEditor';
import { DropdownSelect } from '@/components/ui/DropdownSelect';
import { MaintenanceHelpInfoTitle } from '@/components/ui/MaintenanceHelpInfoTitle';
import { confirmDialog } from '@/lib/confirmDialog';
import { sessionHasAccess } from '@/lib/accessControl';
import { MAINTENANCE_VIGILANCE_UI } from '@/lib/maintenanceVigilanceTheme';
import {
  deletePettyCashBox,
  decidePettyCashMovement,
  fetchPettyCashMaintenanceList,
  fetchPettyCashMovements,
  fetchPettyCashResponsibles,
  formatPettyCashBrl,
  formatPettyCashDate,
  openPettyCashReceipt,
  removePettyCashReceipt,
  parsePettyCashAmount,
  PETTY_CASH_MAINTENANCE_SCREEN,
  pettyCashAlertLines,
  savePettyCashBox,
  type PettyCashBox,
  type PettyCashMovement,
  type PettyCashResponsible,
  type PettyCashStatus,
} from '@/lib/pettyCashApi';
import { Linking, ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import React, { useCallback, useEffect, useState } from 'react';
import Toast from 'react-native-toast-message';

const HELP_TEXT =
  'Cada caixa tem o próprio valor-base e o dia de fechamento. Se esse dia cair em fim de semana ou feriado, a prestação vale no dia útil seguinte. Esta tela cria os caixas, escolhe o responsável e confere despesas e reposições. A reposição só é aprovada se a imagem do comprovante estiver salva. Se houver inconsistência, rejeite com o motivo: o responsável corrige e envia de novo. O responsável solicita a exclusão; a despesa e o comprovante só saem quando a conferência confirma. O painel avisa quando a prestação está perto do vencimento ou em atraso.';

type Props = {
  isActive?: boolean;
  panelHeight: number;
  minimal?: boolean;
};

const STATUS_LABEL: Record<PettyCashMovement['status_aprovacao'], string> = {
  pendente: 'Pendente',
  aprovado: 'Aprovado',
  rejeitado: 'Rejeitado',
};

export function MaintenancePettyCashCard({ isActive = true, panelHeight, minimal = false }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingBoxId, setDeletingBoxId] = useState<string | null>(null);
  const [canUpdate, setCanUpdate] = useState(false);
  const [boxes, setBoxes] = useState<PettyCashBox[]>([]);
  const [people, setPeople] = useState<PettyCashResponsible[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [movements, setMovements] = useState<PettyCashMovement[]>([]);
  const [loadingMovements, setLoadingMovements] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nome, setNome] = useState('');
  const [responsavelId, setResponsavelId] = useState('');
  const [status, setStatus] = useState<PettyCashStatus>('ativo');
  const [valorBase, setValorBase] = useState('1000');
  const [diaFechamento, setDiaFechamento] = useState('25');
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const [list, responsibles, updateAllowed] = await Promise.all([
        fetchPettyCashMaintenanceList(),
        fetchPettyCashResponsibles(),
        sessionHasAccess('screen', PETTY_CASH_MAINTENANCE_SCREEN, 'update'),
      ]);
      setBoxes(list.caixas);
      setPeople(responsibles);
      setCanUpdate(updateAllowed);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Não foi possível carregar os caixas.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMovements = useCallback(async (caixaId: string) => {
    setLoadingMovements(true);

    try {
      setMovements(await fetchPettyCashMovements(caixaId));
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Pequenos caixas',
        text2: error instanceof Error ? error.message : 'Não foi possível carregar o histórico.',
      });
      setMovements([]);
    } finally {
      setLoadingMovements(false);
    }
  }, []);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    void load();
  }, [isActive, load]);

  const resetForm = () => {
    setEditingId(null);
    setNome('');
    setResponsavelId('');
    setStatus('ativo');
    setValorBase('1000');
    setDiaFechamento('25');
  };

  const handleSave = async () => {
    if (!canUpdate) {
      return;
    }

    const base = parsePettyCashAmount(valorBase);
    const day = Number(diaFechamento);

    if (base == null || base <= 0) {
      Toast.show({ type: 'error', text1: 'Informe o valor-base do caixa.' });
      return;
    }

    if (!Number.isInteger(day) || day < 1 || day > 31) {
      Toast.show({ type: 'error', text1: 'O dia de fechamento precisa estar entre 1 e 31.' });
      return;
    }

    setSaving(true);

    try {
      await savePettyCashBox({
        id: editingId,
        nome,
        responsavelId,
        status,
        valorBase: base,
        diaFechamento: day,
      });
      resetForm();
      await load();
      Toast.show({ type: 'success', text1: 'Pequeno caixa salvo' });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Pequenos caixas',
        text2: error instanceof Error ? error.message : 'Não foi possível salvar.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBox = async (box: PettyCashBox) => {
    if (!canUpdate || deletingBoxId) {
      return;
    }

    const confirmed = await confirmDialog(
      'Excluir caixa',
      `Excluir o controle ${box.nome_caixa}? Os lançamentos e os comprovantes deste caixa também saem.`,
      'Excluir',
      'Cancelar',
      { destructive: true }
    );

    if (!confirmed) {
      return;
    }

    setDeletingBoxId(box.id);

    try {
      const paths = await deletePettyCashBox(box.id);

      for (const path of paths) {
        try {
          await removePettyCashReceipt(path);
        } catch {
          Toast.show({
            type: 'error',
            text1: 'Pequenos caixas',
            text2: 'O caixa saiu, mas um comprovante não pôde ser apagado.',
          });
        }
      }

      if (editingId === box.id) {
        resetForm();
      }

      if (selectedId === box.id) {
        setSelectedId(null);
        setMovements([]);
      }

      await load();
      Toast.show({ type: 'success', text1: 'Caixa excluído' });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Pequenos caixas',
        text2: error instanceof Error ? error.message : 'Não foi possível excluir o caixa.',
      });
    } finally {
      setDeletingBoxId(null);
    }
  };

  const handleDecide = async (movement: PettyCashMovement, decisao: 'aprovado' | 'rejeitado') => {
    const motivo = rejectReason[movement.id]?.trim() ?? '';

    if (decisao === 'rejeitado' && motivo.length < 3) {
      Toast.show({
        type: 'error',
        text1: 'Informe o motivo da rejeição para o responsável corrigir e reenviar.',
      });
      return;
    }

    const confirmed = await confirmDialog(
      decisao === 'aprovado' ? 'Aprovar movimentação' : 'Rejeitar movimentação',
      decisao === 'aprovado'
        ? 'A despesa aprovada reduz o saldo. A reposição aprovada só conclui com a imagem do comprovante e devolve o caixa ao valor-base.'
        : 'A rejeição fica no histórico, com o motivo, para o responsável corrigir e enviar de novo.',
      decisao === 'aprovado' ? 'Aprovar' : 'Rejeitar',
      'Cancelar',
      { destructive: decisao === 'rejeitado' }
    );

    if (!confirmed || !selectedId) {
      return;
    }

    try {
      await decidePettyCashMovement(movement.id, decisao, motivo);
      await Promise.all([load(), loadMovements(selectedId)]);
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Pequenos caixas',
        text2: error instanceof Error ? error.message : 'Não foi possível conferir.',
      });
    }
  };

  const handleOpenReceipt = async (path: string) => {
    try {
      const url = await openPettyCashReceipt(path);
      await Linking.openURL(url);
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Comprovante',
        text2: error instanceof Error ? error.message : 'Não foi possível abrir a imagem.',
      });
    }
  };

  return (
    <ScrollView style={{ maxHeight: panelHeight }} contentContainerStyle={styles.content}>
      <MaintenanceHelpInfoTitle
        title="Pequenos caixas"
        helpText={HELP_TEXT}
        minimal={minimal}
        accessibilityLabel="Como usar: Pequenos caixas"
      />
      {boxes.flatMap((box) => pettyCashAlertLines(box)).map((alert) => (
        <Text
          key={alert.text}
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

      {loading ? <ActivityIndicator color={MAINTENANCE_VIGILANCE_UI.accent} /> : null}
      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

      {canUpdate ? (
        <View style={styles.form}>
          <Text style={styles.formTitle}>{editingId ? 'Alterar caixa' : 'Novo caixa'}</Text>
          <TextInput
            value={nome}
            onChangeText={setNome}
            placeholder="Nome do caixa"
            placeholderTextColor="#94A3B8"
            style={styles.input}
          />
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Valor-base</Text>
            <TextInput
              value={valorBase}
              onChangeText={setValorBase}
              placeholder="1000,00"
              keyboardType="decimal-pad"
              placeholderTextColor="#94A3B8"
              style={styles.input}
              accessibilityLabel="Valor-base"
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Dia de fechamento</Text>
            <TextInput
              value={diaFechamento}
              onChangeText={(value) => setDiaFechamento(value.replace(/\D/g, '').slice(0, 2))}
              placeholder="1 a 31"
              keyboardType="number-pad"
              placeholderTextColor="#94A3B8"
              style={styles.input}
              accessibilityLabel="Dia de fechamento"
            />
          </View>
          <DropdownSelect
            searchable
            enxergar
            variant="vigilance"
            options={people.map((person) => ({ value: person.id, label: person.nome }))}
            selectedValue={responsavelId}
            onValueChange={setResponsavelId}
            placeholder="Responsável"
            searchPlaceholder="Buscar responsável"
            modalTitle="Responsável do caixa"
          />
          <View style={styles.statusRow}>
            {(['ativo', 'inativo'] as const).map((item) => (
              <TouchableOpacity
                key={item}
                style={[styles.statusChip, status === item && styles.statusChipOn]}
                onPress={() => setStatus(item)}
              >
                <Text style={[styles.statusChipText, status === item && styles.statusChipTextOn]}>
                  {item === 'ativo' ? 'Ativo' : 'Inativo'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.formActions}>
            <TouchableOpacity style={styles.primaryButton} onPress={() => void handleSave()} disabled={saving}>
              <Text style={styles.primaryButtonText}>{saving ? 'Salvando…' : 'Salvar caixa'}</Text>
            </TouchableOpacity>
            {editingId ? (
              <TouchableOpacity onPress={resetForm}>
                <Text style={styles.link}>Cancelar edição</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      ) : null}

      {boxes.map((box) => {
        const open = selectedId === box.id;

        return (
          <View key={box.id} style={styles.card}>
            <TouchableOpacity
              onPress={() => {
                if (open) {
                  setSelectedId(null);
                  setMovements([]);
                  return;
                }

                setSelectedId(box.id);
                void loadMovements(box.id);
              }}
            >
              <Text style={styles.cardTitle}>{box.nome_caixa}</Text>
              <Text style={styles.cardLine}>Responsável: {box.responsavel_nome || '—'}</Text>
              <Text style={styles.cardLine}>
                Base {formatPettyCashBrl(box.valor_base)} · fecha dia {box.dia_fechamento} · saldo{' '}
                {formatPettyCashBrl(box.saldo_atual)}
              </Text>
              <Text style={styles.cardLine}>
                {box.status === 'ativo' ? 'Ativo' : 'Inativo'}
                {box.prestacao_atrasada ? ' · Prestação em atraso' : ''}
                {box.despesas_pendentes > 0 ? ` · ${box.despesas_pendentes} despesa(s) pendente(s)` : ''}
                {box.exclusoesSolicitadas.length > 0
                  ? ` · ${box.exclusoesSolicitadas.length} exclusão(ões) solicitada(s)`
                  : ''}
              </Text>
            </TouchableOpacity>
            {box.exclusoesSolicitadas.map((request) => (
              <PettyCashDeletionEditor
                key={request.id}
                request={request}
                onChanged={async () => {
                  await load();
                  if (selectedId === box.id) {
                    await loadMovements(box.id);
                  }
                }}
              />
            ))}

            {canUpdate ? (
              <View style={styles.formActions}>
                <TouchableOpacity
                  onPress={() => {
                    setEditingId(box.id);
                    setNome(box.nome_caixa);
                    setResponsavelId(box.responsavel_id);
                    setStatus(box.status);
                    setValorBase(String(box.valor_base).replace('.', ','));
                    setDiaFechamento(String(box.dia_fechamento));
                  }}
                >
                  <Text style={styles.link}>Editar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  disabled={deletingBoxId === box.id}
                  onPress={() => void handleDeleteBox(box)}
                  accessibilityRole="button"
                  accessibilityLabel={`Excluir o caixa ${box.nome_caixa}`}
                >
                  <Text style={styles.danger}>
                    {deletingBoxId === box.id ? 'Excluindo…' : 'Excluir caixa'}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {open ? (
              <View style={styles.statement}>
                <Text style={styles.cardLine}>Saldo inicial {formatPettyCashBrl(box.saldo_inicial)}</Text>
                <Text style={styles.cardLine}>
                  Despesas comprovadas {formatPettyCashBrl(box.total_despesas)}
                </Text>
                <Text style={styles.cardLine}>
                  Saldo remanescente {formatPettyCashBrl(box.saldo_remanescente)}
                </Text>
                <Text style={styles.cardLine}>
                  Fechamento dia {box.dia_fechamento} · prestação até{' '}
                  {box.prazo ? formatPettyCashDate(box.prazo) : '—'} · recomposição{' '}
                  {formatPettyCashBrl(box.valor_recomposicao)}
                </Text>
                {loadingMovements ? <ActivityIndicator color={MAINTENANCE_VIGILANCE_UI.accent} /> : null}
                {movements.map((movement) => (
                  <View key={movement.id} style={styles.movement}>
                    <Text style={styles.cardLine}>
                      {movement.tipo === 'despesa' ? 'Despesa' : 'Reposição'} ·{' '}
                      {formatPettyCashBrl(movement.valor)} · {STATUS_LABEL[movement.status_aprovacao]}
                    </Text>
                    <Text style={styles.cardLine}>
                      {formatPettyCashDate(movement.data_movimento)} · {movement.descricao}
                    </Text>
                    {movement.motivo_decisao ? (
                      <Text style={styles.cardLine}>Motivo: {movement.motivo_decisao}</Text>
                    ) : null}
                    <TouchableOpacity onPress={() => void handleOpenReceipt(movement.comprovante_url)}>
                      <Text style={styles.link}>Ver comprovante</Text>
                    </TouchableOpacity>
                    {canUpdate && movement.status_aprovacao === 'pendente' && !movement.exclusaoSolicitada ? (
                      <View style={styles.movement}>
                        <TextInput
                          value={rejectReason[movement.id] ?? ''}
                          onChangeText={(value) =>
                            setRejectReason((current) => ({ ...current, [movement.id]: value }))
                          }
                          placeholder="Motivo, se for rejeitar"
                          placeholderTextColor="#94A3B8"
                          style={styles.input}
                        />
                        <View style={styles.formActions}>
                          <TouchableOpacity onPress={() => void handleDecide(movement, 'aprovado')}>
                            <Text style={styles.link}>Aprovar</Text>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => void handleDecide(movement, 'rejeitado')}>
                            <Text style={styles.danger}>Rejeitar</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : null}
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        );
      })}

      {!loading && boxes.length === 0 ? (
        <Text style={styles.note}>Nenhum pequeno caixa cadastrado nesta igreja.</Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 12,
    paddingBottom: 24,
  },
  note: {
    color: MAINTENANCE_VIGILANCE_UI.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  alert: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    lineHeight: 18,
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
    fontSize: 13,
  },
  form: {
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: MAINTENANCE_VIGILANCE_UI.border,
    backgroundColor: MAINTENANCE_VIGILANCE_UI.surfaceMuted,
  },
  formTitle: {
    fontWeight: '800',
    color: MAINTENANCE_VIGILANCE_UI.accent,
  },
  field: {
    gap: 4,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  input: {
    borderWidth: 1,
    borderColor: MAINTENANCE_VIGILANCE_UI.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    color: '#0F172A',
  },
  statusRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statusChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: MAINTENANCE_VIGILANCE_UI.border,
    backgroundColor: '#FFFFFF',
  },
  statusChipOn: {
    backgroundColor: MAINTENANCE_VIGILANCE_UI.submitBg,
    borderColor: MAINTENANCE_VIGILANCE_UI.submitBg,
  },
  statusChipText: {
    color: MAINTENANCE_VIGILANCE_UI.accent,
    fontWeight: '700',
  },
  statusChipTextOn: {
    color: '#FFFFFF',
  },
  formActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  primaryButton: {
    backgroundColor: MAINTENANCE_VIGILANCE_UI.submitBg,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  card: {
    gap: 6,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: MAINTENANCE_VIGILANCE_UI.border,
    backgroundColor: '#FFFFFF',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  cardLine: {
    color: '#334155',
    fontSize: 13,
    lineHeight: 18,
  },
  link: {
    color: MAINTENANCE_VIGILANCE_UI.icon,
    fontWeight: '700',
  },
  danger: {
    color: '#B91C1C',
    fontWeight: '700',
  },
  statement: {
    gap: 4,
    marginTop: 4,
  },
  movement: {
    gap: 2,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
});

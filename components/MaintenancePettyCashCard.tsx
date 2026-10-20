import { DropdownSelect } from '@/components/ui/DropdownSelect';
import { MaintenanceHelpInfoTitle } from '@/components/ui/MaintenanceHelpInfoTitle';
import { confirmDialog } from '@/lib/confirmDialog';
import { sessionHasAccess } from '@/lib/accessControl';
import { MAINTENANCE_VIGILANCE_UI } from '@/lib/maintenanceVigilanceTheme';
import {
  decidePettyCashMovement,
  fetchPettyCashMaintenanceList,
  fetchPettyCashMovements,
  fetchPettyCashResponsibles,
  formatPettyCashBrl,
  formatPettyCashDate,
  openPettyCashReceipt,
  PETTY_CASH_MAINTENANCE_SCREEN,
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
  'Cada pequeno caixa tem valor-base fixo de R$ 1.000,00 e um responsável. Esta tela cria e mantém os caixas e confere as despesas e as reposições. Quem controla o caixa no Financeiro precisa ser o responsável e ter o papel Controle do pequeno caixa em Controle de Acesso. A prestação vence no dia 25, ou no dia útil seguinte quando essa data cai em fim de semana ou feriado. A reposição exige a imagem do comprovante e devolve o saldo a R$ 1.000,00. O histórico fica arquivado.';

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
  const [canUpdate, setCanUpdate] = useState(false);
  const [prazo, setPrazo] = useState('');
  const [boxes, setBoxes] = useState<PettyCashBox[]>([]);
  const [people, setPeople] = useState<PettyCashResponsible[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [movements, setMovements] = useState<PettyCashMovement[]>([]);
  const [loadingMovements, setLoadingMovements] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nome, setNome] = useState('');
  const [responsavelId, setResponsavelId] = useState('');
  const [status, setStatus] = useState<PettyCashStatus>('ativo');
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
      setPrazo(list.prazo);
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
  };

  const handleSave = async () => {
    if (!canUpdate) {
      return;
    }

    setSaving(true);

    try {
      await savePettyCashBox({
        id: editingId,
        nome,
        responsavelId,
        status,
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

  const handleDecide = async (movement: PettyCashMovement, decisao: 'aprovado' | 'rejeitado') => {
    const confirmed = await confirmDialog(
      decisao === 'aprovado' ? 'Aprovar movimentação' : 'Rejeitar movimentação',
      decisao === 'aprovado'
        ? 'A despesa aprovada reduz o saldo. A reposição aprovada devolve o caixa a R$ 1.000,00.'
        : 'A movimentação rejeitada permanece no histórico e não altera o saldo.',
      decisao === 'aprovado' ? 'Aprovar' : 'Rejeitar',
      'Cancelar',
      { destructive: decisao === 'rejeitado' }
    );

    if (!confirmed || !selectedId) {
      return;
    }

    try {
      await decidePettyCashMovement(movement.id, decisao);
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
      <Text style={styles.note}>
        Valor-base de cada caixa: {formatPettyCashBrl(1000)}. Prestação até{' '}
        {prazo ? formatPettyCashDate(prazo) : '—'}.
      </Text>

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
                Saldo {formatPettyCashBrl(box.saldo_atual)} · Recomposição{' '}
                {formatPettyCashBrl(box.valor_recomposicao)}
              </Text>
              <Text style={styles.cardLine}>
                {box.status === 'ativo' ? 'Ativo' : 'Inativo'}
                {box.prestacao_atrasada ? ' · Prestação em atraso' : ''}
                {box.despesas_pendentes > 0 ? ` · ${box.despesas_pendentes} despesa(s) pendente(s)` : ''}
              </Text>
            </TouchableOpacity>

            {canUpdate ? (
              <TouchableOpacity
                onPress={() => {
                  setEditingId(box.id);
                  setNome(box.nome_caixa);
                  setResponsavelId(box.responsavel_id);
                  setStatus(box.status);
                }}
              >
                <Text style={styles.link}>Editar</Text>
              </TouchableOpacity>
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
                  Prestação até {box.prazo ? formatPettyCashDate(box.prazo) : '—'}
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
                    <TouchableOpacity onPress={() => void handleOpenReceipt(movement.comprovante_url)}>
                      <Text style={styles.link}>Ver comprovante</Text>
                    </TouchableOpacity>
                    {canUpdate && movement.status_aprovacao === 'pendente' ? (
                      <View style={styles.formActions}>
                        <TouchableOpacity onPress={() => void handleDecide(movement, 'aprovado')}>
                          <Text style={styles.link}>Aprovar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => void handleDecide(movement, 'rejeitado')}>
                          <Text style={styles.danger}>Rejeitar</Text>
                        </TouchableOpacity>
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

import {
  deleteAliancaPartnerLead,
  listAliancaPartnerLeadMovements,
  listAliancaPartnerLeads,
  setAliancaPartnerLeadStage,
  updateAliancaPartnerLead,
} from '@/lib/alianca/aliancaApi';
import {
  ALIANCA_PARTNER_LEAD_PRIORITIES,
  ALIANCA_PARTNER_LEAD_STAGES,
  aliancaPartnerLeadAdjacentStage,
  aliancaPartnerLeadCanMoveToStage,
  aliancaPartnerLeadIsLostDeal,
  aliancaPartnerLeadPriority,
  aliancaPartnerLeadStageByCode,
  aliancaPartnerLeadSubStage,
} from '@/lib/alianca/partnerLeadStages';
import type {
  AliancaPartnerLead,
  AliancaPartnerLeadMovement,
  AliancaPartnerLeadNotification,
} from '@/lib/alianca/types';
import { requestConfirmDialog } from '@/lib/confirmDialogHost';
import { formatPhoneDisplay } from '@/lib/familyRegistration';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';

function formatWhen(value: string | null, withTime = false) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}

function toDateInput(value: string | null) {
  if (!value) return '';
  return String(value).slice(0, 10);
}

function fromDateInput(value: string) {
  const raw = value.trim();
  if (!raw) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  return `${raw}T12:00:00.000Z`;
}

function stageLabel(code: string | null | undefined, subStage?: number | null) {
  const stage = aliancaPartnerLeadStageByCode(code);
  const sub = aliancaPartnerLeadSubStage(subStage, stage.code);
  const activity = stage.activities.find((item) => item.number === sub);
  return activity
    ? `${stage.number}.${sub} ${stage.label} — ${activity.title}`
    : `${stage.number} ${stage.label}`;
}

type Draft = {
  indicatedChurchName: string;
  city: string;
  uf: string;
  estimatedMembers: string;
  currentSystems: string;
  governanceNotes: string;
  tiNotes: string;
  priority: string;
  lastContactAt: string;
  nextActionAt: string;
  lostReason: string;
};

function draftFromLead(lead: AliancaPartnerLead): Draft {
  return {
    indicatedChurchName: lead.indicatedChurchName,
    city: lead.city,
    uf: lead.uf,
    estimatedMembers: lead.estimatedMembers == null ? '' : String(lead.estimatedMembers),
    currentSystems: lead.currentSystems,
    governanceNotes: lead.governanceNotes,
    tiNotes: lead.tiNotes,
    priority: aliancaPartnerLeadPriority(lead.priority),
    lastContactAt: toDateInput(lead.lastContactAt),
    nextActionAt: toDateInput(lead.nextActionAt),
    lostReason: lead.lostReason,
  };
}

export function AliancaIndicadosList() {
  const { width } = useWindowDimensions();
  const columnWidth = Math.max(240, Math.min(300, Math.round(width * 0.78)));
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [leads, setLeads] = useState<AliancaPartnerLead[]>([]);
  const [notifications, setNotifications] = useState<AliancaPartnerLeadNotification[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [selected, setSelected] = useState<AliancaPartnerLead | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [movements, setMovements] = useState<AliancaPartnerLeadMovement[]>([]);
  const [savingDetail, setSavingDetail] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listAliancaPartnerLeads();
      setLeads(result.leads);
      setNotifications(result.notifications);
      setMessage(result.success ? null : result.message || 'Não foi possível carregar.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const grouped = useMemo(() => {
    const map = new Map<string, AliancaPartnerLead[]>();
    for (const stage of ALIANCA_PARTNER_LEAD_STAGES) {
      map.set(stage.code, []);
    }
    for (const lead of leads) {
      const code = aliancaPartnerLeadStageByCode(lead.stage).code;
      map.get(code)?.push(lead);
    }
    return map;
  }, [leads]);

  const handleProgress = async (lead: AliancaPartnerLead, stage: string, subStage: number) => {
    const nextSub = aliancaPartnerLeadSubStage(subStage, stage);
    if (!aliancaPartnerLeadCanMoveToStage(lead.stage, lead.subStage, stage)) {
      Toast.show({
        type: 'error',
        text1: 'Funil sequencial',
        text2: 'Avance ou recue uma etapa por vez.',
      });
      return;
    }
    if (lead.stage === stage && aliancaPartnerLeadSubStage(lead.subStage, lead.stage) === nextSub) {
      return;
    }
    setBusyId(lead.id);
    try {
      const result = await setAliancaPartnerLeadStage(lead.id, stage, nextSub);
      Toast.show({
        type: result.success ? 'success' : 'error',
        text1: result.success ? 'Funil Kanban' : 'Etapa',
        text2: result.message,
      });
      if (result.success) {
        await load();
        setSelected((current) =>
          current?.id === lead.id
            ? { ...current, stage, subStage: nextSub }
            : current
        );
      }
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (lead: AliancaPartnerLead) => {
    const confirmed = await requestConfirmDialog({
      title: 'Excluir indicado',
      message: `Excluir ${lead.indicatedName} da lista de indicados? Esta ação não pode ser desfeita.`,
      confirmLabel: 'Excluir',
      cancelLabel: 'Cancelar',
      destructive: true,
    });

    if (!confirmed) {
      return;
    }

    setBusyId(lead.id);
    try {
      const result = await deleteAliancaPartnerLead(lead.id);
      Toast.show({
        type: result.success ? 'success' : 'error',
        text1: 'Indicados',
        text2: result.message,
      });
      if (result.success) {
        setLeads((current) => current.filter((item) => item.id !== lead.id));
        setSelected(null);
        setDraft(null);
      }
    } finally {
      setBusyId(null);
    }
  };

  const openDetail = async (lead: AliancaPartnerLead) => {
    setSelected(lead);
    setDraft(draftFromLead(lead));
    const history = await listAliancaPartnerLeadMovements(lead.id);
    setMovements(history.movements);
  };

  const saveDetail = async () => {
    if (!selected || !draft) return;
    const membersRaw = draft.estimatedMembers.replace(/\D/g, '');
    setSavingDetail(true);
    try {
      const result = await updateAliancaPartnerLead({
        leadId: selected.id,
        indicatedChurchName: draft.indicatedChurchName,
        city: draft.city,
        uf: draft.uf,
        estimatedMembers: membersRaw ? Number(membersRaw) : null,
        currentSystems: draft.currentSystems,
        governanceNotes: draft.governanceNotes,
        tiNotes: draft.tiNotes,
        priority: aliancaPartnerLeadPriority(draft.priority),
        lastContactAt: fromDateInput(draft.lastContactAt),
        nextActionAt: fromDateInput(draft.nextActionAt),
        lostReason: draft.lostReason,
      });
      Toast.show({
        type: result.success ? 'success' : 'error',
        text1: 'Governança e TI',
        text2: result.message,
      });
      if (result.success) {
        await load();
        if (result.lead) {
          setSelected(result.lead);
          setDraft(draftFromLead(result.lead));
        }
      }
    } finally {
      setSavingDetail(false);
    }
  };

  if (loading) {
    return <ActivityIndicator color={MINIMAL_UI.accent} style={styles.loader} />;
  }

  if (message) {
    return <Text style={styles.empty}>{message}</Text>;
  }

  if (leads.length === 0) {
    return (
      <Text style={styles.empty}>
        Nenhum indicado ainda. As indicações feitas em Aliança Conecta Reino entram na primeira
        coluna do funil.
      </Text>
    );
  }

  return (
    <View style={styles.root}>
      {notifications.length > 0 ? (
        <View style={styles.notifyBox}>
          <Text style={styles.notifyTitle}>Automações da fase</Text>
          {notifications.slice(0, 3).map((item) => (
            <Text key={item.id} style={styles.notifyBody}>
              {item.title}: {item.body}
            </Text>
          ))}
        </View>
      ) : null}

      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator
        contentContainerStyle={styles.board}
      >
        {ALIANCA_PARTNER_LEAD_STAGES.map((stage) => {
          const cards = grouped.get(stage.code) ?? [];
          return (
            <View key={stage.code} style={[styles.column, { width: columnWidth }]}>
              <View style={styles.columnHeader}>
                <Text style={styles.columnNum}>{stage.number}</Text>
                <View style={styles.stageCopy}>
                  <Text style={styles.columnTitle}>{stage.label}</Text>
                  <Text style={styles.columnSub}>{stage.subtitle}</Text>
                </View>
                <Text style={styles.columnCount}>{cards.length}</Text>
              </View>

              <ScrollView
                nestedScrollEnabled
                style={styles.columnBody}
                contentContainerStyle={styles.columnBodyContent}
              >
                {cards.length === 0 ? (
                  <Text style={styles.columnEmpty}>Sem cards nesta etapa.</Text>
                ) : (
                  cards.map((lead) => {
                    const currentSub = aliancaPartnerLeadSubStage(lead.subStage, lead.stage);
                    const activity = stage.activities.find((item) => item.number === currentSub);
                    const prev = aliancaPartnerLeadAdjacentStage(lead.stage, -1);
                    const next = aliancaPartnerLeadAdjacentStage(lead.stage, 1);
                    const canPrev = Boolean(
                      prev && aliancaPartnerLeadCanMoveToStage(lead.stage, lead.subStage, prev.code)
                    );
                    const canNext = Boolean(
                      next && aliancaPartnerLeadCanMoveToStage(lead.stage, lead.subStage, next.code)
                    );
                    const lost = aliancaPartnerLeadIsLostDeal(lead.stage, currentSub);
                    const priority = aliancaPartnerLeadPriority(lead.priority);
                    return (
                      <Pressable
                        key={lead.id}
                        onPress={() => void openDetail(lead)}
                        disabled={busyId === lead.id}
                        accessibilityRole="button"
                        accessibilityLabel={`Abrir card de ${lead.indicatedName}`}
                        style={[styles.card, lost && styles.cardLost]}
                      >
                        <View style={styles.cardHeader}>
                          <Text style={styles.name}>{lead.indicatedName}</Text>
                          <Text
                            style={[
                              styles.priority,
                              priority === 'alta' && styles.priorityHigh,
                              priority === 'baixa' && styles.priorityLow,
                            ]}
                          >
                            {priority}
                          </Text>
                        </View>
                        <Text style={styles.meta}>{lead.indicatedRole || '—'}</Text>
                        <Text style={styles.meta}>
                          {[lead.indicatedChurchName, lead.city, lead.uf].filter(Boolean).join(' · ')
                            || 'Igreja não informada'}
                        </Text>
                        <Text style={styles.meta}>
                          {[lead.instanceCode, lead.instanceName].filter(Boolean).join(' · ') || '—'}
                        </Text>
                        <Text style={styles.activityNow}>
                          {stage.number}.{currentSub} {activity?.title ?? 'Atividade'}
                        </Text>
                        <View style={styles.cardActions}>
                          <Pressable
                            onPress={() => prev && void handleProgress(lead, prev.code, 1)}
                            disabled={!canPrev || busyId === lead.id}
                            accessibilityRole="button"
                            accessibilityLabel="Recuar uma etapa"
                            style={[styles.moveBtn, !canPrev && styles.moveBtnDisabled]}
                          >
                            <Text style={styles.moveBtnText}>←</Text>
                          </Pressable>
                          <Pressable
                            onPress={() => next && void handleProgress(lead, next.code, 1)}
                            disabled={!canNext || busyId === lead.id}
                            accessibilityRole="button"
                            accessibilityLabel="Avançar uma etapa"
                            style={[styles.moveBtn, !canNext && styles.moveBtnDisabled]}
                          >
                            <Text style={styles.moveBtnText}>→</Text>
                          </Pressable>
                        </View>
                      </Pressable>
                    );
                  })
                )}
              </ScrollView>
            </View>
          );
        })}
      </ScrollView>

      <Modal
        visible={selected != null}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setSelected(null);
          setDraft(null);
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            {selected && draft ? (
              <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
                <Text style={styles.modalTitle}>{selected.indicatedName}</Text>
                <Text style={styles.meta}>Posição: {selected.indicatedRole || '—'}</Text>
                <Text style={styles.meta}>Celular: {formatPhoneDisplay(selected.indicatedPhone)}</Text>
                <Text style={styles.meta}>Quem indicou: {selected.referrerName || '—'}</Text>
                <Text style={styles.meta}>
                  Instância:{' '}
                  {[selected.instanceCode, selected.instanceName].filter(Boolean).join(' · ') || '—'}
                </Text>
                <Text style={styles.stageNow}>{stageLabel(selected.stage, selected.subStage)}</Text>

                <View style={styles.activities}>
                  {aliancaPartnerLeadStageByCode(selected.stage).activities.map((item) => {
                    const currentSub = aliancaPartnerLeadSubStage(selected.subStage, selected.stage);
                    const active = item.number === currentSub;
                    const lost = aliancaPartnerLeadStageByCode(selected.stage).number === 5 && item.number === 4;
                    return (
                      <Pressable
                        key={`${selected.stage}-${item.number}`}
                        onPress={() =>
                          void handleProgress(selected, selected.stage, item.number)
                        }
                        disabled={busyId === selected.id}
                        style={[
                          styles.activity,
                          active && styles.activityActive,
                          lost && !active && styles.activityLost,
                          lost && active && styles.activityLostActive,
                        ]}
                      >
                        <Text style={[styles.activityCode, active && styles.activityCodeActive]}>
                          {aliancaPartnerLeadStageByCode(selected.stage).number}.{item.number}
                        </Text>
                        <Text style={[styles.activityTitle, active && styles.activityTitleActive]}>
                          {item.title}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Text style={styles.fieldLabel}>Prioridade</Text>
                <View style={styles.priorityRow}>
                  {ALIANCA_PARTNER_LEAD_PRIORITIES.map((item) => (
                    <Pressable
                      key={item.code}
                      onPress={() => setDraft({ ...draft, priority: item.code })}
                      style={[
                        styles.priorityChip,
                        draft.priority === item.code && styles.priorityChipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.priorityChipText,
                          draft.priority === item.code && styles.priorityChipTextActive,
                        ]}
                      >
                        {item.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={styles.fieldLabel}>Igreja indicada</Text>
                <TextInput
                  style={styles.input}
                  value={draft.indicatedChurchName}
                  onChangeText={(value) => setDraft({ ...draft, indicatedChurchName: value })}
                  placeholder="Nome da igreja / entidade"
                  placeholderTextColor={MINIMAL_UI.textMuted}
                />
                <View style={styles.row2}>
                  <View style={styles.flex}>
                    <Text style={styles.fieldLabel}>Cidade</Text>
                    <TextInput
                      style={styles.input}
                      value={draft.city}
                      onChangeText={(value) => setDraft({ ...draft, city: value })}
                    />
                  </View>
                  <View style={styles.ufBox}>
                    <Text style={styles.fieldLabel}>UF</Text>
                    <TextInput
                      style={styles.input}
                      value={draft.uf}
                      autoCapitalize="characters"
                      maxLength={2}
                      onChangeText={(value) => setDraft({ ...draft, uf: value.toUpperCase() })}
                    />
                  </View>
                </View>
                <Text style={styles.fieldLabel}>Membros estimados</Text>
                <TextInput
                  style={styles.input}
                  value={draft.estimatedMembers}
                  keyboardType="number-pad"
                  onChangeText={(value) => setDraft({ ...draft, estimatedMembers: value })}
                />
                <Text style={styles.fieldLabel}>Sistemas atuais (TI)</Text>
                <TextInput
                  style={[styles.input, styles.inputArea]}
                  multiline
                  value={draft.currentSystems}
                  onChangeText={(value) => setDraft({ ...draft, currentSystems: value })}
                  placeholder="Planilha, ERP, outro app..."
                  placeholderTextColor={MINIMAL_UI.textMuted}
                />
                <Text style={styles.fieldLabel}>Notas de governança</Text>
                <TextInput
                  style={[styles.input, styles.inputArea]}
                  multiline
                  value={draft.governanceNotes}
                  onChangeText={(value) => setDraft({ ...draft, governanceNotes: value })}
                />
                <Text style={styles.fieldLabel}>Notas de TI</Text>
                <TextInput
                  style={[styles.input, styles.inputArea]}
                  multiline
                  value={draft.tiNotes}
                  onChangeText={(value) => setDraft({ ...draft, tiNotes: value })}
                />
                <View style={styles.row2}>
                  <View style={styles.flex}>
                    <Text style={styles.fieldLabel}>Último contato (AAAA-MM-DD)</Text>
                    <TextInput
                      style={styles.input}
                      value={draft.lastContactAt}
                      onChangeText={(value) => setDraft({ ...draft, lastContactAt: value })}
                    />
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.fieldLabel}>Próxima ação (AAAA-MM-DD)</Text>
                    <TextInput
                      style={styles.input}
                      value={draft.nextActionAt}
                      onChangeText={(value) => setDraft({ ...draft, nextActionAt: value })}
                    />
                  </View>
                </View>
                {aliancaPartnerLeadIsLostDeal(selected.stage, selected.subStage) ? (
                  <>
                    <Text style={styles.fieldLabel}>Motivo do encerramento</Text>
                    <TextInput
                      style={[styles.input, styles.inputArea]}
                      multiline
                      value={draft.lostReason}
                      onChangeText={(value) => setDraft({ ...draft, lostReason: value })}
                    />
                  </>
                ) : null}

                <Pressable
                  onPress={() => void saveDetail()}
                  disabled={savingDetail}
                  style={[styles.saveBtn, savingDetail && styles.moveBtnDisabled]}
                >
                  <Text style={styles.saveBtnText}>
                    {savingDetail ? 'Salvando...' : 'Salvar governança e TI'}
                  </Text>
                </Pressable>

                <Text style={styles.historyTitle}>Histórico de movimentação</Text>
                {movements.length === 0 ? (
                  <Text style={styles.meta}>Sem movimentações registradas.</Text>
                ) : (
                  movements.map((item) => (
                    <Text key={item.id} style={styles.historyItem}>
                      {formatWhen(item.createdAt, true)} · {item.actorName}
                      {'\n'}
                      {item.fromStage
                        ? `${stageLabel(item.fromStage, item.fromSubStage)} → ${stageLabel(item.toStage, item.toSubStage)}`
                        : `Entrou em ${stageLabel(item.toStage, item.toSubStage)}`}
                    </Text>
                  ))
                )}

                <View style={styles.modalFooter}>
                  <Pressable
                    onPress={() => void handleDelete(selected)}
                    disabled={busyId === selected.id}
                    style={styles.deleteButton}
                  >
                    <Text style={styles.deleteButtonText}>Excluir</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setSelected(null);
                      setDraft(null);
                    }}
                    style={styles.closeBtn}
                  >
                    <Text style={styles.closeBtnText}>Fechar</Text>
                  </Pressable>
                </View>
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 420,
    gap: 8,
  },
  loader: {
    paddingVertical: 24,
  },
  empty: {
    color: MINIMAL_UI.textMuted,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  notifyBox: {
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    borderRadius: 10,
    padding: 10,
    gap: 4,
    backgroundColor: '#F8FAFC',
  },
  notifyTitle: {
    color: MINIMAL_UI.blueDark,
    fontSize: 12,
    fontWeight: '800',
  },
  notifyBody: {
    color: MINIMAL_UI.blue,
    fontSize: 12,
    lineHeight: 16,
  },
  board: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 10,
    alignItems: 'stretch',
  },
  column: {
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    minHeight: 360,
    maxHeight: 560,
  },
  columnHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: MINIMAL_UI.border,
  },
  columnNum: {
    minWidth: 18,
    color: MINIMAL_UI.accent,
    fontSize: 16,
    fontWeight: '800',
  },
  columnTitle: {
    color: MINIMAL_UI.blueDark,
    fontSize: 13,
    fontWeight: '800',
  },
  columnSub: {
    color: MINIMAL_UI.textMuted,
    fontSize: 11,
  },
  columnCount: {
    color: MINIMAL_UI.blue,
    fontSize: 12,
    fontWeight: '800',
  },
  columnBody: {
    flex: 1,
  },
  columnBodyContent: {
    padding: 8,
    gap: 8,
  },
  columnEmpty: {
    color: MINIMAL_UI.textMuted,
    fontSize: 12,
    padding: 8,
  },
  card: {
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    borderRadius: 10,
    padding: 10,
    gap: 3,
    backgroundColor: '#FFFFFF',
  },
  cardLost: {
    borderColor: '#B45309',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  name: {
    flex: 1,
    color: MINIMAL_UI.blueDark,
    fontSize: 14,
    fontWeight: '800',
  },
  priority: {
    textTransform: 'uppercase',
    color: MINIMAL_UI.accent,
    fontSize: 10,
    fontWeight: '800',
  },
  priorityHigh: {
    color: '#B91C1C',
  },
  priorityLow: {
    color: MINIMAL_UI.textMuted,
  },
  meta: {
    color: MINIMAL_UI.textMuted,
    fontSize: 12,
    lineHeight: 16,
  },
  activityNow: {
    color: MINIMAL_UI.blueDark,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 6,
  },
  moveBtn: {
    borderWidth: 1,
    borderColor: MINIMAL_UI.accent,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  moveBtnDisabled: {
    opacity: 0.4,
  },
  moveBtnText: {
    color: MINIMAL_UI.accent,
    fontWeight: '800',
  },
  stageCopy: {
    flex: 1,
    minWidth: 0,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    maxHeight: '92%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
  },
  modalBody: {
    gap: 6,
    paddingBottom: 24,
  },
  modalTitle: {
    color: MINIMAL_UI.blueDark,
    fontSize: 18,
    fontWeight: '800',
  },
  stageNow: {
    color: MINIMAL_UI.blueDark,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 8,
  },
  activities: {
    gap: 6,
    marginVertical: 8,
  },
  activity: {
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    borderRadius: 8,
    padding: 8,
    gap: 2,
  },
  activityActive: {
    backgroundColor: MINIMAL_UI.accent,
    borderColor: MINIMAL_UI.accent,
  },
  activityLost: {
    borderColor: '#B45309',
  },
  activityLostActive: {
    backgroundColor: '#B45309',
    borderColor: '#B45309',
  },
  activityCode: {
    color: MINIMAL_UI.blueDark,
    fontSize: 12,
    fontWeight: '800',
  },
  activityCodeActive: {
    color: '#FFFFFF',
  },
  activityTitle: {
    color: MINIMAL_UI.blueDark,
    fontSize: 12,
    fontWeight: '700',
  },
  activityTitleActive: {
    color: '#FFFFFF',
  },
  fieldLabel: {
    color: MINIMAL_UI.blueDark,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: MINIMAL_UI.blueDark,
    fontSize: 13,
  },
  inputArea: {
    minHeight: 64,
    textAlignVertical: 'top',
  },
  row2: {
    flexDirection: 'row',
    gap: 8,
  },
  flex: {
    flex: 1,
  },
  ufBox: {
    width: 72,
  },
  priorityRow: {
    flexDirection: 'row',
    gap: 8,
  },
  priorityChip: {
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  priorityChipActive: {
    backgroundColor: MINIMAL_UI.accent,
    borderColor: MINIMAL_UI.accent,
  },
  priorityChipText: {
    color: MINIMAL_UI.blueDark,
    fontSize: 12,
    fontWeight: '700',
  },
  priorityChipTextActive: {
    color: '#FFFFFF',
  },
  saveBtn: {
    marginTop: 10,
    backgroundColor: MINIMAL_UI.accent,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  historyTitle: {
    color: MINIMAL_UI.blueDark,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 16,
  },
  historyItem: {
    color: MINIMAL_UI.blue,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 6,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 16,
  },
  deleteButton: {
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  deleteButtonText: {
    color: MINIMAL_UI.blueDark,
    fontSize: 12,
    fontWeight: '700',
  },
  closeBtn: {
    backgroundColor: MINIMAL_UI.blueDark,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  closeBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
});

import { deleteAliancaPartnerLead, listAliancaPartnerLeads, setAliancaPartnerLeadStage } from '@/lib/alianca/aliancaApi';
import {
  ALIANCA_PARTNER_LEAD_STAGES,
  aliancaPartnerLeadStageByCode,
  aliancaPartnerLeadSubStage,
} from '@/lib/alianca/partnerLeadStages';
import type { AliancaPartnerLead } from '@/lib/alianca/types';
import { requestConfirmDialog } from '@/lib/confirmDialogHost';
import { formatPhoneDisplay } from '@/lib/familyRegistration';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';

function formatWhen(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function AliancaIndicadosList() {
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [leads, setLeads] = useState<AliancaPartnerLead[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listAliancaPartnerLeads();
      setLeads(result.leads);
      setMessage(result.success ? null : result.message || 'Não foi possível carregar.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleProgress = async (lead: AliancaPartnerLead, stage: string, subStage: number) => {
    const nextSub = aliancaPartnerLeadSubStage(subStage, stage);
    if (lead.stage === stage && aliancaPartnerLeadSubStage(lead.subStage, lead.stage) === nextSub) {
      return;
    }
    setBusyId(lead.id);
    try {
      const result = await setAliancaPartnerLeadStage(lead.id, stage, nextSub);
      Toast.show({
        type: result.success ? 'success' : 'error',
        text1: result.success ? 'Funil comercial' : 'Etapa',
        text2: result.message,
      });
      if (result.success) {
        setLeads((current) =>
          current.map((item) =>
            item.id === lead.id ? { ...item, stage, subStage: nextSub } : item
          )
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
      }
    } finally {
      setBusyId(null);
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
        Nenhum indicado ainda. As indicações feitas em Aliança Conecta Reino aparecem aqui.
      </Text>
    );
  }

  return (
    <View style={styles.list}>
      {leads.map((lead) => {
        const current = aliancaPartnerLeadStageByCode(lead.stage);
        const currentSub = aliancaPartnerLeadSubStage(lead.subStage, lead.stage);
        const instance = [lead.instanceCode, lead.instanceName].filter(Boolean).join(' · ');
        const currentActivity = current.activities.find((item) => item.number === currentSub);
        return (
          <View key={lead.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.name}>{lead.indicatedName}</Text>
              <Pressable
                onPress={() => void handleDelete(lead)}
                disabled={busyId === lead.id}
                accessibilityRole="button"
                accessibilityLabel={`Excluir indicado ${lead.indicatedName}`}
                style={({ pressed }) => [
                  styles.deleteButton,
                  busyId === lead.id && styles.deleteButtonDisabled,
                  pressed && styles.deleteButtonPressed,
                ]}
              >
                <Text style={styles.deleteButtonText}>
                  {busyId === lead.id ? 'Aguarde...' : 'Excluir'}
                </Text>
              </Pressable>
            </View>
            <Text style={styles.meta}>Posição: {lead.indicatedRole || '—'}</Text>
            <Text style={styles.meta}>Celular: {formatPhoneDisplay(lead.indicatedPhone)}</Text>
            <Text style={styles.meta}>Quem indicou: {lead.referrerName || '—'}</Text>
            <Text style={styles.meta}>Instância: {instance || '—'}</Text>
            <Text style={styles.meta}>Indicada em {formatWhen(lead.createdAt)}</Text>

            <Text style={styles.stageNow}>
              Etapa atual: {current.number}.{currentSub} {current.label}
              {currentActivity ? ` — ${currentActivity.title}` : ''}
            </Text>

            <View style={styles.stages}>
              {ALIANCA_PARTNER_LEAD_STAGES.map((stage) => {
                const active = stage.code === current.code;
                return (
                  <View
                    key={stage.code}
                    style={[styles.stageBlock, active && styles.stageBlockActive]}
                  >
                    <Pressable
                      onPress={() => void handleProgress(lead, stage.code, active ? currentSub : 1)}
                      disabled={busyId === lead.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Definir etapa ${stage.number} ${stage.label}`}
                      style={styles.stageHeader}
                    >
                      <Text style={[styles.stageNum, active && styles.stageNumActive]}>
                        {stage.number}
                      </Text>
                      <View style={styles.stageCopy}>
                        <Text style={[styles.stageLabel, active && styles.stageLabelActive]}>
                          {stage.label}
                        </Text>
                        <Text style={[styles.stageSub, active && styles.stageSubActive]}>
                          {stage.subtitle}
                        </Text>
                      </View>
                    </Pressable>

                    {active ? (
                      <View style={styles.details}>
                        <Text style={styles.stageHelp}>{stage.description}</Text>
                        {stage.activities.map((item) => {
                          const itemActive = item.number === currentSub;
                          const code = `${stage.number}.${item.number}`;
                          const isLostDeal = stage.number === 5 && item.number === 4;
                          return (
                            <Pressable
                              key={code}
                              onPress={() => void handleProgress(lead, stage.code, item.number)}
                              disabled={busyId === lead.id}
                              accessibilityRole="button"
                              accessibilityLabel={`Definir atividade ${code} ${item.title}`}
                              style={[
                                styles.activity,
                                itemActive && styles.activityActive,
                                isLostDeal && !itemActive && styles.activityLost,
                                isLostDeal && itemActive && styles.activityLostActive,
                              ]}
                            >
                              <Text
                                style={[styles.activityCode, itemActive && styles.activityCodeActive]}
                              >
                                {code}
                              </Text>
                              <View style={styles.stageCopy}>
                                <Text
                                  style={[
                                    styles.activityTitle,
                                    itemActive && styles.activityTitleActive,
                                  ]}
                                >
                                  {item.title}
                                </Text>
                                <Text
                                  style={[
                                    styles.activityText,
                                    itemActive && styles.activityTextActive,
                                  ]}
                                >
                                  Atividade: {item.activity}
                                </Text>
                              </View>
                            </Pressable>
                          );
                        })}
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
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
  list: {
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  card: {
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    borderRadius: 12,
    padding: 12,
    gap: 4,
    backgroundColor: '#FFFFFF',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  name: {
    flex: 1,
    minWidth: 0,
    color: MINIMAL_UI.blueDark,
    fontSize: 16,
    fontWeight: '800',
  },
  deleteButton: {
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  deleteButtonPressed: {
    opacity: 0.7,
  },
  deleteButtonDisabled: {
    opacity: 0.5,
  },
  deleteButtonText: {
    color: MINIMAL_UI.blueDark,
    fontSize: 12,
    fontWeight: '700',
  },
  meta: {
    color: MINIMAL_UI.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  stageNow: {
    color: MINIMAL_UI.blueDark,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 8,
    marginBottom: 4,
    lineHeight: 18,
  },
  stages: {
    gap: 8,
  },
  stageBlock: {
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    borderRadius: 10,
    overflow: 'hidden',
  },
  stageBlockActive: {
    borderColor: MINIMAL_UI.accent,
  },
  stageHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  stageNum: {
    minWidth: 18,
    color: MINIMAL_UI.blueDark,
    fontSize: 14,
    fontWeight: '800',
  },
  stageNumActive: {
    color: MINIMAL_UI.accent,
  },
  stageCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  stageLabel: {
    color: MINIMAL_UI.blueDark,
    fontSize: 13,
    fontWeight: '700',
  },
  stageLabelActive: {
    color: MINIMAL_UI.accent,
  },
  stageSub: {
    color: MINIMAL_UI.textMuted,
    fontSize: 11,
  },
  stageSubActive: {
    color: MINIMAL_UI.blue,
  },
  details: {
    paddingHorizontal: 10,
    paddingBottom: 10,
    gap: 8,
  },
  stageHelp: {
    color: MINIMAL_UI.blue,
    fontSize: 12,
    lineHeight: 18,
  },
  activity: {
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    borderRadius: 8,
    padding: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FFFFFF',
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
    minWidth: 24,
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
    lineHeight: 16,
  },
  activityTitleActive: {
    color: '#FFFFFF',
  },
  activityText: {
    color: MINIMAL_UI.textMuted,
    fontSize: 12,
    lineHeight: 16,
  },
  activityTextActive: {
    color: '#DBEAFE',
  },
});

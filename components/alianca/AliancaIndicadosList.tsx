import { listAliancaPartnerLeads, setAliancaPartnerLeadStage } from '@/lib/alianca/aliancaApi';
import {
  ALIANCA_PARTNER_LEAD_STAGES,
  aliancaPartnerLeadStageByCode,
} from '@/lib/alianca/partnerLeadStages';
import type { AliancaPartnerLead } from '@/lib/alianca/types';
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

  const handleStage = async (lead: AliancaPartnerLead, stage: string) => {
    if (lead.stage === stage) return;
    setBusyId(lead.id);
    try {
      const result = await setAliancaPartnerLeadStage(lead.id, stage);
      Toast.show({
        type: result.success ? 'success' : 'error',
        text1: result.success ? 'Funil comercial' : 'Etapa',
        text2: result.message,
      });
      if (result.success) {
        setLeads((current) =>
          current.map((item) => (item.id === lead.id ? { ...item, stage } : item))
        );
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
        const instance = [lead.instanceCode, lead.instanceName].filter(Boolean).join(' · ');
        return (
          <View key={lead.id} style={styles.card}>
            <Text style={styles.name}>{lead.indicatedName}</Text>
            <Text style={styles.meta}>Posição: {lead.indicatedRole || '—'}</Text>
            <Text style={styles.meta}>Celular: {formatPhoneDisplay(lead.indicatedPhone)}</Text>
            <Text style={styles.meta}>Quem indicou: {lead.referrerName || '—'}</Text>
            <Text style={styles.meta}>Instância: {instance || '—'}</Text>
            <Text style={styles.meta}>Indicada em {formatWhen(lead.createdAt)}</Text>

            <Text style={styles.stageNow}>
              Etapa atual: {current.number}. {current.label}
            </Text>
            <Text style={styles.stageHelp}>{current.description}</Text>

            <View style={styles.stages}>
              {ALIANCA_PARTNER_LEAD_STAGES.map((stage) => {
                const active = stage.code === lead.stage;
                return (
                  <Pressable
                    key={stage.code}
                    onPress={() => void handleStage(lead, stage.code)}
                    disabled={busyId === lead.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Definir etapa ${stage.number} ${stage.label}`}
                    style={[styles.stageChip, active && styles.stageChipActive]}
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
  name: {
    color: MINIMAL_UI.blueDark,
    fontSize: 16,
    fontWeight: '800',
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
  },
  stageHelp: {
    color: MINIMAL_UI.blue,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 6,
  },
  stages: {
    gap: 6,
  },
  stageChip: {
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  stageChipActive: {
    backgroundColor: MINIMAL_UI.accent,
    borderColor: MINIMAL_UI.accent,
  },
  stageNum: {
    minWidth: 18,
    color: MINIMAL_UI.blueDark,
    fontSize: 14,
    fontWeight: '800',
  },
  stageNumActive: {
    color: '#FFFFFF',
  },
  stageCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  stageLabel: {
    color: MINIMAL_UI.blueDark,
    fontSize: 13,
    fontWeight: '700',
  },
  stageLabelActive: {
    color: '#FFFFFF',
  },
  stageSub: {
    color: MINIMAL_UI.textMuted,
    fontSize: 11,
  },
  stageSubActive: {
    color: '#DBEAFE',
  },
});

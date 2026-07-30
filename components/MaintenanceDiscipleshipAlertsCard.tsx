import { CardLoadingState } from '@/components/ui/CardLoadingState';
import {
  acknowledgeDiscipleshipPastoralAlert,
  DISCIPLESHIP_TRAIL_SQL_HINT,
  fetchDiscipleshipPastoralAlerts,
  type DiscipleshipPastoralAlert,
} from '@/lib/discipleshipTrail';
import { formatShortName } from '@/lib/formatShortName';
import {
  computeMaintenanceContentHeight,
  maintenancePanelStyles,
} from '@/lib/maintenanceCardStyles';
import { MINIMAL_SECTION_TITLE, MINIMAL_UI } from '@/lib/minimalUiTheme';
import { FontAwesome } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';

type Props = {
  isActive?: boolean;
  panelHeight: number;
  minimal?: boolean;
};

export function MaintenanceDiscipleshipAlertsCard({
  isActive = true,
  panelHeight,
  minimal = false,
}: Props) {
  const [alerts, setAlerts] = useState<DiscipleshipPastoralAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ackId, setAckId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const loadAlerts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchDiscipleshipPastoralAlerts({
        status: showAll ? 'all' : 'new',
      });
      setAlerts(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar alertas.');
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  }, [showAll]);

  useEffect(() => {
    if (!isActive) {
      return;
    }
    void loadAlerts();
  }, [isActive, loadAlerts]);

  const handleAcknowledge = async (alertId: string) => {
    setAckId(alertId);
    try {
      await acknowledgeDiscipleshipPastoralAlert(alertId);
      Toast.show({
        type: 'success',
        text1: 'Alerta reconhecido',
        text2: 'Registro marcado para acompanhamento do certificado.',
      });
      await loadAlerts();
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Não foi possível reconhecer',
        text2: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setAckId(null);
    }
  };

  const contentHeight = computeMaintenanceContentHeight(panelHeight);

  return (
    <View style={[maintenancePanelStyles.panel, { height: contentHeight }]}>
      <Text style={minimal ? styles.titleMinimal : styles.title}>
        Trilha — Reconhecimentos
      </Text>
      <Text style={styles.subtitle}>
        Alunos que concluíram 100% da Trilha e estão prontos para certificado ou reconhecimento
        público.
      </Text>

      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterChip, !showAll && styles.filterChipActive]}
          onPress={() => setShowAll(false)}
          activeOpacity={0.85}
        >
          <Text style={[styles.filterChipText, !showAll && styles.filterChipTextActive]}>
            Novos
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, showAll && styles.filterChipActive]}
          onPress={() => setShowAll(true)}
          activeOpacity={0.85}
        >
          <Text style={[styles.filterChipText, showAll && styles.filterChipTextActive]}>
            Todos
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.refreshBtn} onPress={() => void loadAlerts()} activeOpacity={0.85}>
          <FontAwesome name="refresh" size={13} color={MINIMAL_UI.blueDark} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <CardLoadingState minimal={minimal} />
      ) : error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          {error.includes('discipleship') || error.includes('Execute') ? (
            <Text style={styles.hint}>{DISCIPLESHIP_TRAIL_SQL_HINT}</Text>
          ) : null}
        </View>
      ) : (
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {alerts.length === 0 ? (
            <Text style={styles.empty}>Nenhum alerta neste filtro.</Text>
          ) : (
            alerts.map((alert) => (
              <View key={alert.id} style={styles.alertCard}>
                <View style={styles.alertHeader}>
                  <FontAwesome name="trophy" size={14} color="#D97706" />
                  <Text style={styles.alertName}>
                    {formatShortName(alert.profile_full_name ?? 'Membro')}
                  </Text>
                  <View
                    style={[
                      styles.statusPill,
                      alert.status === 'new' ? styles.statusNew : styles.statusDone,
                    ]}
                  >
                    <Text style={styles.statusPillText}>
                      {alert.status === 'new' ? 'Novo' : alert.status === 'acknowledged' ? 'Visto' : 'Fechado'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.alertTitle}>{alert.title}</Text>
                <Text style={styles.alertMessage}>{alert.message}</Text>
                <Text style={styles.alertDate}>
                  {new Date(alert.created_at).toLocaleString('pt-BR')}
                </Text>
                {alert.status === 'new' ? (
                  <TouchableOpacity
                    style={styles.ackButton}
                    onPress={() => void handleAcknowledge(alert.id)}
                    disabled={ackId === alert.id}
                    activeOpacity={0.85}
                  >
                    {ackId === alert.id ? (
                      <ActivityIndicator color="#FFF" size="small" />
                    ) : (
                      <Text style={styles.ackButtonText}>Marcar como visto</Text>
                    )}
                  </TouchableOpacity>
                ) : null}
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    ...MINIMAL_SECTION_TITLE,
    color: '#3A96DD',
    marginBottom: 4,
  },
  titleMinimal: {
    ...MINIMAL_SECTION_TITLE,
    color: MINIMAL_UI.blueDark,
    marginBottom: 4,
  },
  subtitle: {
    color: MINIMAL_UI.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 10,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  filterChip: {
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: '#FFF',
  },
  filterChipActive: {
    borderColor: MINIMAL_UI.blueDark,
    backgroundColor: 'rgba(27, 79, 138, 0.08)',
  },
  filterChipText: {
    color: MINIMAL_UI.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: MINIMAL_UI.blueDark,
  },
  refreshBtn: {
    marginLeft: 'auto',
    padding: 8,
  },
  list: { flex: 1 },
  listContent: { gap: 10, paddingBottom: 16 },
  empty: {
    color: MINIMAL_UI.textMuted,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 24,
  },
  errorBox: { gap: 8, paddingVertical: 12 },
  errorText: { color: '#DC2626', fontSize: 13 },
  hint: { color: MINIMAL_UI.textMuted, fontSize: 12, lineHeight: 17 },
  alertCard: {
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    borderRadius: 12,
    padding: 12,
    gap: 6,
    backgroundColor: '#FFF',
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  alertName: {
    flex: 1,
    color: MINIMAL_UI.text,
    fontWeight: '700',
    fontSize: 14,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  statusNew: { backgroundColor: 'rgba(217, 119, 6, 0.15)' },
  statusDone: { backgroundColor: 'rgba(5, 150, 105, 0.12)' },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: MINIMAL_UI.text,
  },
  alertTitle: {
    color: MINIMAL_UI.blueDark,
    fontSize: 13,
    fontWeight: '700',
  },
  alertMessage: {
    color: MINIMAL_UI.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  alertDate: {
    color: MINIMAL_UI.textMuted,
    fontSize: 11,
  },
  ackButton: {
    marginTop: 6,
    backgroundColor: MINIMAL_UI.blueDark,
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: 'center',
  },
  ackButtonText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 13,
  },
});

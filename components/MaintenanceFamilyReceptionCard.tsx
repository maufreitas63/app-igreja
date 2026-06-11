import { CardLoadingState } from '@/components/ui/CardLoadingState';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { useMaintenanceFamilyReception } from '@/hooks/useMaintenanceFamilyReception';
import { computeMaintenanceContentHeight, maintenancePanelStyles } from '@/lib/maintenanceCardStyles';
import { formatShortName } from '@/lib/formatShortName';
import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import Toast from 'react-native-toast-message';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

type Props = {
  isActive?: boolean;
  panelHeight: number;
};

const ACCENT = '#34D399';

const formatSubmissionDate = (value: string) => {
  const parsed = Date.parse(value);

  if (!Number.isFinite(parsed)) {
    return '—';
  }

  return new Date(parsed).toLocaleString('pt-BR');
};

export function MaintenanceFamilyReceptionCard({ isActive = true, panelHeight }: Props) {
  const {
    submissions,
    loading,
    processing,
    error,
    statusMessage,
    selectedSubmissionIds,
    refetch,
    toggleSubmissionSelection,
    selectAllSubmissions,
    clearSubmissionSelection,
    processSelected,
    rejectSelected,
  } = useMaintenanceFamilyReception(isActive);

  const contentHeight = computeMaintenanceContentHeight(panelHeight);

  const handleProcess = async () => {
    const result = await processSelected();
    Toast.show({
      type: result.success ? 'success' : 'error',
      text1: 'Recepção familiar',
      text2: result.message,
      visibilityTime: 4500,
    });
  };

  const handleReject = async () => {
    const result = await rejectSelected();
    Toast.show({
      type: result.success ? 'success' : 'error',
      text1: 'Recepção familiar',
      text2: result.message,
      visibilityTime: 4500,
    });
  };

  return (
    <View style={[styles.panel, { height: contentHeight }]}>
      <Text style={maintenancePanelStyles.panelTitle}>Recepção — Cadastro Familiar</Text>
      <View style={maintenancePanelStyles.panelSubtitleSpacer} />

      <Text style={styles.helpText}>
        Formulários públicos entram aqui antes de profiles/members. Lotes com código familiar
        detectado nas tabelas finais usam o mesmo IBN; conflitos exigem revisão manual.
      </Text>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {statusMessage ? <Text style={styles.successText}>{statusMessage}</Text> : null}

      <View style={styles.toolbar}>
        <TouchableOpacity style={styles.toolbarButton} onPress={() => void refetch()} activeOpacity={0.85}>
          <MaterialIcons name="refresh" size={18} color="#E2E8F0" />
          <Text style={styles.toolbarButtonText}>Atualizar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.toolbarButton} onPress={selectAllSubmissions} activeOpacity={0.85}>
          <Text style={styles.toolbarButtonText}>Selecionar todos</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.toolbarButton} onPress={clearSubmissionSelection} activeOpacity={0.85}>
          <Text style={styles.toolbarButtonText}>Limpar</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.batchActions}>
        <TouchableOpacity
          style={[styles.primaryButton, processing && styles.buttonDisabled]}
          onPress={() => void handleProcess()}
          disabled={processing}
          activeOpacity={0.85}
        >
          {processing ? (
            <ActivityIndicator color="#052e16" size="small" />
          ) : (
            <Text style={styles.primaryButtonText}>
              {selectedSubmissionIds.length > 0
                ? `Gravar selecionados (${selectedSubmissionIds.length})`
                : 'Gravar todos pendentes'}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.secondaryButton, processing && styles.buttonDisabled]}
          onPress={() => void handleReject()}
          disabled={processing || selectedSubmissionIds.length === 0}
          activeOpacity={0.85}
        >
          <Text style={styles.secondaryButtonText}>Rejeitar selecionados</Text>
        </TouchableOpacity>
      </View>

      <SectionLabel variant="maintenance">Fila pendente ({submissions.length})</SectionLabel>

      {loading ? (
        <CardLoadingState label="Carregando recepção..." />
      ) : submissions.length === 0 ? (
        <Text style={styles.emptyText}>Nenhum cadastro aguardando análise.</Text>
      ) : (
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {submissions.map((submission) => {
            const selected = selectedSubmissionIds.includes(submission.submissionId);

            return (
              <TouchableOpacity
                key={submission.submissionId}
                style={[styles.submissionCard, selected && styles.submissionCardSelected]}
                onPress={() => toggleSubmissionSelection(submission.submissionId)}
                activeOpacity={0.9}
              >
                <View style={styles.submissionHeader}>
                  <Text style={styles.submissionTitle}>
                    {submission.memberCount} integrante(s) · {formatSubmissionDate(submission.createdAt)}
                  </Text>
                  {submission.hasFamilyConflict ? (
                    <Text style={styles.conflictBadge}>Conflito de família</Text>
                  ) : null}
                </View>

                <Text style={styles.submissionMeta}>
                  Protocolo: {submission.submissionId.slice(0, 8).toUpperCase()}
                </Text>
                <Text style={styles.submissionMeta}>
                  Código detectado: {submission.detectedFamilyId ?? 'novo (IBN na gravação)'}
                </Text>

                {submission.members.map((member) => (
                  <View key={member.id} style={styles.memberRow}>
                    <Text style={styles.memberName}>
                      {member.isInformant ? '★ ' : '• '}
                      {formatShortName(member.fullName)} — {member.relationship}
                    </Text>
                    <Text style={styles.memberHint}>
                      {member.matchedProfileId || member.matchedMemberId
                        ? 'Já existe em profiles/members'
                        : 'Novo integrante'}
                      {member.detectedFamilyId ? ` · ${member.detectedFamilyId}` : ''}
                    </Text>
                  </View>
                ))}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    flex: 1,
  },
  helpText: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 13,
    marginBottom: 8,
  },
  successText: {
    color: ACCENT,
    fontSize: 13,
    marginBottom: 8,
  },
  toolbar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  toolbarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(148, 163, 184, 0.12)',
  },
  toolbarButtonText: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '700',
  },
  batchActions: {
    gap: 8,
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: ACCENT,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#052e16',
    fontSize: 14,
    fontWeight: '800',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.45)',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#FCA5A5',
    fontSize: 13,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 14,
    fontStyle: 'italic',
  },
  list: {
    flex: 1,
  },
  listContent: {
    gap: 10,
    paddingBottom: 16,
  },
  submissionCard: {
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.25)',
    borderRadius: 12,
    padding: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
  },
  submissionCardSelected: {
    borderColor: ACCENT,
    backgroundColor: 'rgba(52, 211, 153, 0.08)',
  },
  submissionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  submissionTitle: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '800',
    flex: 1,
  },
  conflictBadge: {
    color: '#FDE68A',
    fontSize: 11,
    fontWeight: '800',
  },
  submissionMeta: {
    color: '#94A3B8',
    fontSize: 12,
    marginBottom: 2,
  },
  memberRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(148, 163, 184, 0.2)',
  },
  memberName: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '700',
  },
  memberHint: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
});

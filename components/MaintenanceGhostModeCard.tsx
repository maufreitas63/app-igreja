import { CardLoadingState } from '@/components/ui/CardLoadingState';
import { DropdownSelect } from '@/components/ui/DropdownSelect';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { useGhostMode } from '@/context/GhostModeContext';
import { confirmDialog } from '@/lib/confirmDialog';
import { formatShortName } from '@/lib/formatShortName';
import {
  fetchGhostTargetAccessAuditReport,
  fetchGhostTargetProfilePreview,
  GHOST_MODE_SQL_HINT,
  type GhostModeAccessAuditReport,
  type GhostModeAccessAuditRow,
  type GhostModeProfileOption,
  type GhostModeTargetPreview,
} from '@/lib/ghostModeApi';
import { computeMaintenanceContentHeight, maintenancePanelStyles } from '@/lib/maintenanceCardStyles';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
};

const RESOURCE_TYPE_LABELS: Record<GhostModeAccessAuditRow['resourceType'], string> = {
  screen: 'Telas',
  table: 'Tabelas',
  column: 'Colunas',
};

const formatPermissionLabel = (allowed: boolean) => (allowed ? 'Sim' : 'Não');

function GhostModeAccessAuditPanel({
  loading,
  error,
  report,
}: {
  loading: boolean;
  error: string | null;
  report: GhostModeAccessAuditReport | null;
}) {
  const [showOnlyGranted, setShowOnlyGranted] = useState(false);
  const [expandedTypes, setExpandedTypes] = useState<Record<string, boolean>>({
    screen: true,
    table: false,
    column: false,
  });

  const groupedRows = useMemo(() => {
    if (!report) {
      return [] as Array<{
        type: GhostModeAccessAuditRow['resourceType'];
        title: string;
        rows: GhostModeAccessAuditRow[];
      }>;
    }

    const types: GhostModeAccessAuditRow['resourceType'][] = ['screen', 'table', 'column'];

    return types
      .map((type) => {
        const rows = report.rows.filter((row) => {
          if (row.resourceType !== type) {
            return false;
          }

          if (!showOnlyGranted) {
            return true;
          }

          return row.canView || row.canUpdate;
        });

        return {
          type,
          title: RESOURCE_TYPE_LABELS[type],
          rows,
        };
      })
      .filter((group) => group.rows.length > 0);
  }, [report, showOnlyGranted]);

  if (loading) {
    return (
      <View style={styles.auditBox}>
        <Text style={styles.previewSectionTitle}>Relatório de acesso (ACL)</Text>
        <CardLoadingState lines={5} compact />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.auditBox}>
        <Text style={styles.previewSectionTitle}>Relatório de acesso (ACL)</Text>
        <Text style={styles.previewError}>{error}</Text>
      </View>
    );
  }

  if (!report) {
    return null;
  }

  return (
    <View style={styles.auditBox}>
      <Text style={styles.previewSectionTitle}>Relatório de acesso (ACL)</Text>
      <Text style={styles.previewSubtitle}>
        Telas e elementos do aplicativo com permissão de visualizar e alterar para este usuário.
      </Text>
      <Text style={styles.auditSummary}>
        {report.summary.canViewCount} com visualização · {report.summary.canUpdateCount} com alteração
        {' · '}
        {report.summary.total} recursos cadastrados
      </Text>

      <TouchableOpacity
        style={styles.auditFilterButton}
        onPress={() => setShowOnlyGranted((current) => !current)}
        activeOpacity={0.85}
      >
        <Text style={styles.auditFilterButtonText}>
          {showOnlyGranted ? 'Mostrar todos os recursos' : 'Mostrar somente com acesso'}
        </Text>
      </TouchableOpacity>

      {groupedRows.length === 0 ? (
        <Text style={styles.previewMuted}>Nenhum recurso corresponde ao filtro atual.</Text>
      ) : (
        groupedRows.map((group) => {
          const isExpanded = expandedTypes[group.type] ?? false;
          const grantedCount = group.rows.filter((row) => row.canView || row.canUpdate).length;

          return (
            <View key={group.type} style={styles.auditGroup}>
              <TouchableOpacity
                style={styles.auditGroupHeader}
                onPress={() =>
                  setExpandedTypes((current) => ({
                    ...current,
                    [group.type]: !isExpanded,
                  }))
                }
                activeOpacity={0.85}
              >
                <View style={styles.auditGroupHeaderText}>
                  <Text style={styles.auditGroupTitle}>{group.title}</Text>
                  <Text style={styles.auditGroupMeta}>
                    {grantedCount} com acesso · {group.rows.length} listado(s)
                  </Text>
                </View>
                <Text style={styles.auditGroupToggle}>{isExpanded ? '−' : '+'}</Text>
              </TouchableOpacity>

              {isExpanded ? (
                <View style={styles.auditTable}>
                  <View style={styles.auditTableHeader}>
                    <Text style={[styles.auditHeaderCell, styles.auditElementCell]}>Tela / elemento</Text>
                    <Text style={styles.auditHeaderCell}>Ver</Text>
                    <Text style={styles.auditHeaderCell}>Alterar</Text>
                  </View>

                  {group.rows.map((row) => (
                    <View key={`${row.resourceType}:${row.resourceKey}`} style={styles.auditTableRow}>
                      <View style={styles.auditElementCell}>
                        <Text style={styles.auditElementLabel}>{row.label}</Text>
                        <Text style={styles.auditElementKey}>{row.resourceKey}</Text>
                      </View>
                      <Text
                        style={[
                          styles.auditPermissionCell,
                          row.canView ? styles.auditPermissionYes : styles.auditPermissionNo,
                        ]}
                      >
                        {formatPermissionLabel(row.canView)}
                      </Text>
                      <Text
                        style={[
                          styles.auditPermissionCell,
                          row.canUpdate ? styles.auditPermissionYes : styles.auditPermissionNo,
                        ]}
                      >
                        {formatPermissionLabel(row.canUpdate)}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          );
        })
      )}
    </View>
  );
}

function GhostModeRolesPreviewPanel({
  loading,
  error,
  preview,
}: {
  loading: boolean;
  error: string | null;
  preview: GhostModeTargetPreview | null;
}) {
  if (loading) {
    return (
      <View style={styles.previewBox}>
        <Text style={styles.previewTitle}>Papéis de acesso</Text>
        <CardLoadingState lines={3} compact />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.previewBox}>
        <Text style={styles.previewTitle}>Papéis de acesso</Text>
        <Text style={styles.previewError}>{error}</Text>
      </View>
    );
  }

  if (!preview) {
    return null;
  }

  const { roles, implicitVisitante } = preview;

  return (
    <View style={styles.previewBox}>
      <Text style={styles.previewTitle}>Papéis de acesso</Text>
      <Text style={styles.previewSubtitle}>
        Papéis atribuídos ao usuário selecionado antes de ativar o Modo Ghost.
      </Text>

      {implicitVisitante ? (
        <Text style={styles.visitanteHint}>
          Nenhum papel atribuído — o aplicativo trata este perfil como visitante.
        </Text>
      ) : null}

      {roles.length ? (
        <View style={styles.rolesList}>
          {roles.map((role) => (
            <View key={role.roleId} style={styles.roleChip}>
              <Text style={styles.roleChipName}>{role.roleName}</Text>
              <Text style={styles.roleChipCode}>{role.roleCode}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.previewMuted}>Sem papéis explícitos na tabela de acesso.</Text>
      )}
    </View>
  );
}

export function MaintenanceGhostModeCard({ isActive = false, panelHeight }: Props) {
  const contentHeight = computeMaintenanceContentHeight(panelHeight);
  const { isActive: ghostActive, startGhostMode } = useGhostMode();
  const [profiles, setProfiles] = useState<GhostModeProfileOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rpcMissing, setRpcMissing] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [preview, setPreview] = useState<GhostModeTargetPreview | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [auditReport, setAuditReport] = useState<GhostModeAccessAuditReport | null>(null);

  const loadProfiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    setRpcMissing(false);

    try {
      const { listActiveProfilesForGhostMode } = await import('@/lib/ghostModeApi');
      const rows = await listActiveProfilesForGhostMode();
      setProfiles(rows);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Não foi possível carregar usuários.';
      setError(message);
      setRpcMissing(message.includes('access-control-ghost-mode.sql'));
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isActive || ghostActive) {
      return;
    }

    void loadProfiles();
  }, [ghostActive, isActive, loadProfiles]);

  useEffect(() => {
    if (!selectedProfileId) {
      setPreview(null);
      setPreviewError(null);
      setPreviewLoading(false);
      setAuditReport(null);
      setAuditError(null);
      setAuditLoading(false);
      return;
    }

    let active = true;
    setPreviewLoading(true);
    setPreviewError(null);
    setPreview(null);
    setAuditLoading(true);
    setAuditError(null);
    setAuditReport(null);

    void (async () => {
      const [previewResult, auditResult] = await Promise.all([
        fetchGhostTargetProfilePreview(selectedProfileId),
        fetchGhostTargetAccessAuditReport(selectedProfileId),
      ]);

      if (!active) {
        return;
      }

      if (!previewResult.success) {
        setPreviewError(previewResult.message);
        setPreview(null);
      } else {
        setPreview(previewResult.preview);
        setPreviewError(null);
      }

      if (!auditResult.success) {
        setAuditError(auditResult.message);
        setAuditReport(null);
      } else {
        setAuditReport(auditResult.report);
        setAuditError(null);
      }

      setPreviewLoading(false);
      setAuditLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [selectedProfileId]);

  const profileOptions = useMemo(
    () =>
      profiles.map((profile) => ({
        value: profile.id,
        label: `${formatShortName(profile.fullName)}${profile.phone ? ` · ${profile.phone}` : ''}`,
      })),
    [profiles]
  );

  const selectedProfile = profiles.find((profile) => profile.id === selectedProfileId) ?? null;

  const handleStartGhost = async () => {
    if (!selectedProfile) {
      Toast.show({
        type: 'error',
        text1: 'Modo Ghost',
        text2: 'Selecione um usuário ativo.',
      });
      return;
    }

    const confirmed = await confirmDialog(
      'Ativar Modo Ghost',
      `Simular a sessão de ${formatShortName(selectedProfile.fullName)}?\n\nVocê verá o aplicativo com as mesmas permissões deste usuário. As alterações serão registradas em nome dele, com auditoria do operador real.`,
      'Ativar',
      'Cancelar'
    );

    if (!confirmed) {
      return;
    }

    setStarting(true);

    try {
      const result = await startGhostMode({
        targetProfileId: selectedProfile.id,
        targetFullName: selectedProfile.fullName,
      });

      Toast.show({
        type: result.success ? 'success' : 'error',
        text1: 'Modo Ghost',
        text2: result.message,
        visibilityTime: result.success ? 4000 : 5500,
      });
    } finally {
      setStarting(false);
    }
  };

  if (ghostActive) {
    return (
      <View style={[maintenancePanelStyles.panelScrollContent, { minHeight: contentHeight }]}>
        <Text style={styles.title}>Modo Ghost (Auditor)</Text>
        <Text style={styles.hint}>
          O Modo Ghost já está ativo. Use o banner superior para encerrar a simulação e voltar ao seu
          usuário real.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[maintenancePanelStyles.panelScrollContent, { minHeight: contentHeight }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
    >
      <Text style={styles.title}>Modo Ghost (Auditor)</Text>
      <Text style={styles.hint}>
        Selecione um usuário ativo para simular a identidade dele e validar permissões de acesso na
        Dashboard e demais telas. Disponível apenas para administradores autorizados.
      </Text>

      {rpcMissing ? <Text style={styles.warningText}>{GHOST_MODE_SQL_HINT}</Text> : null}
      {error && !rpcMissing ? <Text style={styles.errorText}>{error}</Text> : null}

      {loading ? <CardLoadingState lines={3} compact /> : null}

      {!loading ? (
        <>
          <SectionLabel>Usuário ativo</SectionLabel>
          <DropdownSelect
            options={profileOptions}
            selectedValue={selectedProfileId ?? ''}
            onValueChange={(value) => setSelectedProfileId(value || null)}
            modalTitle="Selecionar usuário"
            placeholder="Selecione um usuário..."
            searchPlaceholder="Digite nome ou telefone..."
            searchable
            disabled={starting || profileOptions.length === 0}
          />

          <TouchableOpacity
            style={[styles.primaryButton, (starting || !selectedProfileId) && styles.primaryButtonDisabled]}
            onPress={() => void handleStartGhost()}
            disabled={starting || !selectedProfileId}
            activeOpacity={0.85}
          >
            {starting ? (
              <ActivityIndicator color="#0f172a" size="small" />
            ) : (
              <Text style={styles.primaryButtonText}>Ativar Modo Ghost</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.footerHint}>
            O estado persiste durante a navegação e é resetado ao sair do app ou fazer logout.
          </Text>

          {selectedProfileId ? (
            <>
              <GhostModeRolesPreviewPanel
                loading={previewLoading}
                error={previewError}
                preview={preview}
              />
              <GhostModeAccessAuditPanel
                loading={auditLoading}
                error={auditError}
                report={auditReport}
              />
            </>
          ) : null}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  hint: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 14,
  },
  footerHint: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 12,
  },
  warningText: {
    color: '#FCD34D',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 10,
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 10,
  },
  primaryButton: {
    marginTop: 14,
    borderRadius: 10,
    backgroundColor: '#FCD34D',
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.55,
  },
  primaryButtonText: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '800',
  },
  previewBox: {
    marginTop: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(251, 113, 133, 0.45)',
    backgroundColor: 'rgba(30, 41, 59, 0.55)',
    padding: 14,
    gap: 4,
  },
  previewTitle: {
    color: '#FECDD3',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 2,
  },
  previewSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 8,
  },
  previewSectionTitle: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 10,
    marginBottom: 4,
  },
  previewError: {
    color: '#FCA5A5',
    fontSize: 12,
    lineHeight: 18,
  },
  previewMuted: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 17,
  },
  visitanteHint: {
    color: '#FCD34D',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 6,
  },
  rolesList: {
    gap: 8,
    marginTop: 2,
    marginBottom: 4,
  },
  roleChip: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 2,
  },
  roleChipName: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '700',
  },
  roleChipCode: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  auditBox: {
    marginTop: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.35)',
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    padding: 14,
    gap: 8,
  },
  auditSummary: {
    color: '#CBD5E1',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  auditFilterButton: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#475569',
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 4,
  },
  auditFilterButtonText: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '700',
  },
  auditGroup: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    overflow: 'hidden',
    marginTop: 4,
  },
  auditGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(30, 41, 59, 0.85)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  auditGroupHeaderText: {
    flex: 1,
    gap: 2,
  },
  auditGroupTitle: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '800',
  },
  auditGroupMeta: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
  },
  auditGroupToggle: {
    color: '#FCD34D',
    fontSize: 18,
    fontWeight: '800',
    width: 18,
    textAlign: 'center',
  },
  auditTable: {
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
  },
  auditTableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
  },
  auditTableRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(51, 65, 85, 0.65)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
  },
  auditHeaderCell: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    width: 52,
    textAlign: 'center',
  },
  auditElementCell: {
    flex: 1,
    minWidth: 0,
  },
  auditElementLabel: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  auditElementKey: {
    color: '#64748B',
    fontSize: 10,
    fontFamily: 'monospace',
    marginTop: 2,
  },
  auditPermissionCell: {
    width: 52,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '800',
  },
  auditPermissionYes: {
    color: '#6EE7B7',
  },
  auditPermissionNo: {
    color: '#94A3B8',
  },
});

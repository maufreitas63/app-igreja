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
import { computeMaintenanceContentHeight } from '@/lib/maintenanceCardStyles';
import { CONTAIN_WIDTH } from '@/lib/minimalPresentation';
import { MINIMAL_SECTION_TITLE, MINIMAL_UI } from '@/lib/minimalUiTheme';
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
  minimal?: boolean;
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
  minimal = false,
}: {
  loading: boolean;
  error: string | null;
  report: GhostModeAccessAuditReport | null;
  minimal?: boolean;
}) {
  const [showOnlyGranted, setShowOnlyGranted] = useState(false);
  const [expandedTypes, setExpandedTypes] = useState<Record<string, boolean>>({
    screen: true,
    table: false,
    column: false,
  });

  const groupedRows = useMemo(() => {
    if (!report) {
      return [] as {
        type: GhostModeAccessAuditRow['resourceType'];
        title: string;
        rows: GhostModeAccessAuditRow[];
      }[];
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
      <View style={[styles.auditBox, minimal && styles.auditBoxMinimal]}>
        <Text style={[styles.previewSectionTitle, minimal && styles.previewSectionTitleMinimal]}>
          Relatório de acesso (ACL)
        </Text>
        <CardLoadingState lines={5} compact minimal={minimal} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.auditBox, minimal && styles.auditBoxMinimal]}>
        <Text style={[styles.previewSectionTitle, minimal && styles.previewSectionTitleMinimal]}>
          Relatório de acesso (ACL)
        </Text>
        <Text style={[styles.previewError, minimal && styles.previewErrorMinimal]}>{error}</Text>
      </View>
    );
  }

  if (!report) {
    return null;
  }

  return (
    <View style={[styles.auditBox, minimal && styles.auditBoxMinimal]}>
      <Text style={[styles.previewSectionTitle, minimal && styles.previewSectionTitleMinimal]}>
        Relatório de acesso (ACL)
      </Text>
      <Text style={[styles.previewSubtitle, minimal && styles.previewSubtitleMinimal]}>
        Telas e elementos do aplicativo com permissão de visualizar e alterar para este usuário.
      </Text>
      <Text style={[styles.auditSummary, minimal && styles.auditSummaryMinimal]}>
        {report.summary.canViewCount} com visualização · {report.summary.canUpdateCount} com alteração
        {' · '}
        {report.summary.total} recursos cadastrados
      </Text>

      <TouchableOpacity
        style={[styles.auditFilterButton, minimal && styles.auditFilterButtonMinimal]}
        onPress={() => setShowOnlyGranted((current) => !current)}
        activeOpacity={0.85}
      >
        <Text style={[styles.auditFilterButtonText, minimal && styles.auditFilterButtonTextMinimal]}>
          {showOnlyGranted ? 'Mostrar todos os recursos' : 'Mostrar somente com acesso'}
        </Text>
      </TouchableOpacity>

      {groupedRows.length === 0 ? (
        <Text style={[styles.previewMuted, minimal && styles.previewMutedMinimal]}>
          Nenhum recurso corresponde ao filtro atual.
        </Text>
      ) : (
        groupedRows.map((group) => {
          const isExpanded = expandedTypes[group.type] ?? false;
          const grantedCount = group.rows.filter((row) => row.canView || row.canUpdate).length;

          return (
            <View key={group.type} style={[styles.auditGroup, minimal && styles.auditGroupMinimal]}>
              <TouchableOpacity
                style={[styles.auditGroupHeader, minimal && styles.auditGroupHeaderMinimal]}
                onPress={() =>
                  setExpandedTypes((current) => ({
                    ...current,
                    [group.type]: !isExpanded,
                  }))
                }
                activeOpacity={0.85}
              >
                <View style={styles.auditGroupHeaderText}>
                  <Text style={[styles.auditGroupTitle, minimal && styles.auditGroupTitleMinimal]}>
                    {group.title}
                  </Text>
                  <Text style={[styles.auditGroupMeta, minimal && styles.auditGroupMetaMinimal]}>
                    {grantedCount} com acesso · {group.rows.length} listado(s)
                  </Text>
                </View>
                <Text style={[styles.auditGroupToggle, minimal && styles.auditGroupToggleMinimal]}>
                  {isExpanded ? '−' : '+'}
                </Text>
              </TouchableOpacity>

              {isExpanded ? (
                <View style={[styles.auditTable, minimal && styles.auditTableMinimal]}>
                  <View style={[styles.auditTableHeader, minimal && styles.auditTableHeaderMinimal]}>
                    <Text
                      style={[
                        styles.auditHeaderCell,
                        minimal && styles.auditHeaderCellMinimal,
                        styles.auditElementCell,
                      ]}
                    >
                      Tela / elemento
                    </Text>
                    <Text style={[styles.auditHeaderCell, minimal && styles.auditHeaderCellMinimal]}>
                      Ver
                    </Text>
                    <Text style={[styles.auditHeaderCell, minimal && styles.auditHeaderCellMinimal]}>
                      Alterar
                    </Text>
                  </View>

                  {group.rows.map((row, index) => (
                    <View
                      key={`${row.resourceType}:${row.resourceKey}`}
                      style={[
                        styles.auditTableRow,
                        minimal && styles.auditTableRowMinimal,
                        minimal && index % 2 === 1 && styles.auditTableRowAltMinimal,
                      ]}
                    >
                      <View style={styles.auditElementCell}>
                        <Text
                          style={[styles.auditElementLabel, minimal && styles.auditElementLabelMinimal]}
                        >
                          {row.label}
                        </Text>
                        <Text style={[styles.auditElementKey, minimal && styles.auditElementKeyMinimal]}>
                          {row.resourceKey}
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.auditPermissionCell,
                          row.canView ? styles.auditPermissionYes : styles.auditPermissionNo,
                          minimal &&
                            (row.canView
                              ? styles.auditPermissionYesMinimal
                              : styles.auditPermissionNoMinimal),
                        ]}
                      >
                        {formatPermissionLabel(row.canView)}
                      </Text>
                      <Text
                        style={[
                          styles.auditPermissionCell,
                          row.canUpdate ? styles.auditPermissionYes : styles.auditPermissionNo,
                          minimal &&
                            (row.canUpdate
                              ? styles.auditPermissionYesMinimal
                              : styles.auditPermissionNoMinimal),
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
  minimal = false,
}: {
  loading: boolean;
  error: string | null;
  preview: GhostModeTargetPreview | null;
  minimal?: boolean;
}) {
  if (loading) {
    return (
      <View style={[styles.previewBox, minimal && styles.previewBoxMinimal]}>
        <Text style={[styles.previewTitle, minimal && styles.previewTitleMinimal]}>
          Papéis de acesso
        </Text>
        <CardLoadingState lines={3} compact minimal={minimal} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.previewBox, minimal && styles.previewBoxMinimal]}>
        <Text style={[styles.previewTitle, minimal && styles.previewTitleMinimal]}>
          Papéis de acesso
        </Text>
        <Text style={[styles.previewError, minimal && styles.previewErrorMinimal]}>{error}</Text>
      </View>
    );
  }

  if (!preview) {
    return null;
  }

  const { roles, implicitVisitante } = preview;

  return (
    <View style={[styles.previewBox, minimal && styles.previewBoxMinimal]}>
      <Text style={[styles.previewTitle, minimal && styles.previewTitleMinimal]}>
        Papéis de acesso
      </Text>
      <Text style={[styles.previewSubtitle, minimal && styles.previewSubtitleMinimal]}>
        Papéis atribuídos ao usuário selecionado antes de ativar o Modo Ghost.
      </Text>

      {implicitVisitante ? (
        <Text style={[styles.visitanteHint, minimal && styles.visitanteHintMinimal]}>
          Nenhum papel atribuído — o aplicativo trata este perfil como visitante.
        </Text>
      ) : null}

      {roles.length ? (
        <View style={styles.rolesList}>
          {roles.map((role) => (
            <View key={role.roleId} style={[styles.roleChip, minimal && styles.roleChipMinimal]}>
              <Text style={[styles.roleChipName, minimal && styles.roleChipNameMinimal]}>
                {role.roleName}
              </Text>
              <Text style={[styles.roleChipCode, minimal && styles.roleChipCodeMinimal]}>
                {role.roleCode}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={[styles.previewMuted, minimal && styles.previewMutedMinimal]}>
          Sem papéis explícitos na tabela de acesso.
        </Text>
      )}
    </View>
  );
}

export function MaintenanceGhostModeCard({
  isActive = false,
  panelHeight,
  minimal = false,
}: Props) {
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
      <View
        style={[
          styles.scroll,
          styles.scrollContent,
          minimal && styles.panelMinimal,
          { height: contentHeight, maxHeight: contentHeight },
        ]}
      >
        <Text style={minimal ? styles.sectionTitle : styles.title}>Modo Ghost (Auditor)</Text>
        <Text style={[styles.hint, minimal && styles.hintMinimal]}>
          O Modo Ghost já está ativo. Use o banner superior para encerrar a simulação e voltar ao seu
          usuário real.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.scroll, minimal && styles.panelMinimal, { height: contentHeight, maxHeight: contentHeight }]}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
    >
      <Text style={minimal ? styles.sectionTitle : styles.title}>Modo Ghost (Auditor)</Text>
      <Text style={[styles.hint, minimal && styles.hintMinimal]}>
        Selecione um usuário ativo para simular a identidade dele e validar permissões de acesso na
        Dashboard e demais telas. Disponível apenas para administradores autorizados.
      </Text>

      {rpcMissing ? (
        <Text style={[styles.warningText, minimal && styles.warningTextMinimal]}>
          {GHOST_MODE_SQL_HINT}
        </Text>
      ) : null}
      {error && !rpcMissing ? (
        <Text style={[styles.errorText, minimal && styles.errorTextMinimal]}>{error}</Text>
      ) : null}

      {loading ? <CardLoadingState lines={3} compact minimal={minimal} /> : null}

      {!loading ? (
        <>
          {minimal ? (
            <Text style={styles.filterLabelMinimal}>Usuário ativo</Text>
          ) : (
            <SectionLabel>Usuário ativo</SectionLabel>
          )}
          <DropdownSelect
            options={profileOptions}
            selectedValue={selectedProfileId ?? ''}
            onValueChange={(value) => setSelectedProfileId(value || null)}
            modalTitle="Selecionar usuário"
            placeholder="Selecione um usuário..."
            searchPlaceholder="Digite nome ou telefone..."
            searchable
            variant={minimal ? 'minimal' : 'default'}
            disabled={starting || profileOptions.length === 0}
          />

          <TouchableOpacity
            style={[
              styles.primaryButton,
              minimal && styles.primaryButtonMinimal,
              (starting || !selectedProfileId) && styles.primaryButtonDisabled,
            ]}
            onPress={() => void handleStartGhost()}
            disabled={starting || !selectedProfileId}
            activeOpacity={0.85}
          >
            {starting ? (
              <ActivityIndicator color={minimal ? MINIMAL_UI.onDark : '#0f172a'} size="small" />
            ) : (
              <Text style={[styles.primaryButtonText, minimal && styles.primaryButtonTextMinimal]}>
                Ativar Modo Ghost
              </Text>
            )}
          </TouchableOpacity>

          <Text style={[styles.footerHint, minimal && styles.footerHintMinimal]}>
            O estado persiste durante a navegação e é resetado ao sair do app ou fazer logout.
          </Text>

          {selectedProfileId ? (
            <>
              <GhostModeRolesPreviewPanel
                loading={previewLoading}
                error={previewError}
                preview={preview}
                minimal={minimal}
              />
              <GhostModeAccessAuditPanel
                loading={auditLoading}
                error={auditError}
                report={auditReport}
                minimal={minimal}
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
    ...CONTAIN_WIDTH,
    flex: 1,
    minHeight: 0,
  },
  scrollContent: {
    gap: 8,
    paddingBottom: 16,
  },
  title: {
    color: '#3A96DD',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  hint: {
    color: 'rgba(58, 150, 221, 0.82)',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 14,
  },
  footerHint: {
    color: 'rgba(58, 150, 221, 0.82)',
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
    color: '#FFFFFF',
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
    color: 'rgba(58, 150, 221, 0.82)',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 8,
  },
  previewSectionTitle: {
    color: '#3A96DD',
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
    color: 'rgba(58, 150, 221, 0.82)',
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
    borderColor: 'rgba(52, 211, 153, 0.35)',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 2,
  },
  roleChipName: {
    color: '#3A96DD',
    fontSize: 13,
    fontWeight: '700',
  },
  roleChipCode: {
    color: 'rgba(58, 150, 221, 0.82)',
    fontSize: 11,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  auditBox: {
    marginTop: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.35)',
    backgroundColor: '#FFFFFF',
    padding: 14,
    gap: 8,
  },
  auditSummary: {
    color: '#3A96DD',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  auditFilterButton: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 4,
  },
  auditFilterButtonText: {
    color: '#3A96DD',
    fontSize: 11,
    fontWeight: '700',
  },
  auditGroup: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
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
    color: '#3A96DD',
    fontSize: 13,
    fontWeight: '800',
  },
  auditGroupMeta: {
    color: 'rgba(58, 150, 221, 0.82)',
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
    backgroundColor: '#FFFFFF',
  },
  auditTableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(52, 211, 153, 0.35)',
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
    color: 'rgba(58, 150, 221, 0.82)',
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
    color: '#3A96DD',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  auditElementKey: {
    color: 'rgba(58, 150, 221, 0.82)',
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
    color: 'rgba(58, 150, 221, 0.82)',
  },
  panelMinimal: {
    ...CONTAIN_WIDTH,
    paddingHorizontal: 0,
    paddingVertical: 4,
    backgroundColor: MINIMAL_UI.background,
  },
  sectionTitle: {
    ...MINIMAL_SECTION_TITLE,
    alignSelf: 'stretch',
    maxWidth: '100%',
    minWidth: 0,
    paddingHorizontal: 0,
    marginBottom: 8,
  },
  hintMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  footerHintMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  warningTextMinimal: {
    color: '#B45309',
  },
  errorTextMinimal: {
    color: '#DC2626',
  },
  filterLabelMinimal: {
    color: MINIMAL_UI.textMuted,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
    marginTop: 4,
  },
  primaryButtonMinimal: {
    backgroundColor: MINIMAL_UI.blueDark,
  },
  primaryButtonTextMinimal: {
    color: MINIMAL_UI.onDark,
  },
  previewBoxMinimal: {
    ...CONTAIN_WIDTH,
    borderColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.background,
  },
  previewTitleMinimal: {
    color: MINIMAL_UI.blueDark,
  },
  previewSubtitleMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  previewSectionTitleMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  previewErrorMinimal: {
    color: '#DC2626',
  },
  previewMutedMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  visitanteHintMinimal: {
    color: '#B45309',
  },
  roleChipMinimal: {
    borderColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.background,
  },
  roleChipNameMinimal: {
    color: MINIMAL_UI.text,
  },
  roleChipCodeMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  auditBoxMinimal: {
    ...CONTAIN_WIDTH,
    borderColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.background,
  },
  auditSummaryMinimal: {
    color: MINIMAL_UI.text,
  },
  auditFilterButtonMinimal: {
    borderColor: MINIMAL_UI.blueDark,
  },
  auditFilterButtonTextMinimal: {
    color: MINIMAL_UI.blueDark,
  },
  auditGroupMinimal: {
    borderColor: MINIMAL_UI.border,
  },
  auditGroupHeaderMinimal: {
    backgroundColor: MINIMAL_UI.rowHover,
  },
  auditGroupTitleMinimal: {
    color: MINIMAL_UI.blueDark,
  },
  auditGroupMetaMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  auditGroupToggleMinimal: {
    color: MINIMAL_UI.blueDark,
  },
  auditTableMinimal: {
    backgroundColor: MINIMAL_UI.background,
  },
  auditTableHeaderMinimal: {
    borderBottomColor: MINIMAL_UI.divider,
  },
  auditHeaderCellMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  auditTableRowMinimal: {
    borderBottomColor: MINIMAL_UI.divider,
  },
  auditTableRowAltMinimal: {
    backgroundColor: MINIMAL_UI.rowHover,
  },
  auditElementLabelMinimal: {
    color: MINIMAL_UI.text,
  },
  auditElementKeyMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  auditPermissionYesMinimal: {
    color: '#16A34A',
  },
  auditPermissionNoMinimal: {
    color: MINIMAL_UI.textMuted,
  },
});

import { CloseFooterBar, CLOSE_FOOTER_DOCK_HEIGHT } from '@/components/minimal/CloseFooterBar';
import { CardLoadingState } from '@/components/ui/CardLoadingState';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { useMaintenanceProfileAccessInsights } from '@/hooks/useMaintenanceProfileAccessInsights';
import { boxShadowStyle, NO_BOX_SHADOW } from '@/lib/boxShadow';
import { formatShortName } from '@/lib/formatShortName';
import {
  listProfileScreenVisitsForSuperAdmin,
  PROFILE_ACCESS_INSIGHTS_SQL_HINT,
  type ProfileAccessInsightRow,
  type ProfileAccessSessionBlock,
} from '@/lib/profileAccessInsightsApi';
import { computeMaintenanceContentHeight, maintenancePanelStyles } from '@/lib/maintenanceCardStyles';
import { CONTAIN_WIDTH } from '@/lib/minimalPresentation';
import { MINIMAL_SECTION_TITLE, MINIMAL_UI } from '@/lib/minimalUiTheme';
import { FontAwesome } from '@expo/vector-icons';
import React, { useCallback, useState } from 'react';
import Toast from 'react-native-toast-message';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

type Props = {
  isActive?: boolean;
  panelHeight: number;
  minimal?: boolean;
};

const ACCENT = '#3A96DD';

const formatAccessDateTimeLabel = (value: string | null) => {
  if (!value) {
    return '—';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return date.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

type ScreenHistoryBalloonProps = {
  visible: boolean;
  profile: ProfileAccessInsightRow | null;
  sessions: ProfileAccessSessionBlock[];
  loading: boolean;
  error: string | null;
  rpcMissing: boolean;
  onClose: () => void;
  minimal?: boolean;
};

function ScreenHistoryBalloon({
  visible,
  profile,
  sessions,
  loading,
  error,
  rpcMissing,
  onClose,
  minimal = false,
}: ScreenHistoryBalloonProps) {
  if (!profile) {
    return null;
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[styles.balloonBackdrop, minimal && styles.balloonBackdropMinimal]} onPress={onClose}>
        <Pressable style={[styles.balloonCard, minimal && styles.balloonCardMinimal]} onPress={() => undefined}>
          <View style={[styles.balloonPointer, minimal && styles.balloonPointerMinimal]} />
          <Text style={[styles.balloonTitle, minimal && styles.balloonTitleMinimal]}>
            Telas visitadas — {formatShortName(profile.fullName)}
          </Text>
          <Text style={[styles.balloonSubtitle, minimal && styles.balloonSubtitleMinimal]}>
            Do login mais recente ao mais antigo, com as telas acessadas em cada sessão.
          </Text>

          {rpcMissing ? (
            <Text style={[styles.warningText, minimal && styles.warningTextMinimal]}>
              {PROFILE_ACCESS_INSIGHTS_SQL_HINT}
            </Text>
          ) : null}
          {error ? (
            <Text style={[styles.errorText, minimal && styles.errorTextMinimal]}>{error}</Text>
          ) : null}
          {loading ? <CardLoadingState lines={3} compact minimal={minimal} /> : null}

          {!loading && !error && !rpcMissing ? (
            <ScrollView
              style={styles.balloonScroll}
              contentContainerStyle={styles.balloonScrollContent}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
            >
              {sessions.length === 0 ? (
                <Text style={[styles.hintText, minimal && styles.hintTextMinimal]}>
                  Nenhuma tela registrada para este usuário.
                </Text>
              ) : (
                sessions.map((session, sessionIndex) => (
                  <View
                    key={session.accessEventId}
                    style={[
                      styles.sessionBlock,
                      sessionIndex < sessions.length - 1 && styles.sessionBlockDivider,
                      minimal && sessionIndex < sessions.length - 1 && styles.sessionBlockDividerMinimal,
                    ]}
                  >
                    <Text style={[styles.sessionDateTime, minimal && styles.sessionDateTimeMinimal]}>
                      {formatAccessDateTimeLabel(session.accessedAt)}
                    </Text>

                    {session.screens.length === 0 ? (
                      <Text style={[styles.emptySessionText, minimal && styles.emptySessionTextMinimal]}>
                        Nenhuma tela registrada neste acesso.
                      </Text>
                    ) : (
                      <View style={styles.screenList}>
                        {session.screens.map((screen) => (
                          <Text
                            key={`${session.accessEventId}-${screen.visitOrder}-${screen.screenKey}`}
                            style={[styles.screenItem, minimal && styles.screenItemMinimal]}
                          >
                            • {screen.screenLabel}
                          </Text>
                        ))}
                      </View>
                    )}
                  </View>
                ))
              )}
            </ScrollView>
          ) : null}

          <CloseFooterBar onPress={onClose} accessibilityLabel="Fechar histórico de telas" />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function MaintenanceProfileAccessInsightsCard({
  isActive = true,
  panelHeight,
  minimal = false,
}: Props) {
  const {
    searchQuery,
    setSearchQuery,
    allProfiles,
    profiles,
    loading,
    clearing,
    error,
    rpcMissing,
    reloadProfiles,
    clearHistory,
  } = useMaintenanceProfileAccessInsights(isActive);

  const [historyProfile, setHistoryProfile] = useState<ProfileAccessInsightRow | null>(null);
  const [historySessions, setHistorySessions] = useState<ProfileAccessSessionBlock[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyRpcMissing, setHistoryRpcMissing] = useState(false);
  const [historyVisible, setHistoryVisible] = useState(false);

  const handleClearHistory = async () => {
    const result = await clearHistory();

    if (result.success) {
      Toast.show({
        type: 'success',
        text1: 'Histórico limpo',
        text2:
          result.deletedCount > 0
            ? `${result.deletedCount} registro(s) removido(s).`
            : 'Nenhum registro de acesso encontrado.',
        visibilityTime: 4000,
      });
      return;
    }

    if (result.message) {
      Toast.show({
        type: 'error',
        text1: 'Não foi possível limpar',
        text2: result.message,
        visibilityTime: 6000,
      });
    }
  };

  const openScreenHistory = useCallback(async (profile: ProfileAccessInsightRow) => {
    setHistoryProfile(profile);
    setHistoryVisible(true);
    setHistoryLoading(true);
    setHistoryError(null);
    setHistoryRpcMissing(false);
    setHistorySessions([]);

    try {
      const result = await listProfileScreenVisitsForSuperAdmin(profile.id);
      setHistorySessions(result.sessions);
      setHistoryRpcMissing(result.rpcMissing);
      setHistoryError(result.error);
    } catch (historyLoadError) {
      setHistorySessions([]);
      setHistoryError(
        historyLoadError instanceof Error
          ? historyLoadError.message
          : 'Não foi possível carregar o histórico de telas.'
      );
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const closeScreenHistory = useCallback(() => {
    setHistoryVisible(false);
    setHistoryProfile(null);
    setHistorySessions([]);
    setHistoryError(null);
    setHistoryRpcMissing(false);
    setHistoryLoading(false);
  }, []);

  const contentHeight = computeMaintenanceContentHeight(panelHeight);
  const hasSearch = searchQuery.trim().length > 0;
  const isBusy = loading || clearing;

  return (
    <View style={[styles.panel, minimal && styles.panelMinimal, { height: contentHeight }]}>
      <Text style={minimal ? styles.sectionTitle : maintenancePanelStyles.panelTitle}>
        Acessos de Usuários
      </Text>
      {!minimal ? <View style={maintenancePanelStyles.panelSubtitleSpacer} /> : null}

      <Text style={[styles.helpText, minimal && styles.helpTextMinimal]}>
        Painel exclusivo do super administrador. Lista apenas usuários com pelo menos um login
        registrado na aplicação.
      </Text>

      {rpcMissing ? (
        <Text style={[styles.warningText, minimal && styles.warningTextMinimal]}>
          {PROFILE_ACCESS_INSIGHTS_SQL_HINT}
        </Text>
      ) : null}
      {error ? (
        <Text style={[styles.errorText, minimal && styles.errorTextMinimal]}>{error}</Text>
      ) : null}

      {minimal ? (
        <Text style={styles.filterLabelMinimal}>Filtrar lista</Text>
      ) : (
        <SectionLabel variant="maintenance">Filtrar lista</SectionLabel>
      )}
      <TextInput
        style={[styles.searchInput, minimal && styles.searchInputMinimal]}
        placeholder="Buscar por nome"
        placeholderTextColor={minimal ? MINIMAL_UI.textMuted : '#64748B'}
        value={searchQuery}
        onChangeText={setSearchQuery}
        autoCapitalize="words"
        autoCorrect={false}
        returnKeyType="search"
      />

      {loading ? <CardLoadingState lines={2} compact minimal={minimal} /> : null}

      {!loading && allProfiles.length > 0 ? (
        <Text style={[styles.countText, minimal && styles.countTextMinimal]}>
          {hasSearch
            ? `${profiles.length} de ${allProfiles.length} usuários com acesso`
            : `${allProfiles.length} usuários com acesso registrado`}
        </Text>
      ) : null}

      {!loading && !rpcMissing && allProfiles.length === 0 ? (
        <Text style={[styles.hintText, minimal && styles.hintTextMinimal]}>
          Nenhum acesso registrado ainda.
        </Text>
      ) : null}

      {!loading && allProfiles.length > 0 ? (
        <View style={[styles.tableSection, minimal && styles.tableSectionMinimal]}>
          <View style={[styles.tableHeader, minimal && styles.tableHeaderMinimal]}>
            <Text style={[styles.headerCell, minimal && styles.headerCellMinimal, styles.nameColumn]}>
              Nome curto
            </Text>
            <Text
              style={[styles.headerCell, minimal && styles.headerCellMinimal, styles.lastAccessColumn]}
            >
              Último acesso
            </Text>
            <Text style={[styles.headerCell, minimal && styles.headerCellMinimal, styles.countColumn]}>
              Total
            </Text>
            <View style={styles.historyColumn} />
          </View>

          <ScrollView
            style={[styles.tableScroll, minimal && styles.tableScrollMinimal]}
            contentContainerStyle={styles.tableContent}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
          >
            {profiles.length === 0 ? (
              <Text style={[styles.emptyFilterText, minimal && styles.emptyFilterTextMinimal]}>
                Nenhum usuário corresponde à busca.
              </Text>
            ) : (
              profiles.map((profile, index) => (
                <View
                  key={profile.id}
                  style={[
                    styles.tableRow,
                    minimal && styles.tableRowMinimal,
                    minimal && index % 2 === 1 && styles.tableRowAltMinimal,
                  ]}
                >
                  <Text
                    style={[
                      styles.shortName,
                      minimal && styles.shortNameMinimal,
                      styles.nameColumn,
                    ]}
                    numberOfLines={2}
                  >
                    {formatShortName(profile.fullName)}
                  </Text>
                  <Text
                    style={[
                      styles.lastAccess,
                      minimal && styles.lastAccessMinimal,
                      styles.lastAccessColumn,
                    ]}
                    numberOfLines={2}
                  >
                    {formatLastAccessLabel(profile.lastAccessAt)}
                  </Text>
                  <Text
                    style={[
                      styles.accessCount,
                      minimal && styles.accessCountMinimal,
                      styles.countColumn,
                    ]}
                  >
                    {profile.accessCount}
                  </Text>
                  <View style={styles.historyColumn}>
                    <TouchableOpacity
                      style={[styles.historyButton, minimal && styles.historyButtonMinimal]}
                      onPress={() => void openScreenHistory(profile)}
                      activeOpacity={0.85}
                      accessibilityRole="button"
                      accessibilityLabel={`Ver telas visitadas por ${formatShortName(profile.fullName)}`}
                    >
                      <FontAwesome name="history" size={16} color={minimal ? MINIMAL_UI.icon : ACCENT} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        </View>
      ) : null}

      {!loading && !rpcMissing ? (
        <View style={[styles.actionRow, minimal && styles.actionRowMinimal]}>
          <TouchableOpacity
            style={[
              styles.actionButton,
              styles.reloadButton,
              minimal && styles.actionButtonMinimal,
              minimal && styles.reloadButtonMinimal,
              isBusy && styles.actionButtonDisabled,
            ]}
            onPress={() => void reloadProfiles()}
            activeOpacity={0.85}
            disabled={isBusy}
            accessibilityRole="button"
            accessibilityLabel="Atualizar lista"
          >
            <Text style={[styles.reloadButtonText, minimal && styles.reloadButtonTextMinimal]}>
              Atualizar lista
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.actionButton,
              styles.clearButton,
              minimal && styles.actionButtonMinimal,
              minimal && styles.clearButtonMinimal,
              isBusy && styles.actionButtonDisabled,
            ]}
            onPress={() => void handleClearHistory()}
            activeOpacity={0.85}
            disabled={isBusy}
            accessibilityRole="button"
            accessibilityLabel="Limpar histórico de acessos"
          >
            <Text style={[styles.clearButtonText, minimal && styles.clearButtonTextMinimal]}>
              {clearing ? 'Limpando...' : 'Limpar histórico'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <ScreenHistoryBalloon
        visible={historyVisible}
        profile={historyProfile}
        sessions={historySessions}
        loading={historyLoading}
        error={historyError}
        rpcMissing={historyRpcMissing}
        onClose={closeScreenHistory}
        minimal={minimal}
      />
    </View>
  );
}

const formatLastAccessLabel = (value: string | null) => formatAccessDateTimeLabel(value);

const styles = StyleSheet.create({
  panel: {
    flex: 1,
  },
  helpText: {
    color: 'rgba(58, 150, 221, 0.82)',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },
  warningText: {
    color: '#FCD34D',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 8,
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 13,
    marginBottom: 8,
  },
  hintText: {
    color: 'rgba(58, 150, 221, 0.82)',
    fontSize: 13,
    fontStyle: 'italic',
  },
  countText: {
    color: 'rgba(58, 150, 221, 0.82)',
    fontSize: 12,
    marginBottom: 8,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.35)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#3A96DD',
    fontSize: 14,
    marginBottom: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  tableSection: {
    flex: 1,
    minHeight: 0,
  },
  tableScroll: {
    flex: 1,
  },
  tableContent: {
    paddingBottom: 16,
    gap: 8,
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 2,
    paddingBottom: 8,
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148, 163, 184, 0.35)',
    backgroundColor: 'rgba(15, 23, 42, 0.96)',
    zIndex: 2,
  },
  headerCell: {
    color: '#3A96DD',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148, 163, 184, 0.15)',
  },
  nameColumn: {
    flex: 1.2,
    minWidth: 0,
    flexShrink: 1,
  },
  lastAccessColumn: {
    flex: 1.4,
    minWidth: 0,
    flexShrink: 1,
  },
  countColumn: {
    width: 44,
    flexShrink: 0,
    textAlign: 'right',
  },
  historyColumn: {
    width: 32,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyButton: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(250, 204, 21, 0.35)',
    backgroundColor: 'rgba(120, 53, 15, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortName: {
    color: '#3A96DD',
    fontSize: 14,
    fontWeight: '700',
  },
  lastAccess: {
    color: '#3A96DD',
    fontSize: 12,
    lineHeight: 16,
  },
  accessCount: {
    color: ACCENT,
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'right',
  },
  emptyFilterText: {
    color: 'rgba(58, 150, 221, 0.82)',
    fontSize: 13,
    fontStyle: 'italic',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  reloadButton: {
    borderColor: 'rgba(250, 204, 21, 0.45)',
    backgroundColor: 'rgba(120, 53, 15, 0.35)',
  },
  clearButton: {
    borderColor: 'rgba(248, 113, 113, 0.45)',
    backgroundColor: 'rgba(127, 29, 29, 0.35)',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
    marginTop: 8,
    alignSelf: 'stretch',
  },
  actionButton: {
    flex: 1,
    minHeight: 35,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  actionButtonDisabled: {
    opacity: 0.55,
  },
  reloadButtonText: {
    color: '#FDE68A',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  clearButtonText: {
    color: '#FECACA',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  balloonBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.72)',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 24,
    paddingBottom: CLOSE_FOOTER_DOCK_HEIGHT,
  },
  balloonCard: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 420,
    maxHeight: '82%',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(250, 204, 21, 0.35)',
    backgroundColor: 'rgba(15, 23, 42, 0.98)',
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 14,
    ...boxShadowStyle({
      color: '#000',
      offsetY: 8,
      blurRadius: 18,
      opacity: 0.35,
      elevation: 8,
    }),
  },
  balloonPointer: {
    position: 'absolute',
    top: -8,
    right: 28,
    width: 16,
    height: 16,
    backgroundColor: 'rgba(15, 23, 42, 0.98)',
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderColor: 'rgba(250, 204, 21, 0.35)',
    transform: [{ rotate: '45deg' }],
  },
  balloonTitle: {
    color: '#3A96DD',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 6,
  },
  balloonSubtitle: {
    color: 'rgba(58, 150, 221, 0.82)',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 12,
  },
  balloonScroll: {
    maxHeight: 360,
  },
  balloonScrollContent: {
    paddingBottom: 8,
    gap: 4,
  },
  sessionBlock: {
    paddingVertical: 10,
  },
  sessionBlockDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148, 163, 184, 0.2)',
  },
  sessionDateTime: {
    color: '#FDE68A',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 8,
  },
  screenList: {
    gap: 4,
    paddingLeft: 2,
  },
  screenItem: {
    color: '#3A96DD',
    fontSize: 13,
    lineHeight: 18,
  },
  emptySessionText: {
    color: 'rgba(58, 150, 221, 0.82)',
    fontSize: 12,
    fontStyle: 'italic',
  },
  balloonCloseButton: {
    marginTop: 12,
    alignSelf: 'flex-end',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.35)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
  },
  balloonCloseButtonText: {
    color: '#3A96DD',
    fontSize: 13,
    fontWeight: '700',
  },
  panelMinimal: {
    ...CONTAIN_WIDTH,
    paddingHorizontal: 0,
    paddingVertical: 4,
    borderRadius: 0,
    backgroundColor: MINIMAL_UI.background,
    overflow: 'hidden',
  },
  sectionTitle: {
    ...MINIMAL_SECTION_TITLE,
    alignSelf: 'stretch',
    maxWidth: '100%',
    minWidth: 0,
    paddingHorizontal: 0,
  },
  helpTextMinimal: {
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
  searchInputMinimal: {
    borderColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.background,
    color: MINIMAL_UI.text,
  },
  countTextMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  hintTextMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  tableSectionMinimal: {
    ...CONTAIN_WIDTH,
  },
  tableHeaderMinimal: {
    borderBottomColor: MINIMAL_UI.divider,
    backgroundColor: MINIMAL_UI.background,
  },
  headerCellMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  tableScrollMinimal: {
    ...CONTAIN_WIDTH,
  },
  emptyFilterTextMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  tableRowMinimal: {
    borderBottomColor: MINIMAL_UI.divider,
    backgroundColor: MINIMAL_UI.background,
  },
  tableRowAltMinimal: {
    backgroundColor: MINIMAL_UI.rowHover,
  },
  shortNameMinimal: {
    color: MINIMAL_UI.text,
  },
  lastAccessMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  accessCountMinimal: {
    color: MINIMAL_UI.blueDark,
  },
  historyButtonMinimal: {
    borderColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.rowHover,
    borderRadius: 10,
  },
  actionRowMinimal: {
    ...CONTAIN_WIDTH,
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  actionButtonMinimal: {
    borderRadius: 12,
  },
  reloadButtonMinimal: {
    borderColor: MINIMAL_UI.blueDark,
    backgroundColor: MINIMAL_UI.background,
  },
  reloadButtonTextMinimal: {
    color: MINIMAL_UI.blueDark,
  },
  clearButtonMinimal: {
    borderColor: '#DC2626',
    backgroundColor: '#FEF2F2',
  },
  clearButtonTextMinimal: {
    color: '#DC2626',
  },
  balloonBackdropMinimal: {
    backgroundColor: 'rgba(30, 64, 175, 0.28)',
  },
  balloonCardMinimal: {
    borderColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.background,
    ...NO_BOX_SHADOW,
  },
  balloonPointerMinimal: {
    backgroundColor: MINIMAL_UI.background,
    borderColor: MINIMAL_UI.border,
  },
  balloonTitleMinimal: {
    color: MINIMAL_UI.blueDark,
  },
  balloonSubtitleMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  sessionBlockDividerMinimal: {
    borderBottomColor: MINIMAL_UI.divider,
  },
  sessionDateTimeMinimal: {
    color: MINIMAL_UI.blueDark,
  },
  screenItemMinimal: {
    color: MINIMAL_UI.text,
  },
  emptySessionTextMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  balloonCloseButtonMinimal: {
    borderColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.background,
  },
  balloonCloseButtonTextMinimal: {
    color: MINIMAL_UI.blueDark,
  },
});

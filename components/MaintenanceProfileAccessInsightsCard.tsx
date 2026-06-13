import { CardLoadingState } from '@/components/ui/CardLoadingState';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { useMaintenanceProfileAccessInsights } from '@/hooks/useMaintenanceProfileAccessInsights';
import { formatShortName } from '@/lib/formatShortName';
import {
  listProfileScreenVisitsForSuperAdmin,
  PROFILE_ACCESS_INSIGHTS_SQL_HINT,
  type ProfileAccessInsightRow,
  type ProfileAccessSessionBlock,
} from '@/lib/profileAccessInsightsApi';
import { computeMaintenanceContentHeight, maintenancePanelStyles } from '@/lib/maintenanceCardStyles';
import { FontAwesome } from '@expo/vector-icons';
import React, { useCallback, useState } from 'react';
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
};

const ACCENT = '#FCD34D';

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
};

function ScreenHistoryBalloon({
  visible,
  profile,
  sessions,
  loading,
  error,
  rpcMissing,
  onClose,
}: ScreenHistoryBalloonProps) {
  if (!profile) {
    return null;
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.balloonBackdrop} onPress={onClose}>
        <Pressable style={styles.balloonCard} onPress={() => undefined}>
          <View style={styles.balloonPointer} />
          <Text style={styles.balloonTitle}>
            Telas visitadas — {formatShortName(profile.fullName)}
          </Text>
          <Text style={styles.balloonSubtitle}>
            Do login mais recente ao mais antigo, com as telas acessadas em cada sessão.
          </Text>

          {rpcMissing ? <Text style={styles.warningText}>{PROFILE_ACCESS_INSIGHTS_SQL_HINT}</Text> : null}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          {loading ? <CardLoadingState lines={3} compact /> : null}

          {!loading && !error && !rpcMissing ? (
            <ScrollView
              style={styles.balloonScroll}
              contentContainerStyle={styles.balloonScrollContent}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
            >
              {sessions.length === 0 ? (
                <Text style={styles.hintText}>Nenhuma tela registrada para este usuário.</Text>
              ) : (
                sessions.map((session, sessionIndex) => (
                  <View
                    key={session.accessEventId}
                    style={[
                      styles.sessionBlock,
                      sessionIndex < sessions.length - 1 && styles.sessionBlockDivider,
                    ]}
                  >
                    <Text style={styles.sessionDateTime}>
                      {formatAccessDateTimeLabel(session.accessedAt)}
                    </Text>

                    {session.screens.length === 0 ? (
                      <Text style={styles.emptySessionText}>Nenhuma tela registrada neste acesso.</Text>
                    ) : (
                      <View style={styles.screenList}>
                        {session.screens.map((screen) => (
                          <Text key={`${session.accessEventId}-${screen.visitOrder}-${screen.screenKey}`} style={styles.screenItem}>
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

          <TouchableOpacity
            style={styles.balloonCloseButton}
            onPress={onClose}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Fechar histórico de telas"
          >
            <Text style={styles.balloonCloseButtonText}>Fechar</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function MaintenanceProfileAccessInsightsCard({ isActive = true, panelHeight }: Props) {
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
    <View style={[styles.panel, { height: contentHeight }]}>
      <Text style={maintenancePanelStyles.panelTitle}>Acessos de Usuários</Text>
      <View style={maintenancePanelStyles.panelSubtitleSpacer} />

      <Text style={styles.helpText}>
        Painel exclusivo do super administrador. Lista apenas usuários com pelo menos um login
        registrado na aplicação.
      </Text>

      {rpcMissing ? <Text style={styles.warningText}>{PROFILE_ACCESS_INSIGHTS_SQL_HINT}</Text> : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <SectionLabel variant="maintenance">Filtrar lista</SectionLabel>
      <TextInput
        style={styles.searchInput}
        placeholder="Buscar por nome"
        placeholderTextColor="#64748B"
        value={searchQuery}
        onChangeText={setSearchQuery}
        autoCapitalize="words"
        autoCorrect={false}
        returnKeyType="search"
      />

      {loading ? <CardLoadingState lines={2} compact /> : null}

      {!loading && allProfiles.length > 0 ? (
        <Text style={styles.countText}>
          {hasSearch
            ? `${profiles.length} de ${allProfiles.length} usuários com acesso`
            : `${allProfiles.length} usuários com acesso registrado`}
        </Text>
      ) : null}

      {!loading && !rpcMissing && allProfiles.length === 0 ? (
        <Text style={styles.hintText}>Nenhum acesso registrado ainda.</Text>
      ) : null}

      {!loading && allProfiles.length > 0 ? (
        <View style={styles.tableSection}>
          <View style={styles.tableHeader}>
            <Text style={[styles.headerCell, styles.nameColumn]}>Nome curto</Text>
            <Text style={[styles.headerCell, styles.lastAccessColumn]}>Último acesso</Text>
            <Text style={[styles.headerCell, styles.countColumn]}>Total</Text>
            <View style={styles.historyColumn} />
          </View>

          <ScrollView
            style={styles.tableScroll}
            contentContainerStyle={styles.tableContent}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
          >
            {profiles.length === 0 ? (
              <Text style={styles.emptyFilterText}>Nenhum usuário corresponde à busca.</Text>
            ) : (
              profiles.map((profile) => (
                <View key={profile.id} style={styles.tableRow}>
                  <Text style={[styles.shortName, styles.nameColumn]} numberOfLines={2}>
                    {formatShortName(profile.fullName)}
                  </Text>
                  <Text style={[styles.lastAccess, styles.lastAccessColumn]} numberOfLines={2}>
                    {formatLastAccessLabel(profile.lastAccessAt)}
                  </Text>
                  <Text style={[styles.accessCount, styles.countColumn]}>
                    {profile.accessCount}
                  </Text>
                  <View style={styles.historyColumn}>
                    <TouchableOpacity
                      style={styles.historyButton}
                      onPress={() => void openScreenHistory(profile)}
                      activeOpacity={0.85}
                      accessibilityRole="button"
                      accessibilityLabel={`Ver telas visitadas por ${formatShortName(profile.fullName)}`}
                    >
                      <FontAwesome name="history" size={16} color={ACCENT} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        </View>
      ) : null}

      {!loading && !rpcMissing ? (
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionButton, styles.reloadButton, isBusy && styles.actionButtonDisabled]}
            onPress={() => void reloadProfiles()}
            activeOpacity={0.85}
            disabled={isBusy}
            accessibilityRole="button"
            accessibilityLabel="Atualizar lista"
          >
            <Text style={styles.reloadButtonText}>Atualizar lista</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.clearButton, isBusy && styles.actionButtonDisabled]}
            onPress={() => void handleClearHistory()}
            activeOpacity={0.85}
            disabled={isBusy}
            accessibilityRole="button"
            accessibilityLabel="Limpar histórico de acessos"
          >
            <Text style={styles.clearButtonText}>
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
    color: '#94A3B8',
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
    color: '#94A3B8',
    fontSize: 13,
    fontStyle: 'italic',
  },
  countText: {
    color: '#94A3B8',
    fontSize: 12,
    marginBottom: 8,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.35)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#F8FAFC',
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
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148, 163, 184, 0.35)',
    backgroundColor: 'rgba(15, 23, 42, 0.96)',
    zIndex: 2,
  },
  headerCell: {
    color: '#CBD5E1',
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
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148, 163, 184, 0.15)',
  },
  nameColumn: {
    flex: 1.2,
    minWidth: 96,
  },
  lastAccessColumn: {
    flex: 1.4,
    minWidth: 118,
  },
  countColumn: {
    width: 52,
    textAlign: 'right',
  },
  historyColumn: {
    width: 34,
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
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
  },
  lastAccess: {
    color: '#E2E8F0',
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
    color: '#94A3B8',
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
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
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
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 6,
  },
  balloonSubtitle: {
    color: '#94A3B8',
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
    color: '#E2E8F0',
    fontSize: 13,
    lineHeight: 18,
  },
  emptySessionText: {
    color: '#94A3B8',
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
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
  },
  balloonCloseButtonText: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '700',
  },
});

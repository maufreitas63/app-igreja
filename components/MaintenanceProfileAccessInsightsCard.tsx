import { CardLoadingState } from '@/components/ui/CardLoadingState';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { useMaintenanceProfileAccessInsights } from '@/hooks/useMaintenanceProfileAccessInsights';
import { formatShortName } from '@/lib/formatShortName';
import { PROFILE_ACCESS_INSIGHTS_SQL_HINT } from '@/lib/profileAccessInsightsApi';
import { computeMaintenanceContentHeight, maintenancePanelStyles } from '@/lib/maintenanceCardStyles';
import React from 'react';
import {
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

const formatLastAccessLabel = (value: string | null) => {
  if (!value) {
    return 'Nunca';
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
            onPress={() => void clearHistory()}
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
});

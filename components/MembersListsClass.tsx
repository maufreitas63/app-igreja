import { MINIMAL_SECTION_TITLE, MINIMAL_UI } from '@/lib/minimalUiTheme';
import type {
  MembersListsClassAudience,
  MembersListsClassEntry,
} from '@/lib/membersListsClassTypes';
import { normalizeMembersListsSearchQuery } from '@/lib/membersListsClassUtils';
import { FontAwesome } from '@expo/vector-icons';
import React from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const FILTERS: Array<{
  key: MembersListsClassAudience;
  label: string;
  accessibilityLabel: string;
}> = [
  {
    key: 'active_members',
    label: 'Membros Ativos',
    accessibilityLabel: 'Filtrar membros ativos',
  },
  {
    key: 'inactive_members',
    label: 'Membros Inativos',
    accessibilityLabel: 'Filtrar membros inativos',
  },
  {
    key: 'visitors',
    label: 'Visitantes',
    accessibilityLabel: 'Filtrar visitantes',
  },
];

const ACTION_COL_WIDTH = 40;
const ACTION_COLS_WIDTH = ACTION_COL_WIDTH * 3;
const ACTION_CELL_HEIGHT = 32;

export type MembersListsClassProps = {
  title?: string;
  audience: MembersListsClassAudience;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  entries: MembersListsClassEntry[];
  totalCount: number;
  mapEnabled?: boolean;
  canViewMapPinDetails?: boolean;
  onAudienceChange: (audience: MembersListsClassAudience) => void;
  onOpenMap?: () => void;
  onOpenFamily?: (entry: MembersListsClassEntry) => void;
  onOpenWhatsapp?: (entry: MembersListsClassEntry) => void;
  onOpenEntryMap?: (entry: MembersListsClassEntry) => void;
};

function audienceNoun(audience: MembersListsClassAudience): string {
  if (audience === 'visitors') return 'visitante';
  if (audience === 'inactive_members') return 'membro inativo';
  return 'membro ativo';
}

function audienceTitle(audience: MembersListsClassAudience, fallback: string): string {
  if (audience === 'visitors') return 'Lista de Visitantes';
  if (audience === 'inactive_members') return 'Lista de Membros Inativos';
  return fallback;
}

function emptyListMessage(audience: MembersListsClassAudience): string {
  if (audience === 'visitors') return 'Nenhum visitante encontrado.';
  if (audience === 'inactive_members') return 'Nenhum membro inativo encontrado.';
  return 'Nenhum membro ativo encontrado.';
}

function emptySearchMessage(audience: MembersListsClassAudience): string {
  if (audience === 'visitors') return 'Nenhum visitante corresponde à busca.';
  if (audience === 'inactive_members') return 'Nenhum membro inativo corresponde à busca.';
  return 'Nenhum membro ativo corresponde à busca.';
}

/** Visualização pura de Lista de Membros — extraída de dashboard.card.members_list. */
export function MembersListsClass({
  title = 'Lista de Membros',
  audience,
  loading = false,
  error = null,
  onRetry,
  searchQuery,
  onSearchQueryChange,
  entries,
  totalCount,
  mapEnabled = false,
  canViewMapPinDetails = false,
  onAudienceChange,
  onOpenMap,
  onOpenFamily,
  onOpenWhatsapp,
  onOpenEntryMap,
}: MembersListsClassProps) {
  const audienceLabel = audienceNoun(audience);
  const hasSearchQuery = Boolean(normalizeMembersListsSearchQuery(searchQuery));
  const screenTitle = audienceTitle(audience, title);

  const summaryText = hasSearchQuery
    ? `${entries.length} de ${totalCount} ${audienceLabel}${totalCount === 1 ? '' : 's'}`
    : `${totalCount} ${audienceLabel}${totalCount === 1 ? '' : 's'} em ordem alfabética`;

  return (
    <View style={styles.root}>
      <Text style={styles.title}>{screenTitle}</Text>

      <View style={styles.body}>
        <View style={styles.toolbarRow}>
          <View style={styles.filterGroup}>
            {FILTERS.map((filter) => {
              const selected = audience === filter.key;
              return (
                <TouchableOpacity
                  key={filter.key}
                  style={[styles.filterChip, selected && styles.filterChipSelected]}
                  onPress={() => onAudienceChange(filter.key)}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={filter.accessibilityLabel}
                >
                  <Text
                    style={[styles.filterChipText, selected && styles.filterChipTextSelected]}
                    numberOfLines={1}
                  >
                    {filter.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {mapEnabled ? (
            <TouchableOpacity
              style={styles.mapButton}
              onPress={onOpenMap}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Abrir mapa geral de geolocalização"
            >
              <FontAwesome name="map" size={14} color={MINIMAL_UI.icon} />
              <Text style={styles.mapButtonText} numberOfLines={1}>
                Mapa Geral
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <Text style={styles.summaryText}>{summaryText}.</Text>

        {!loading && !error ? (
          <View style={styles.searchSection}>
            <Text style={styles.sectionLabel}>
              {audience === 'visitors' ? 'Procurar visitante' : 'Procurar membro'}
            </Text>
            <View style={styles.searchRow}>
              <TextInput
                style={styles.searchInput}
                placeholder="Digite o nome..."
                placeholderTextColor={MINIMAL_UI.textMuted}
                value={searchQuery}
                onChangeText={onSearchQueryChange}
                autoCapitalize="words"
                autoCorrect={false}
              />
              {hasSearchQuery ? (
                <TouchableOpacity
                  style={styles.searchClearButton}
                  onPress={() => onSearchQueryChange('')}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel="Limpar busca"
                >
                  <FontAwesome name="times-circle" size={22} color={MINIMAL_UI.accent} />
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        ) : null}

        <View style={styles.headerRow}>
          <Text style={[styles.headerCell, styles.headerName]}>Nome</Text>
          <View style={styles.actionsHeader}>
            <Text style={[styles.headerCell, styles.headerAction]}>Base</Text>
            <Text style={[styles.headerCell, styles.headerAction]}>Zap</Text>
            <Text style={[styles.headerCell, styles.headerAction]}>GPS</Text>
          </View>
        </View>

        <View style={styles.listBox}>
          {loading ? (
            <View style={styles.loadingState}>
              <ActivityIndicator color={MINIMAL_UI.accent} size="large" />
            </View>
          ) : error ? (
            <View style={styles.messageBox}>
              <Text style={styles.errorText}>{error}</Text>
              {onRetry ? (
                <TouchableOpacity style={styles.retryButton} onPress={onRetry} activeOpacity={0.85}>
                  <Text style={styles.retryButtonText}>Atualizar lista</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : totalCount ? (
            entries.length ? (
              <ScrollView
                style={styles.listScroll}
                contentContainerStyle={styles.listContent}
                nestedScrollEnabled
                showsVerticalScrollIndicator
              >
                {entries.map((entry) => {
                  const canOpenMemberOnMap =
                    mapEnabled && canViewMapPinDetails && Boolean(entry.cep?.trim());

                  return (
                    <View key={entry.id} style={styles.row}>
                      <Text style={styles.nameText} numberOfLines={1}>
                        {entry.short_name}
                      </Text>
                      <View style={styles.actionsRow}>
                        <TouchableOpacity
                          style={styles.actionCell}
                          onPress={() => onOpenFamily?.(entry)}
                          activeOpacity={0.85}
                          accessibilityLabel={`Ver família de ${entry.short_name}`}
                        >
                          <FontAwesome name="users" size={18} color={MINIMAL_UI.icon} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.actionCell, !entry.phone && styles.actionCellDisabled]}
                          onPress={() => onOpenWhatsapp?.(entry)}
                          disabled={!entry.phone}
                          activeOpacity={0.85}
                        >
                          <FontAwesome
                            name="whatsapp"
                            size={18}
                            color={entry.phone ? '#25D366' : MINIMAL_UI.textMuted}
                          />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.actionCell, !canOpenMemberOnMap && styles.actionCellDisabled]}
                          onPress={() => onOpenEntryMap?.(entry)}
                          disabled={!canOpenMemberOnMap}
                          activeOpacity={0.85}
                          accessibilityRole="button"
                          accessibilityLabel={`Abrir mapa com localização de ${entry.short_name}`}
                        >
                          <FontAwesome
                            name="map-marker"
                            size={18}
                            color={canOpenMemberOnMap ? MINIMAL_UI.icon : MINIMAL_UI.textMuted}
                          />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            ) : (
              <Text style={styles.emptyText}>{emptySearchMessage(audience)}</Text>
            )
          ) : (
            <Text style={styles.emptyText}>{emptyListMessage(audience)}</Text>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    flex: 1,
    alignSelf: 'stretch',
    backgroundColor: MINIMAL_UI.background,
    gap: 12,
  },
  title: {
    ...MINIMAL_SECTION_TITLE,
    alignSelf: 'stretch',
  },
  body: {
    flex: 1,
    minHeight: 0,
    gap: 10,
    backgroundColor: MINIMAL_UI.background,
  },
  toolbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: 8,
  },
  filterGroup: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 6,
  },
  filterChip: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.background,
  },
  filterChipSelected: {
    borderColor: MINIMAL_UI.accent,
    backgroundColor: '#EFF6FF',
  },
  filterChipText: {
    color: MINIMAL_UI.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  filterChipTextSelected: {
    color: MINIMAL_UI.blueDark,
    fontWeight: '800',
  },
  mapButton: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.background,
  },
  mapButtonText: {
    color: MINIMAL_UI.text,
    fontSize: 11,
    fontWeight: '700',
  },
  summaryText: {
    color: MINIMAL_UI.textMuted,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  searchSection: {
    gap: 6,
  },
  sectionLabel: {
    color: MINIMAL_UI.blueDark,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.background,
    color: MINIMAL_UI.text,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  searchClearButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingBottom: 4,
    gap: 8,
  },
  headerCell: {
    color: MINIMAL_UI.textMuted,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    textAlign: 'center',
    lineHeight: 16,
  },
  headerName: {
    flex: 1,
    minWidth: 0,
    textAlign: 'left',
  },
  actionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    width: ACTION_COLS_WIDTH,
  },
  headerAction: {
    width: ACTION_COL_WIDTH,
    height: ACTION_CELL_HEIGHT,
    textAlign: 'center',
    textAlignVertical: 'center',
    includeFontPadding: false,
    lineHeight: ACTION_CELL_HEIGHT,
  },
  listBox: {
    flex: 1,
    minHeight: 0,
    borderRadius: 12,
    backgroundColor: MINIMAL_UI.background,
    overflow: 'hidden',
  },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 160,
    paddingVertical: 24,
  },
  messageBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  errorText: {
    color: MINIMAL_UI.text,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  retryButton: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.background,
  },
  retryButtonText: {
    color: MINIMAL_UI.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  listScroll: {
    flex: 1,
  },
  listContent: {
    paddingVertical: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    gap: 8,
    minHeight: ACTION_CELL_HEIGHT + 16,
  },
  nameText: {
    flex: 1,
    minWidth: 0,
    color: MINIMAL_UI.text,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    width: ACTION_COLS_WIDTH,
  },
  actionCell: {
    width: ACTION_COL_WIDTH,
    height: ACTION_CELL_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionCellDisabled: {
    opacity: 0.55,
  },
  emptyText: {
    color: MINIMAL_UI.textMuted,
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 16,
    paddingVertical: 24,
    lineHeight: 20,
  },
});

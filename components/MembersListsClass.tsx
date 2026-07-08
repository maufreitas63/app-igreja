import { VIGILANCE_SCALES_UI } from '@/lib/dashboardCardThemes';
import { MINIMAL_SECTION_TITLE } from '@/lib/minimalUiTheme';
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

const MEMBERS_LISTS_CLASS_SURFACE = '#FFFFFF';
const MEMBERS_LISTS_CLASS_ICON_COLOR = '#1B4F8A';
const MEMBERS_LISTS_ACTION_BORDER = '#3A96DD';

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
  onShowVisitors?: () => void;
  onShowMembers?: () => void;
  onOpenMap?: () => void;
  onOpenFamily?: (entry: MembersListsClassEntry) => void;
  onOpenWhatsapp?: (entry: MembersListsClassEntry) => void;
  onOpenEntryMap?: (entry: MembersListsClassEntry) => void;
};

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
  onShowVisitors,
  onShowMembers,
  onOpenMap,
  onOpenFamily,
  onOpenWhatsapp,
  onOpenEntryMap,
}: MembersListsClassProps) {
  const audienceLabel = audience === 'visitors' ? 'visitante' : 'membro';
  const hasSearchQuery = Boolean(normalizeMembersListsSearchQuery(searchQuery));
  const screenTitle = audience === 'visitors' ? 'Lista de Visitantes' : title;

  const summaryText = hasSearchQuery
    ? `${entries.length} de ${totalCount} ${audienceLabel}${totalCount === 1 ? '' : 's'}`
    : `${totalCount} ${audienceLabel}${totalCount === 1 ? '' : 's'} em ordem alfabética`;

  return (
    <View style={styles.root}>
      <Text style={styles.title}>{screenTitle}</Text>

      <View style={styles.body}>
        <View style={styles.actionButtons}>
          {audience === 'members' ? (
            <TouchableOpacity
              style={styles.secondaryActionButton}
              onPress={onShowVisitors}
              activeOpacity={0.85}
            >
              <FontAwesome name="user-o" size={16} color={MEMBERS_LISTS_CLASS_ICON_COLOR} />
              <Text style={styles.secondaryActionButtonText}>Visitantes</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.primaryActionButton}
              onPress={onShowMembers}
              activeOpacity={0.85}
            >
              <FontAwesome name="users" size={16} color={MEMBERS_LISTS_CLASS_ICON_COLOR} />
              <Text style={styles.primaryActionButtonText}>Membros</Text>
            </TouchableOpacity>
          )}
          {mapEnabled ? (
            <TouchableOpacity
              style={styles.secondaryActionButton}
              onPress={onOpenMap}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Abrir mapa geral de geolocalização"
            >
              <FontAwesome name="map" size={18} color={MEMBERS_LISTS_CLASS_ICON_COLOR} />
              <Text style={styles.secondaryActionButtonText}>Mapa Geral</Text>
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
                placeholderTextColor="#94A3B8"
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
                  <FontAwesome name="times-circle" size={22} color={VIGILANCE_SCALES_UI.accent} />
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
              <ActivityIndicator color={VIGILANCE_SCALES_UI.accent} size="large" />
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
                          <FontAwesome name="users" size={18} color={MEMBERS_LISTS_CLASS_ICON_COLOR} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.actionCell, !entry.phone && styles.actionCellDisabled]}
                          onPress={() => onOpenWhatsapp?.(entry)}
                          disabled={!entry.phone}
                          activeOpacity={0.85}
                        >
                          <FontAwesome
                            name="whatsapp"
                            size={20}
                            color={entry.phone ? '#25D366' : '#94A3B8'}
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
                            color={canOpenMemberOnMap ? MEMBERS_LISTS_CLASS_ICON_COLOR : '#94A3B8'}
                          />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            ) : (
              <Text style={styles.emptyText}>
                {audience === 'visitors'
                  ? 'Nenhum visitante corresponde à busca.'
                  : 'Nenhum membro corresponde à busca.'}
              </Text>
            )
          ) : (
            <Text style={styles.emptyText}>
              {audience === 'visitors'
                ? 'Nenhum visitante encontrado.'
                : 'Nenhum membro encontrado.'}
            </Text>
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
    backgroundColor: MEMBERS_LISTS_CLASS_SURFACE,
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
    backgroundColor: MEMBERS_LISTS_CLASS_SURFACE,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'stretch',
    width: '100%',
    gap: 8,
  },
  primaryActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: MEMBERS_LISTS_CLASS_SURFACE,
  },
  primaryActionButtonText: {
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  secondaryActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: MEMBERS_LISTS_ACTION_BORDER,
    backgroundColor: MEMBERS_LISTS_CLASS_SURFACE,
  },
  secondaryActionButtonText: {
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  summaryText: {
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  searchSection: {
    gap: 6,
  },
  sectionLabel: {
    color: VIGILANCE_SCALES_UI.accent,
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
    borderColor: 'rgba(52, 211, 153, 0.35)',
    backgroundColor: MEMBERS_LISTS_CLASS_SURFACE,
    color: VIGILANCE_SCALES_UI.accent,
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
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    textAlign: 'center',
  },
  headerName: {
    flex: 1,
    minWidth: 0,
    textAlign: 'left',
  },
  actionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    gap: 2,
  },
  headerAction: {
    width: 40,
  },
  listBox: {
    flex: 1,
    minHeight: 0,
    borderRadius: 12,
    backgroundColor: MEMBERS_LISTS_CLASS_SURFACE,
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
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  retryButton: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: MEMBERS_LISTS_CLASS_SURFACE,
  },
  retryButtonText: {
    color: VIGILANCE_SCALES_UI.accent,
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
    paddingVertical: 10,
    paddingHorizontal: 4,
    gap: 8,
  },
  nameText: {
    flex: 1,
    minWidth: 0,
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 15,
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    gap: 2,
  },
  actionCell: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  actionCellDisabled: {
    opacity: 0.55,
  },
  emptyText: {
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 16,
    paddingVertical: 24,
    lineHeight: 20,
  },
});

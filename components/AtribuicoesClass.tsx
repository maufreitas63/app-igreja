import { KnowledgeSectionTitle } from '@/components/knowledge/KnowledgeSectionTitle';
import { DropdownSelect } from '@/components/ui/DropdownSelect';
import { EnxergarSearchModal } from '@/components/ui/EnxergarSearchModal';
import { useAtribuicoes, type AtribuicaoAssignedFilter } from '@/hooks/useAtribuicoes';
import { formatShortName } from '@/lib/formatShortName';
import { KNOWLEDGE_ROUTE } from '@/lib/knowledge/routeKeys';
import { MINIMAL_SECTION_TITLE, MINIMAL_UI } from '@/lib/minimalUiTheme';
import { FontAwesome } from '@expo/vector-icons';
import React, { useCallback, useRef, useState } from 'react';
import Toast from 'react-native-toast-message';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const SIM_BG = '#16A34A';
const NAO_BG = '#DC2626';
const SIM_MUTED = '#DCFCE7';
const NAO_MUTED = '#FEE2E2';

type AssignmentChipProps = {
  value: 'sim' | 'nao';
  selected: boolean;
  onPress: () => void;
  accessibilityLabel: string;
};

function AssignmentChip({ value, selected, onPress, accessibilityLabel }: AssignmentChipProps) {
  const isSim = value === 'sim';

  return (
    <TouchableOpacity
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={accessibilityLabel}
      activeOpacity={0.85}
      onPress={onPress}
      style={[
        styles.chip,
        isSim ? styles.chipSim : styles.chipNao,
        selected && (isSim ? styles.chipSimSelected : styles.chipNaoSelected),
      ]}
    >
      <Text
        style={[
          styles.chipText,
          isSim ? styles.chipTextSim : styles.chipTextNao,
          selected && styles.chipTextSelected,
        ]}
      >
        {isSim ? 'Sim' : 'Não'}
      </Text>
    </TouchableOpacity>
  );
}

type Props = {
  isActive?: boolean;
};

export function AtribuicoesClass({ isActive = true }: Props) {
  const {
    roles,
    selectedRoleCode,
    changeRole,
    searchQuery,
    setSearchQuery,
    assignedFilter,
    toggleAssignedFilter,
    profiles,
    loadingRoles,
    loadingList,
    loadingMore,
    savingProfileId,
    error,
    loadMore,
    hasMore,
    toggleAssignment,
  } = useAtribuicoes(isActive);
  const [enxergarOpen, setEnxergarOpen] = useState(false);
  const appliedNameQueryRef = useRef('');

  const handleToggle = useCallback(
    async (profileId: string, nextAssigned: boolean) => {
      const result = await toggleAssignment(profileId, nextAssigned);

      Toast.show({
        type: result.success ? 'success' : 'error',
        text1: 'Atribuições',
        text2: result.message,
        visibilityTime: 2200,
      });
    },
    [toggleAssignment]
  );

  const handleHeaderFilter = useCallback(
    (value: Exclude<AtribuicaoAssignedFilter, null>) => {
      toggleAssignedFilter(value);
    },
    [toggleAssignedFilter]
  );

  const openNameSearch = useCallback(() => {
    appliedNameQueryRef.current = searchQuery;
    setEnxergarOpen(true);
  }, [searchQuery]);

  const closeNameSearch = useCallback(() => {
    setSearchQuery(appliedNameQueryRef.current);
    setEnxergarOpen(false);
  }, [setSearchQuery]);

  const applyNameFilter = useCallback(
    (fullName: string) => {
      appliedNameQueryRef.current = fullName;
      setSearchQuery(fullName);
      setEnxergarOpen(false);
    },
    [setSearchQuery]
  );

  const clearNameFilter = useCallback(() => {
    appliedNameQueryRef.current = '';
    setSearchQuery('');
  }, [setSearchQuery]);

  const hasNameQuery = (enxergarOpen ? appliedNameQueryRef.current : searchQuery).trim().length > 0;
  const triggerName = (enxergarOpen ? appliedNameQueryRef.current : searchQuery).trim();

  return (
    <View style={styles.root}>
      <KnowledgeSectionTitle
        title="Atribuições"
        routeKey={KNOWLEDGE_ROUTE.atribuicoes}
        titleStyle={styles.title}
      />
      <Text style={styles.hint}>Ligue ou desligue um papel operacional para cada pessoa desta igreja.</Text>

      <Text style={styles.label}>Papel</Text>
      {loadingRoles ? (
        <ActivityIndicator color={MINIMAL_UI.accent} style={styles.inlineLoader} />
      ) : (
        <DropdownSelect
          searchable
          variant="minimal"
          modalTitle="Selecionar papel"
          searchPlaceholder="Buscar papel"
          placeholder="Selecione o papel"
          options={roles.map((role) => ({ value: role.code, label: role.name }))}
          selectedValue={selectedRoleCode}
          onValueChange={changeRole}
        />
      )}

      <Text style={styles.label}>Buscar por nome</Text>
      <View style={styles.searchWrap}>
        <Pressable
          onPress={openNameSearch}
          style={[styles.search, hasNameQuery && styles.searchWithClear]}
          accessibilityRole="button"
          accessibilityLabel="Buscar por nome"
        >
          <Text
            style={[styles.searchText, !hasNameQuery && styles.searchPlaceholder]}
            numberOfLines={1}
          >
            {triggerName || 'Nome'}
          </Text>
        </Pressable>
        {hasNameQuery ? (
          <TouchableOpacity
            style={styles.searchClear}
            onPress={clearNameFilter}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Limpar nome"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <FontAwesome name="times-circle" size={18} color={MINIMAL_UI.icon} />
          </TouchableOpacity>
        ) : null}
      </View>
      <EnxergarSearchModal
        visible={enxergarOpen}
        title="Buscar por nome"
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        searchPlaceholder="Nome"
        countLabel={
          loadingList
            ? 'Carregando...'
            : `${profiles.length} nome${profiles.length === 1 ? '' : 's'}`
        }
        onClose={closeNameSearch}
        variant="minimal"
      >
        {loadingList && profiles.length === 0 ? (
          <ActivityIndicator color={MINIMAL_UI.accent} style={styles.inlineLoader} />
        ) : profiles.length === 0 ? (
          <Text style={styles.enxergarEmpty}>
            {searchQuery.trim()
              ? 'Nenhum nome corresponde à busca.'
              : 'Nenhuma pessoa encontrada nesta igreja.'}
          </Text>
        ) : (
          <>
            {profiles.map((item) => {
              const shortName = formatShortName(item.fullName, { profileId: item.id });

              return (
                <TouchableOpacity
                  key={item.id}
                  style={styles.enxergarRow}
                  onPress={() => applyNameFilter(item.fullName)}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel={`Filtrar por ${shortName}`}
                >
                  <Text style={styles.name} numberOfLines={2}>
                    {shortName}
                  </Text>
                  <Text style={item.assigned ? styles.enxergarSim : styles.enxergarNao}>
                    {item.assigned ? 'Sim' : 'Não'}
                  </Text>
                </TouchableOpacity>
              );
            })}
            {hasMore ? (
              <TouchableOpacity
                style={styles.enxergarMore}
                onPress={loadMore}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Carregar mais nomes"
              >
                {loadingMore ? (
                  <ActivityIndicator color={MINIMAL_UI.accent} />
                ) : (
                  <Text style={styles.enxergarMoreText}>Carregar mais</Text>
                )}
              </TouchableOpacity>
            ) : null}
          </>
        )}
      </EnxergarSearchModal>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={profiles}
        keyExtractor={(item) => item.id}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        stickyHeaderIndices={[0]}
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        ListHeaderComponent={
          <View style={[styles.columns, styles.listHeader]}>
            <Text style={styles.headerName}>Nome</Text>
            <View style={styles.toggle}>
              <View style={styles.chipRow}>
                <AssignmentChip
                  value="sim"
                  selected={assignedFilter === 'sim'}
                  onPress={() => handleHeaderFilter('sim')}
                  accessibilityLabel={
                    assignedFilter === 'sim' ? 'Limpar filtro Sim' : 'Filtrar por Sim'
                  }
                />
                <AssignmentChip
                  value="nao"
                  selected={assignedFilter === 'nao'}
                  onPress={() => handleHeaderFilter('nao')}
                  accessibilityLabel={
                    assignedFilter === 'nao' ? 'Limpar filtro Não' : 'Filtrar por Não'
                  }
                />
              </View>
            </View>
          </View>
        }
        ListEmptyComponent={
          loadingList ? (
            <ActivityIndicator color={MINIMAL_UI.accent} style={styles.loader} />
          ) : selectedRoleCode ? (
            <Text style={styles.empty}>
              {hasNameQuery || assignedFilter
                ? 'Nenhuma pessoa corresponde aos filtros.'
                : 'Nenhuma pessoa encontrada nesta igreja.'}
            </Text>
          ) : (
            <Text style={styles.empty}>Selecione um papel para ver a lista.</Text>
          )
        }
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator color={MINIMAL_UI.accent} style={styles.inlineLoader} />
          ) : null
        }
        renderItem={({ item }) => (
          <View style={[styles.columns, styles.row]}>
            <Text style={styles.name} numberOfLines={2}>
              {formatShortName(item.fullName, { profileId: item.id })}
            </Text>
            <View style={styles.toggle}>
              <View style={styles.chipRow}>
                <AssignmentChip
                  value="sim"
                  selected={item.assigned}
                  onPress={() => {
                    if (savingProfileId === item.id || item.assigned) {
                      return;
                    }

                    void handleToggle(item.id, true);
                  }}
                  accessibilityLabel="Sim"
                />
                <AssignmentChip
                  value="nao"
                  selected={!item.assigned}
                  onPress={() => {
                    if (savingProfileId === item.id || !item.assigned) {
                      return;
                    }

                    void handleToggle(item.id, false);
                  }}
                  accessibilityLabel="Não"
                />
              </View>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 0,
    gap: 8,
  },
  title: MINIMAL_SECTION_TITLE,
  hint: {
    color: MINIMAL_UI.textMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 4,
  },
  label: {
    color: MINIMAL_UI.textMuted,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
  },
  searchWrap: {
    position: 'relative',
    justifyContent: 'center',
  },
  search: {
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: MINIMAL_UI.background,
    justifyContent: 'center',
    minHeight: 44,
  },
  searchWithClear: {
    paddingRight: 40,
  },
  searchText: {
    color: MINIMAL_UI.text,
    fontSize: 15,
  },
  searchPlaceholder: {
    color: MINIMAL_UI.textMuted,
  },
  enxergarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: MINIMAL_UI.divider,
  },
  enxergarEmpty: {
    color: MINIMAL_UI.textMuted,
    textAlign: 'center',
    marginTop: 12,
  },
  enxergarSim: {
    color: '#15803D',
    fontSize: 13,
    fontWeight: '800',
  },
  enxergarNao: {
    color: '#B91C1C',
    fontSize: 13,
    fontWeight: '800',
  },
  enxergarMore: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  enxergarMoreText: {
    color: MINIMAL_UI.blueDark,
    fontSize: 14,
    fontWeight: '700',
  },
  searchClear: {
    position: 'absolute',
    right: 10,
    top: 0,
    bottom: 0,
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: {
    color: '#DC2626',
    textAlign: 'center',
  },
  loader: {
    marginTop: 24,
  },
  inlineLoader: {
    marginVertical: 8,
  },
  columns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
  },
  listHeader: {
    borderColor: 'transparent',
    backgroundColor: MINIMAL_UI.background,
    paddingVertical: 4,
  },
  headerName: {
    flex: 1,
    color: MINIMAL_UI.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  list: {
    flex: 1,
    minHeight: 0,
  },
  listContent: {
    gap: 8,
    paddingBottom: 16,
  },
  empty: {
    color: MINIMAL_UI.textMuted,
    textAlign: 'center',
    marginTop: 16,
  },
  row: {
    borderColor: MINIMAL_UI.border,
    borderRadius: 14,
    backgroundColor: MINIMAL_UI.background,
  },
  name: {
    flex: 1,
    color: MINIMAL_UI.blueDark,
    fontSize: 15,
    fontWeight: '700',
  },
  toggle: {
    width: 148,
    flexShrink: 0,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 6,
  },
  chip: {
    flex: 1,
    minHeight: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  chipSim: {
    borderColor: '#86EFAC',
    backgroundColor: SIM_MUTED,
  },
  chipNao: {
    borderColor: '#FCA5A5',
    backgroundColor: NAO_MUTED,
  },
  chipSimSelected: {
    borderColor: SIM_BG,
    backgroundColor: SIM_BG,
  },
  chipNaoSelected: {
    borderColor: NAO_BG,
    backgroundColor: NAO_BG,
  },
  chipText: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  chipTextSim: {
    color: '#15803D',
  },
  chipTextNao: {
    color: '#B91C1C',
  },
  chipTextSelected: {
    color: '#FFFFFF',
  },
});

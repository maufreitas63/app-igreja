import { KnowledgeSectionTitle } from '@/components/knowledge/KnowledgeSectionTitle';
import { DropdownSelect } from '@/components/ui/DropdownSelect';
import { SegmentChipRow } from '@/components/ui/SegmentChipRow';
import { useAtribuicoes } from '@/hooks/useAtribuicoes';
import { formatShortName } from '@/lib/formatShortName';
import { KNOWLEDGE_ROUTE } from '@/lib/knowledge/routeKeys';
import { MINIMAL_SECTION_TITLE, MINIMAL_UI } from '@/lib/minimalUiTheme';
import React, { useCallback } from 'react';
import Toast from 'react-native-toast-message';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

const ASSIGNMENT_OPTIONS = [
  { value: 'sim', label: 'Sim' },
  { value: 'nao', label: 'Não' },
] as const;

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
    profiles,
    loadingRoles,
    loadingList,
    loadingMore,
    savingProfileId,
    error,
    loadMore,
    toggleAssignment,
  } = useAtribuicoes(isActive);

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
      <TextInput
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="Nome"
        placeholderTextColor={MINIMAL_UI.textMuted}
        autoCorrect={false}
        autoCapitalize="none"
        style={styles.search}
        accessibilityLabel="Buscar por nome"
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {loadingList && profiles.length === 0 ? (
        <ActivityIndicator color={MINIMAL_UI.accent} style={styles.loader} />
      ) : (
        <FlatList
          data={profiles}
          keyExtractor={(item) => item.id}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            selectedRoleCode ? (
              <Text style={styles.empty}>
                {searchQuery.trim()
                  ? 'Nenhum nome corresponde à busca.'
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
            <View style={styles.row}>
              <Text style={styles.name} numberOfLines={2}>
                {formatShortName(item.fullName, { profileId: item.id })}
              </Text>
              <View style={styles.toggle}>
                <SegmentChipRow
                  compact
                  options={[...ASSIGNMENT_OPTIONS]}
                  selectedValue={item.assigned ? 'sim' : 'nao'}
                  onSelect={(value) => {
                    const nextAssigned = value === 'sim';

                    if (savingProfileId === item.id || nextAssigned === item.assigned) {
                      return;
                    }

                    void handleToggle(item.id, nextAssigned);
                  }}
                />
              </View>
            </View>
          )}
        />
      )}
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
  search: {
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: MINIMAL_UI.text,
    backgroundColor: MINIMAL_UI.background,
    fontSize: 15,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
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
});

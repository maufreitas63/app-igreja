import {
  resetDiscipleshipTrailForProfile,
  searchDiscipleshipResetCandidates,
  type DiscipleshipResetCandidate,
} from '@/lib/discipleshipTrailReset';
import { formatShortName } from '@/lib/formatShortName';
import {
  computeMaintenanceContentHeight,
  maintenancePanelStyles,
} from '@/lib/maintenanceCardStyles';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import { confirmDialog } from '@/lib/confirmDialog';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';

type Props = {
  isActive?: boolean;
  panelHeight: number;
  minimal?: boolean;
};

/** Super admin — reinicia progresso da Trilha de um usuário nesta igreja. */
export function MaintenanceDiscipleshipResetCard({
  isActive = true,
  panelHeight,
  minimal = false,
}: Props) {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<DiscipleshipResetCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);

  const load = useCallback(async (search: string) => {
    setLoading(true);
    setError(null);
    try {
      const rows = await searchDiscipleshipResetCandidates(search);
      setItems(rows);
    } catch (err) {
      setItems([]);
      setError(err instanceof Error ? err.message : 'Falha ao buscar usuários.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isActive) return;
    void load('');
  }, [isActive, load]);

  const handleSearch = () => {
    void load(query.trim());
  };

  const handleReset = async (item: DiscipleshipResetCandidate) => {
    const confirmed = await confirmDialog(
      'Resetar Trilha?',
      `Isso apaga o progresso, selos e alertas de ${formatShortName(item.full_name)} nesta igreja. `
        + 'A pessoa poderá recomeçar do passo 1. Esta ação não pode ser desfeita.',
      'Resetar',
      'Cancelar',
      { destructive: true }
    );

    if (!confirmed) return;

    setResettingId(item.profile_id);
    try {
      const message = await resetDiscipleshipTrailForProfile(item.profile_id);
      Toast.show({ type: 'success', text1: 'Trilha resetada', text2: message });
      await load(query.trim());
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Falha ao resetar',
        text2: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setResettingId(null);
    }
  };

  const contentHeight = computeMaintenanceContentHeight(panelHeight);

  return (
    <View style={[maintenancePanelStyles.panel, { height: contentHeight }]}>
      <Text style={minimal ? styles.titleMinimal : styles.title}>Resetar Trilha</Text>
      <Text style={styles.subtitle}>
        Super administrador: reinicie o progresso de um usuário nesta igreja para que ele possa
        refazer a Trilha do início.
      </Text>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar por nome ou telefone..."
          placeholderTextColor={MINIMAL_UI.textMuted}
          autoCapitalize="words"
          onSubmitEditing={handleSearch}
        />
        <TouchableOpacity style={styles.searchBtn} onPress={handleSearch} activeOpacity={0.85}>
          <Text style={styles.searchBtnText}>Buscar</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={MINIMAL_UI.accent} size="large" />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => void load(query.trim())}>
            <Text style={styles.retryText}>Tentar de novo</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          nestedScrollEnabled
          showsVerticalScrollIndicator
        >
          {items.length === 0 ? (
            <Text style={styles.emptyText}>
              Nenhum usuário encontrado. Digite um nome ou busque quem já tem progresso na Trilha.
            </Text>
          ) : (
            items.map((item) => (
              <View key={item.profile_id} style={styles.row}>
                <View style={styles.rowCopy}>
                  <Text style={styles.name}>{formatShortName(item.full_name)}</Text>
                  <Text style={styles.meta}>
                    {item.lessons_completed} lição{item.lessons_completed === 1 ? '' : 'ões'} concluída
                    {item.lessons_completed === 1 ? '' : 's'}
                    {item.has_trail_badge ? ' · selo final' : ''}
                    {item.has_alert ? ' · alerta pastoral' : ''}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.resetBtn}
                  disabled={resettingId === item.profile_id}
                  onPress={() => void handleReset(item)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.resetBtnText}>
                    {resettingId === item.profile_id ? '...' : 'Resetar'}
                  </Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    color: MINIMAL_UI.blueDark,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  titleMinimal: {
    color: MINIMAL_UI.blueDark,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    color: MINIMAL_UI.textMuted,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 10,
    fontWeight: '600',
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: MINIMAL_UI.text,
    fontSize: 14,
  },
  searchBtn: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: MINIMAL_UI.accent,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  searchBtnText: {
    color: MINIMAL_UI.accent,
    fontWeight: '800',
    fontSize: 13,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 16,
  },
  scroll: { flex: 1, minHeight: 0 },
  scrollContent: { gap: 4, paddingBottom: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: MINIMAL_UI.divider,
    paddingVertical: 12,
  },
  rowCopy: { flex: 1, minWidth: 0 },
  name: {
    color: MINIMAL_UI.text,
    fontSize: 15,
    fontWeight: '700',
  },
  meta: {
    color: MINIMAL_UI.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  resetBtn: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#B91C1C',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  resetBtnText: {
    color: '#B91C1C',
    fontSize: 12,
    fontWeight: '800',
  },
  emptyText: {
    color: MINIMAL_UI.textMuted,
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 24,
    lineHeight: 18,
  },
  errorText: {
    color: MINIMAL_UI.text,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  retryBtn: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  retryText: {
    color: MINIMAL_UI.accent,
    fontWeight: '700',
  },
});

import {
  addPttDirectoryUser,
  listPttDirectoryUsers,
  searchProfilesForPttDirectory,
  setPttDirectoryUserActive,
  type PttDirectoryPeer,
  type PttDirectoryUser,
} from '@/lib/pttApi';
import { MINIMAL_ICON, MINIMAL_TYPO, MINIMAL_UI } from '@/lib/minimalUiTheme';
import { FontAwesome } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

type Props = {
  onBack: () => void;
};

type Step = 'list' | 'add';

/** Painel minimal: lista OU inclusão — nunca as duas ao mesmo tempo. */
export function PttDirectoryAdminPanel({ onBack }: Props) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>('list');
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<PttDirectoryUser[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PttDirectoryPeer[]>([]);
  const [searching, setSearching] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setUsers(await listPttDirectoryUsers());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (step !== 'add') return;
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      setSearching(true);
      void searchProfilesForPttDirectory(q)
        .then((rows) => {
          if (!cancelled) setResults(rows);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 280);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, step]);

  const onAdd = async (profileId: string) => {
    const result = await addPttDirectoryUser(profileId);
    if (!result.ok) {
      Toast.show({ type: 'error', text1: 'Walkie', text2: result.message, visibilityTime: 5000 });
      return;
    }
    Toast.show({ type: 'success', text1: 'Incluído' });
    setQuery('');
    setResults([]);
    setStep('list');
    await reload();
  };

  const onToggle = async (profileId: string, nextActive: boolean) => {
    const result = await setPttDirectoryUserActive(profileId, nextActive);
    if (!result.ok) {
      Toast.show({ type: 'error', text1: 'Walkie', text2: result.message, visibilityTime: 5000 });
      return;
    }
    await reload();
  };

  const handleHeaderBack = () => {
    if (step === 'add') {
      setQuery('');
      setResults([]);
      setStep('list');
      return;
    }
    onBack();
  };

  return (
    <View style={[styles.panel, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <View style={styles.headerRow}>
        <Pressable
          accessibilityLabel="Voltar"
          accessibilityRole="button"
          onPress={handleHeaderBack}
          style={styles.backButton}
        >
          <FontAwesome name="chevron-left" size={MINIMAL_ICON.action} color={MINIMAL_UI.icon} />
        </Pressable>
        <Text style={styles.title}>{step === 'add' ? 'Incluir' : 'Usuários Walkie'}</Text>
        {step === 'list' ? (
          <Pressable
            accessibilityLabel="Incluir usuário"
            accessibilityRole="button"
            onPress={() => setStep('add')}
            style={styles.backButton}
          >
            <FontAwesome name="plus" size={MINIMAL_ICON.action} color={MINIMAL_UI.icon} />
          </Pressable>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      {step === 'list' ? (
        loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={MINIMAL_UI.icon} />
          </View>
        ) : (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {users.length === 0 ? (
              <Text style={styles.empty}>Nenhum usuário na lista.</Text>
            ) : (
              users.map((user) => (
                <TouchableOpacity
                  key={user.id}
                  style={styles.row}
                  onPress={() => void onToggle(user.profile_id, !user.is_active)}
                  accessibilityRole="button"
                  accessibilityLabel={`${user.is_active ? 'Desativar' : 'Ativar'} ${user.full_name}`}
                >
                  <View style={styles.itemIconWrap}>
                    <FontAwesome
                      name={user.is_active ? 'check-circle' : 'circle-o'}
                      size={MINIMAL_ICON.action}
                      color={MINIMAL_UI.icon}
                    />
                  </View>
                  <Text style={[styles.rowLabel, !user.is_active && styles.rowLabelMuted]}>
                    {user.full_name}
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        )
      ) : (
        <View style={styles.addBody}>
          <TextInput
            style={styles.input}
            value={query}
            onChangeText={setQuery}
            placeholder="Nome do perfil"
            placeholderTextColor={MINIMAL_UI.textMuted}
            autoFocus
          />
          {searching ? (
            <ActivityIndicator color={MINIMAL_UI.icon} style={styles.searchSpinner} />
          ) : null}
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {results.map((row) => (
              <TouchableOpacity
                key={row.profile_id}
                style={styles.row}
                onPress={() => void onAdd(row.profile_id)}
                accessibilityRole="button"
                accessibilityLabel={`Incluir ${row.full_name}`}
              >
                <View style={styles.itemIconWrap}>
                  <FontAwesome name="user-plus" size={MINIMAL_ICON.action} color={MINIMAL_UI.icon} />
                </View>
                <Text style={styles.rowLabel}>{row.full_name}</Text>
                <FontAwesome name="chevron-right" size={12} color={MINIMAL_UI.textMuted} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    width: '82%',
    maxWidth: 320,
    height: '100%',
    backgroundColor: MINIMAL_UI.background,
    paddingHorizontal: 16,
    paddingTop: 12,
    zIndex: 2,
    flexDirection: 'column',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  backButton: {
    padding: 4,
  },
  headerSpacer: {
    width: 26,
  },
  title: {
    ...MINIMAL_TYPO.screenTitle,
    flex: 1,
    textAlign: 'center',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: {
    flex: 1,
    minHeight: 0,
  },
  scrollContent: {
    paddingBottom: 8,
  },
  empty: {
    ...MINIMAL_TYPO.inboxPreview,
    paddingVertical: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: MINIMAL_UI.divider,
  },
  rowLabel: {
    ...MINIMAL_TYPO.menuItem,
    fontWeight: '600',
    flex: 1,
  },
  rowLabelMuted: {
    color: MINIMAL_UI.textMuted,
  },
  itemIconWrap: {
    width: 28,
    alignItems: 'center',
  },
  addBody: {
    flex: 1,
    minHeight: 0,
    gap: 8,
  },
  input: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: MINIMAL_UI.divider,
    paddingVertical: 12,
    paddingHorizontal: 4,
    color: MINIMAL_UI.text,
    fontSize: 15,
  },
  searchSpinner: {
    marginVertical: 8,
  },
});

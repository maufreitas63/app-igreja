import {
  addPttDirectoryUser,
  listPttDirectoryUsers,
  searchProfilesForPttDirectory,
  setPttDirectoryUserActive,
  type PttDirectoryPeer,
  type PttDirectoryUser,
} from '@/lib/pttApi';
import { FontAwesome } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function PttDirectoryAdminPanel({ visible, onClose }: Props) {
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
    if (visible) {
      void reload();
      setQuery('');
      setResults([]);
    }
  }, [reload, visible]);

  useEffect(() => {
    if (!visible) return;
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
  }, [query, visible]);

  const onAdd = async (profileId: string) => {
    const result = await addPttDirectoryUser(profileId);
    if (!result.ok) {
      Toast.show({ type: 'error', text1: 'Walkie', text2: result.message, visibilityTime: 5000 });
      return;
    }
    Toast.show({ type: 'success', text1: 'Usuário incluído no Walkie' });
    setQuery('');
    setResults([]);
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

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>Usuários Walkie-Talkie</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <FontAwesome name="times" size={18} color="#0F172A" />
            </Pressable>
          </View>
          <Text style={styles.hint}>
            Quem estiver ativo nesta lista pode conversar entre si pelo Walkie.
          </Text>

          <TextInput
            style={styles.input}
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar perfil para incluir…"
            placeholderTextColor="#94A3B8"
          />
          {searching ? <ActivityIndicator color="#3A96DD" /> : null}
          {results.length > 0 ? (
            <View style={styles.searchBox}>
              {results.map((row) => (
                <Pressable
                  key={row.profile_id}
                  style={styles.searchRow}
                  onPress={() => void onAdd(row.profile_id)}
                >
                  <Text style={styles.searchName}>{row.full_name}</Text>
                  <Text style={styles.addLabel}>Incluir</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          <Text style={styles.section}>Lista atual</Text>
          {loading ? (
            <ActivityIndicator color="#3A96DD" />
          ) : (
            <ScrollView style={styles.list}>
              {users.length === 0 ? (
                <Text style={styles.empty}>Nenhum usuário cadastrado.</Text>
              ) : (
                users.map((user) => (
                  <View key={user.id} style={styles.userRow}>
                    <View style={styles.userCopy}>
                      <Text style={styles.userName}>{user.full_name}</Text>
                      <Text style={styles.userMeta}>{user.is_active ? 'Ativo' : 'Inativo'}</Text>
                    </View>
                    <Pressable
                      style={[styles.toggleBtn, !user.is_active && styles.toggleBtnOff]}
                      onPress={() => void onToggle(user.profile_id, !user.is_active)}
                    >
                      <Text style={styles.toggleText}>
                        {user.is_active ? 'Desativar' : 'Ativar'}
                      </Text>
                    </Pressable>
                  </View>
                ))
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.55)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 16,
    gap: 10,
    maxHeight: '88%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  hint: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
  },
  input: {
    borderWidth: 1,
    borderColor: '#94A3B8',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#0F172A',
  },
  searchBox: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    overflow: 'hidden',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  searchName: {
    color: '#0F172A',
    fontWeight: '700',
    flex: 1,
  },
  addLabel: {
    color: '#0369A1',
    fontWeight: '800',
    fontSize: 13,
  },
  section: {
    marginTop: 4,
    fontWeight: '800',
    color: '#0F172A',
  },
  list: {
    maxHeight: 320,
  },
  empty: {
    color: '#64748B',
    paddingVertical: 16,
    textAlign: 'center',
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  userCopy: {
    flex: 1,
    minWidth: 0,
  },
  userName: {
    color: '#0F172A',
    fontWeight: '700',
  },
  userMeta: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 2,
  },
  toggleBtn: {
    backgroundColor: '#0F172A',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  toggleBtnOff: {
    backgroundColor: '#3A96DD',
  },
  toggleText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },
});

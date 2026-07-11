import {
  clearChurchRoomSettingsCache,
  createChurchRoomSetting,
  deleteChurchRoomSetting,
  type ChurchRoomKey,
  type ChurchRoomSetting,
  upsertChurchRoomSetting,
} from '@/lib/churchRoomSettings';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import {
  clearUserRoomAssignment,
  listProfilesForRoomAssignment,
  setUserRoomAssignment,
  type RoomAssignmentProfile,
} from '@/lib/userRoomAssignment';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';

type Props = {
  rooms: ChurchRoomSetting[];
  onRoomsChanged?: () => void;
};

/**
 * Painel de gestão de salas (stateless quanto à navegação).
 * Edita nomes, cria salas customizadas e atribui membros.
 */
export function ChurchRoomSettingsPanel({ rooms, onRoomsChanged }: Props) {
  const enabledRooms = useMemo(
    () => rooms.filter((row) => row.is_enabled).sort((a, b) => a.sort_order - b.sort_order),
    [rooms]
  );

  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<ChurchRoomKey | null>(null);
  const [newRoomName, setNewRoomName] = useState('');
  const [creating, setCreating] = useState(false);
  const [deletingKey, setDeletingKey] = useState<ChurchRoomKey | null>(null);
  const [search, setSearch] = useState('');
  const [profiles, setProfiles] = useState<RoomAssignmentProfile[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [busyProfileId, setBusyProfileId] = useState<string | null>(null);

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const room of rooms) {
      next[room.room_key] = room.display_label;
    }
    setDrafts(next);
  }, [rooms]);

  const loadProfiles = useCallback(async (query?: string) => {
    setLoadingProfiles(true);
    try {
      const rows = await listProfilesForRoomAssignment(query);
      setProfiles(rows);
    } catch (error) {
      console.error(error);
      Toast.show({
        type: 'error',
        text1: 'Atribuição de salas',
        text2: error instanceof Error ? error.message : 'Não foi possível listar usuários.',
      });
      setProfiles([]);
    } finally {
      setLoadingProfiles(false);
    }
  }, []);

  useEffect(() => {
    void loadProfiles();
  }, [loadProfiles]);

  const handleSaveRoom = async (roomKey: ChurchRoomKey) => {
    const label = (drafts[roomKey] ?? '').trim();
    setSavingKey(roomKey);
    try {
      const result = await upsertChurchRoomSetting({
        roomKey,
        displayLabel: label,
      });
      Toast.show({
        type: result.success ? 'success' : 'error',
        text1: 'Nome da sala',
        text2: result.message,
      });
      if (result.success) {
        clearChurchRoomSettingsCache();
        onRoomsChanged?.();
        await loadProfiles(search);
      }
    } finally {
      setSavingKey(null);
    }
  };

  const handleCreateRoom = async () => {
    const label = newRoomName.trim();
    if (label.length < 2) {
      Toast.show({
        type: 'error',
        text1: 'Nova sala',
        text2: 'Informe um nome (ex.: Homens, Mulheres, Discipulado).',
      });
      return;
    }
    setCreating(true);
    try {
      const result = await createChurchRoomSetting(label);
      Toast.show({
        type: result.success ? 'success' : 'error',
        text1: 'Nova sala',
        text2: result.message,
      });
      if (result.success) {
        setNewRoomName('');
        onRoomsChanged?.();
        await loadProfiles(search);
      }
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteRoom = async (room: ChurchRoomSetting) => {
    if (room.is_system) {
      Toast.show({
        type: 'error',
        text1: 'Sala de sistema',
        text2: 'KIDS e TEENS não podem ser excluídas.',
      });
      return;
    }
    setDeletingKey(room.room_key);
    try {
      const result = await deleteChurchRoomSetting(room.room_key);
      Toast.show({
        type: result.success ? 'success' : 'error',
        text1: 'Excluir sala',
        text2: result.message,
      });
      if (result.success) {
        onRoomsChanged?.();
        await loadProfiles(search);
      }
    } finally {
      setDeletingKey(null);
    }
  };

  const handleAssign = async (profileId: string, roomKey: ChurchRoomKey | null) => {
    setBusyProfileId(profileId);
    try {
      const result = roomKey
        ? await setUserRoomAssignment(profileId, roomKey)
        : await clearUserRoomAssignment(profileId);
      Toast.show({
        type: result.success ? 'success' : 'error',
        text1: 'Atribuição',
        text2: result.message,
      });
      if (result.success) {
        await loadProfiles(search);
      }
    } finally {
      setBusyProfileId(null);
    }
  };

  return (
    <View style={styles.root}>
      <Text style={styles.sectionTitle}>Salas da instância</Text>
      <Text style={styles.hint}>
        Cada `room_key` é único. KIDS/TEENS são de sistema (eventos). Crie salas extras como Homens,
        Mulheres, Discipulado ou Novos membros.
      </Text>

      {enabledRooms.map((room) => (
        <View key={room.room_key} style={styles.roomBlock}>
          <Text style={styles.roomKey}>
            {room.room_key}
            {room.is_system ? ' · sistema' : ''}
          </Text>
          <TextInput
            style={styles.input}
            value={drafts[room.room_key] ?? ''}
            onChangeText={(text) =>
              setDrafts((prev) => ({
                ...prev,
                [room.room_key]: text,
              }))
            }
            placeholder="Nome afetivo da sala"
            placeholderTextColor={MINIMAL_UI.textMuted}
          />
          <View style={styles.roomActions}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => void handleSaveRoom(room.room_key)}
              disabled={savingKey === room.room_key}
              accessibilityRole="button"
              accessibilityLabel={`Salvar nome da sala ${room.room_key}`}
            >
              {savingKey === room.room_key ? (
                <ActivityIndicator color={MINIMAL_UI.onDark} />
              ) : (
                <Text style={styles.primaryButtonText}>Salvar</Text>
              )}
            </TouchableOpacity>
            {!room.is_system ? (
              <TouchableOpacity
                style={styles.dangerButton}
                onPress={() => void handleDeleteRoom(room)}
                disabled={deletingKey === room.room_key}
                accessibilityRole="button"
                accessibilityLabel={`Excluir sala ${room.display_label}`}
              >
                {deletingKey === room.room_key ? (
                  <ActivityIndicator color={MINIMAL_UI.accent} />
                ) : (
                  <Text style={styles.dangerButtonText}>Excluir</Text>
                )}
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      ))}

      <Text style={[styles.sectionTitle, styles.sectionSpaced]}>Criar nova sala</Text>
      <TextInput
        style={styles.input}
        value={newRoomName}
        onChangeText={setNewRoomName}
        placeholder="Ex.: Homens, Mulheres, Discipulado, Novos membros"
        placeholderTextColor={MINIMAL_UI.textMuted}
        onSubmitEditing={() => void handleCreateRoom()}
      />
      <TouchableOpacity
        style={styles.primaryButton}
        onPress={() => void handleCreateRoom()}
        disabled={creating}
        accessibilityRole="button"
        accessibilityLabel="Criar nova sala"
      >
        {creating ? (
          <ActivityIndicator color={MINIMAL_UI.onDark} />
        ) : (
          <Text style={styles.primaryButtonText}>Criar sala</Text>
        )}
      </TouchableOpacity>

      <Text style={[styles.sectionTitle, styles.sectionSpaced]}>Atribuir membros às salas</Text>
      <Text style={styles.hint}>Opcional e editável a qualquer momento pelo Líder ou Administrador.</Text>

      <TextInput
        style={styles.input}
        value={search}
        onChangeText={setSearch}
        placeholder="Buscar por nome ou telefone"
        placeholderTextColor={MINIMAL_UI.textMuted}
        onSubmitEditing={() => void loadProfiles(search)}
        returnKeyType="search"
      />
      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={() => void loadProfiles(search)}
        accessibilityRole="button"
        accessibilityLabel="Buscar membros"
      >
        <Text style={styles.secondaryButtonText}>Buscar</Text>
      </TouchableOpacity>

      {loadingProfiles ? (
        <ActivityIndicator color={MINIMAL_UI.accent} style={styles.loader} />
      ) : profiles.length === 0 ? (
        <Text style={styles.empty}>Nenhum usuário encontrado nesta instância.</Text>
      ) : (
        profiles.map((profile) => {
          const busy = busyProfileId === profile.profile_id;
          return (
            <View key={profile.profile_id} style={styles.profileRow}>
              <View style={styles.profileCopy}>
                <Text style={styles.profileName}>{profile.full_name}</Text>
                {profile.phone ? <Text style={styles.profilePhone}>{profile.phone}</Text> : null}
                <Text style={styles.profileRoom}>
                  {profile.room_label ? `Sala: ${profile.room_label}` : 'Sem sala atribuída'}
                </Text>
              </View>
              <View style={styles.profileActions}>
                {enabledRooms.map((room) => {
                  const selected = profile.room_key === room.room_key;
                  return (
                    <TouchableOpacity
                      key={room.room_key}
                      style={[styles.chip, selected && styles.chipSelected]}
                      disabled={busy}
                      onPress={() => void handleAssign(profile.profile_id, room.room_key)}
                      accessibilityRole="button"
                      accessibilityLabel={`Atribuir ${profile.full_name} a ${room.display_label}`}
                    >
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                        {room.display_label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity
                  style={styles.clearChip}
                  disabled={busy || !profile.room_key}
                  onPress={() => void handleAssign(profile.profile_id, null)}
                  accessibilityRole="button"
                  accessibilityLabel={`Remover sala de ${profile.full_name}`}
                >
                  <Text style={styles.clearChipText}>Limpar</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    gap: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: MINIMAL_UI.blueDark,
  },
  sectionSpaced: {
    marginTop: 18,
  },
  hint: {
    fontSize: 13,
    lineHeight: 18,
    color: MINIMAL_UI.textMuted,
  },
  roomBlock: {
    gap: 8,
    marginBottom: 8,
  },
  roomKey: {
    fontSize: 12,
    fontWeight: '700',
    color: MINIMAL_UI.textMuted,
    letterSpacing: 0.4,
  },
  input: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: MINIMAL_UI.divider,
    color: MINIMAL_UI.text,
    fontSize: 15,
    paddingVertical: 10,
  },
  roomActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    alignItems: 'center',
  },
  primaryButton: {
    alignSelf: 'flex-start',
    backgroundColor: MINIMAL_UI.accent,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    minWidth: 100,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: MINIMAL_UI.onDark,
    fontWeight: '700',
    fontSize: 14,
  },
  dangerButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  dangerButtonText: {
    color: '#B91C1C',
    fontWeight: '700',
    fontSize: 13,
  },
  secondaryButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
  },
  secondaryButtonText: {
    color: MINIMAL_UI.accent,
    fontWeight: '700',
    fontSize: 14,
  },
  loader: {
    marginTop: 12,
  },
  empty: {
    color: MINIMAL_UI.textMuted,
    fontSize: 14,
    marginTop: 8,
  },
  profileRow: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: MINIMAL_UI.divider,
    gap: 8,
  },
  profileCopy: {
    gap: 2,
  },
  profileName: {
    color: MINIMAL_UI.text,
    fontSize: 15,
    fontWeight: '600',
  },
  profilePhone: {
    color: MINIMAL_UI.textMuted,
    fontSize: 12,
  },
  profileRoom: {
    color: MINIMAL_UI.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  profileActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: MINIMAL_UI.rowHover,
  },
  chipSelected: {
    backgroundColor: MINIMAL_UI.accent,
  },
  chipText: {
    color: MINIMAL_UI.text,
    fontSize: 12,
    fontWeight: '600',
  },
  chipTextSelected: {
    color: MINIMAL_UI.onDark,
  },
  clearChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  clearChipText: {
    color: MINIMAL_UI.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
});

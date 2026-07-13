import {
  clearChurchRoomSettingsCache,
  createChurchRoomSetting,
  deleteChurchRoomSetting,
  type ChurchRoomKey,
  type ChurchRoomKind,
  type ChurchRoomSetting,
  upsertChurchRoomSetting,
} from '@/lib/churchRoomSettings';
import { formatBrazilDateInput } from '@/lib/inputMasks';
import { getAgeFromBirthDate } from '@/lib/kidsTeensStatus';
import { formatDisplayDateLike, toIsoDate } from '@/lib/manageProfile/shared';
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

function roomKindLabel(kind: ChurchRoomKind): string {
  return kind === 'especial' ? 'Especial' : 'Padrão';
}

function formatProfileRoomSummary(profile: RoomAssignmentProfile): string {
  if (!profile.room_label) {
    return 'Sem sala atribuída';
  }

  const parts = [`Efetiva: ${profile.room_label}`];
  if (profile.padrao_room_label) {
    parts.push(`Padrão: ${profile.padrao_room_label}`);
  }
  if (profile.especial_room_label) {
    const until = profile.especial_end_date
      ? ` até ${formatDisplayDateLike(profile.especial_end_date)}`
      : '';
    const activeNow = profile.room_kind === 'especial';
    parts.push(
      `Especial: ${profile.especial_room_label}${until}${activeNow ? '' : ' (aguardando vigência)'}`
    );
  }
  return parts.join(' · ');
}

/**
 * Painel de gestão de salas (stateless quanto à navegação).
 * Edita nomes, cria salas padrão/especial e atribui membros.
 */
export function ChurchRoomSettingsPanel({ rooms, onRoomsChanged }: Props) {
  const enabledRooms = useMemo(
    () => rooms.filter((row) => row.is_enabled).sort((a, b) => a.sort_order - b.sort_order),
    [rooms]
  );

  const padraoRooms = useMemo(
    () => enabledRooms.filter((row) => row.room_kind !== 'especial'),
    [enabledRooms]
  );

  const especialRooms = useMemo(
    () => enabledRooms.filter((row) => row.room_kind === 'especial'),
    [enabledRooms]
  );

  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<ChurchRoomKey | null>(null);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomKind, setNewRoomKind] = useState<ChurchRoomKind>('padrao');
  const [newStartDate, setNewStartDate] = useState('');
  const [newEndDate, setNewEndDate] = useState('');
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

    let startIso: string | null = null;
    let endIso: string | null = null;
    if (newRoomKind === 'especial') {
      startIso = toIsoDate(newStartDate);
      endIso = toIsoDate(newEndDate);
      if (!startIso || !endIso) {
        Toast.show({
          type: 'error',
          text1: 'Sala especial',
          text2: 'Informe início e fim no formato DD/MM/AAAA.',
        });
        return;
      }
      if (endIso < startIso) {
        Toast.show({
          type: 'error',
          text1: 'Sala especial',
          text2: 'A data de fim deve ser igual ou posterior à de início.',
        });
        return;
      }
    }

    setCreating(true);
    try {
      const result = await createChurchRoomSetting({
        displayLabel: label,
        roomKind: newRoomKind,
        startDate: startIso,
        endDate: endIso,
      });
      Toast.show({
        type: result.success ? 'success' : 'error',
        text1: 'Nova sala',
        text2: result.message,
      });
      if (result.success) {
        setNewRoomName('');
        setNewStartDate('');
        setNewEndDate('');
        setNewRoomKind('padrao');
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

  const handleAssign = async (
    profileId: string,
    roomKey: ChurchRoomKey | null,
    assignmentKind: ChurchRoomKind
  ) => {
    setBusyProfileId(profileId);
    try {
      const result = roomKey
        ? await setUserRoomAssignment(profileId, roomKey, assignmentKind)
        : await clearUserRoomAssignment(profileId, assignmentKind);
      Toast.show({
        type: result.success ? 'success' : 'error',
        text1: 'Atribuição',
        text2: result.message,
      });
      if (result.success) {
        // Marca o chip imediatamente (mesmo padrão visual da padrão), antes do reload.
        const roomMeta = roomKey
          ? enabledRooms.find((row) => row.room_key === roomKey)
          : null;
        setProfiles((prev) =>
          prev.map((profile) => {
            if (profile.profile_id !== profileId) return profile;
            if (assignmentKind === 'padrao') {
              return {
                ...profile,
                padrao_room_key: roomKey,
                padrao_room_label: roomMeta?.display_label ?? null,
                room_key:
                  profile.room_kind === 'especial' ? profile.room_key : roomKey,
                room_label:
                  profile.room_kind === 'especial'
                    ? profile.room_label
                    : roomMeta?.display_label ?? null,
                room_kind:
                  profile.room_kind === 'especial'
                    ? profile.room_kind
                    : roomKey
                      ? 'padrao'
                      : null,
              };
            }
            return {
              ...profile,
              especial_room_key: roomKey,
              especial_room_label: roomMeta?.display_label ?? null,
              especial_end_date: roomMeta?.end_date ?? null,
            };
          })
        );
        await loadProfiles(search);
      }
    } finally {
      setBusyProfileId(null);
    }
  };

  const renderRoomBlock = (room: ChurchRoomSetting) => {
    const period =
      room.room_kind === 'especial' && room.start_date && room.end_date
        ? ` · ${formatDisplayDateLike(room.start_date)} → ${formatDisplayDateLike(room.end_date)}`
        : '';

    return (
      <View key={room.room_key} style={styles.roomBlock}>
        <Text style={styles.roomKey}>
          {room.room_key}
          {room.is_system ? ' · sistema' : ''}
          {` · ${roomKindLabel(room.room_kind)}`}
          {period}
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
    );
  };

  return (
    <View style={styles.root}>
      <Text style={styles.sectionTitle}>Salas da instância</Text>
      <Text style={styles.hint}>
        Sala padrão é permanente. Sala especial tem período e, enquanto vigente, sobrepõe a padrão
        do membro; ao terminar a data, a efetiva volta automaticamente à padrão.
      </Text>

      {padraoRooms.length > 0 ? (
        <>
          <Text style={styles.subTitle}>Padrão</Text>
          {padraoRooms.map(renderRoomBlock)}
        </>
      ) : null}

      {especialRooms.length > 0 ? (
        <>
          <Text style={[styles.subTitle, styles.sectionSpaced]}>Especial</Text>
          {especialRooms.map(renderRoomBlock)}
        </>
      ) : null}

      <Text style={[styles.sectionTitle, styles.sectionSpaced]}>Criar nova sala</Text>
      <View style={styles.kindRow}>
        {(['padrao', 'especial'] as ChurchRoomKind[]).map((kind) => {
          const selected = newRoomKind === kind;
          return (
            <TouchableOpacity
              key={kind}
              style={[styles.kindChip, selected && styles.kindChipSelected]}
              onPress={() => setNewRoomKind(kind)}
              accessibilityRole="button"
              accessibilityLabel={`Tipo ${roomKindLabel(kind)}`}
            >
              <Text style={[styles.kindChipText, selected && styles.kindChipTextSelected]}>
                {roomKindLabel(kind)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <TextInput
        style={styles.input}
        value={newRoomName}
        onChangeText={setNewRoomName}
        placeholder={
          newRoomKind === 'especial'
            ? 'Ex.: Panorama do Velho Testamento'
            : 'Ex.: Homens, Mulheres, Discipulado'
        }
        placeholderTextColor={MINIMAL_UI.textMuted}
        onSubmitEditing={() => void handleCreateRoom()}
      />
      {newRoomKind === 'especial' ? (
        <View style={styles.dateRow}>
          <View style={styles.dateField}>
            <Text style={styles.dateLabel}>Início</Text>
            <TextInput
              style={styles.input}
              value={newStartDate}
              onChangeText={(value) => setNewStartDate(formatBrazilDateInput(value))}
              placeholder="DD/MM/AAAA"
              placeholderTextColor={MINIMAL_UI.textMuted}
              keyboardType="number-pad"
            />
          </View>
          <View style={styles.dateField}>
            <Text style={styles.dateLabel}>Fim</Text>
            <TextInput
              style={styles.input}
              value={newEndDate}
              onChangeText={(value) => setNewEndDate(formatBrazilDateInput(value))}
              placeholder="DD/MM/AAAA"
              placeholderTextColor={MINIMAL_UI.textMuted}
              keyboardType="number-pad"
            />
          </View>
        </View>
      ) : null}
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
      <Text style={styles.hint}>
        Atribua a padrão e, se necessário, uma especial. A especial só vale entre as datas
        programadas.
      </Text>

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
          const age = getAgeFromBirthDate(profile.birth_date);
          return (
            <View key={profile.profile_id} style={styles.profileRow}>
              <View style={styles.profileCopy}>
                <Text style={styles.profileName}>{profile.full_name}</Text>
                <Text style={styles.profileAge}>
                  {age !== null ? `${age} anos` : 'Idade não informada'}
                </Text>
                {profile.phone ? <Text style={styles.profilePhone}>{profile.phone}</Text> : null}
                <Text style={styles.profileEvent}>
                  {profile.registered_event_name
                    ? `Inscrito em: ${profile.registered_event_name}`
                    : 'Sem inscrição em evento (hoje/próximos)'}
                </Text>
                <Text style={styles.profileRoom}>{formatProfileRoomSummary(profile)}</Text>
              </View>

              <Text style={styles.assignLabel}>Padrão</Text>
              <View style={styles.profileActions}>
                {padraoRooms.map((room) => {
                  const selected = profile.padrao_room_key === room.room_key;
                  return (
                    <TouchableOpacity
                      key={`padrao-${room.room_key}`}
                      style={[styles.chip, selected && styles.chipSelected]}
                      disabled={busy}
                      onPress={() => void handleAssign(profile.profile_id, room.room_key, 'padrao')}
                      accessibilityRole="button"
                      accessibilityLabel={`Atribuir ${profile.full_name} à padrão ${room.display_label}`}
                    >
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                        {room.display_label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity
                  style={styles.clearChip}
                  disabled={busy || !profile.padrao_room_key}
                  onPress={() => void handleAssign(profile.profile_id, null, 'padrao')}
                  accessibilityRole="button"
                  accessibilityLabel={`Remover sala padrão de ${profile.full_name}`}
                >
                  <Text style={styles.clearChipText}>Limpar padrão</Text>
                </TouchableOpacity>
              </View>

              {especialRooms.length > 0 ? (
                <>
                  <Text style={styles.assignLabel}>Especial</Text>
                  <View style={styles.profileActions}>
                    {especialRooms.map((room) => {
                      const selected = profile.especial_room_key === room.room_key;
                      return (
                        <TouchableOpacity
                          key={`especial-${room.room_key}`}
                          style={[styles.chip, selected && styles.chipSelected]}
                          disabled={busy}
                          onPress={() =>
                            void handleAssign(profile.profile_id, room.room_key, 'especial')
                          }
                          accessibilityRole="button"
                          accessibilityLabel={`Atribuir ${profile.full_name} à especial ${room.display_label}`}
                        >
                          <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                            {room.display_label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                    <TouchableOpacity
                      style={styles.clearChip}
                      disabled={busy || !profile.especial_room_key}
                      onPress={() => void handleAssign(profile.profile_id, null, 'especial')}
                      accessibilityRole="button"
                      accessibilityLabel={`Remover sala especial de ${profile.full_name}`}
                    >
                      <Text style={styles.clearChipText}>Limpar especial</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : null}
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
  subTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: MINIMAL_UI.accent,
    marginTop: 4,
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
  kindRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  kindChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: MINIMAL_UI.rowHover,
  },
  kindChipSelected: {
    backgroundColor: MINIMAL_UI.accent,
  },
  kindChipText: {
    color: MINIMAL_UI.text,
    fontSize: 13,
    fontWeight: '700',
  },
  kindChipTextSelected: {
    color: MINIMAL_UI.onDark,
  },
  dateRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dateField: {
    flex: 1,
    gap: 2,
  },
  dateLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: MINIMAL_UI.textMuted,
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
  profileAge: {
    color: MINIMAL_UI.blueDark,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  profilePhone: {
    color: MINIMAL_UI.textMuted,
    fontSize: 12,
  },
  profileEvent: {
    color: MINIMAL_UI.accent,
    fontSize: 12,
    fontWeight: '600',
  },
  profileRoom: {
    color: MINIMAL_UI.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  assignLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: MINIMAL_UI.blueDark,
    marginTop: 2,
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

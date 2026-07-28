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
import { ChurchRoomDistributionTab } from '@/components/ChurchRoomDistributionTab';
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

type PanelTab = 'salas' | 'membros' | 'distribuicao';

function roomKindLabel(kind: ChurchRoomKind): string {
  return kind === 'especial' ? 'Especial' : 'Padrão';
}

/** Uma linha curta: efetiva + (especial pendente, se houver). */
function formatProfileRoomSummary(profile: RoomAssignmentProfile): string | null {
  if (!profile.room_label && !profile.padrao_room_label && !profile.especial_room_label) {
    return null;
  }

  if (profile.room_kind === 'especial' && profile.room_label) {
    const until = profile.especial_end_date
      ? ` · até ${formatDisplayDateLike(profile.especial_end_date)}`
      : '';
    const padrao = profile.padrao_room_label ? ` · base ${profile.padrao_room_label}` : '';
    return `${profile.room_label}${until}${padrao}`;
  }

  if (profile.especial_room_label && profile.room_kind !== 'especial') {
    const base = profile.padrao_room_label ?? profile.room_label ?? '—';
    return `${base} · especial agendada: ${profile.especial_room_label}`;
  }

  return profile.room_label ?? profile.padrao_room_label;
}

function roomPeriodLabel(room: ChurchRoomSetting): string | null {
  if (room.room_kind !== 'especial' || !room.start_date || !room.end_date) {
    return null;
  }
  return `${formatDisplayDateLike(room.start_date)} → ${formatDisplayDateLike(room.end_date)}`;
}

/**
 * Painel de gestão de salas (stateless quanto à navegação).
 * Abas: Salas (CRUD), Membros (atribuição) e Distribuição (visão por sala).
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

  const [tab, setTab] = useState<PanelTab>('salas');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<ChurchRoomKey | null>(null);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomKind, setNewRoomKind] = useState<ChurchRoomKind>('padrao');
  const [newStartDate, setNewStartDate] = useState('');
  const [newEndDate, setNewEndDate] = useState('');
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [deletingKey, setDeletingKey] = useState<ChurchRoomKey | null>(null);
  const [search, setSearch] = useState('');
  const [profiles, setProfiles] = useState<RoomAssignmentProfile[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [busyProfileId, setBusyProfileId] = useState<string | null>(null);
  const [assigningBatch, setAssigningBatch] = useState(false);

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

  useEffect(() => {
    if (tab === 'distribuicao') {
      void loadProfiles('');
    }
  }, [tab, loadProfiles]);

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
        setShowCreate(false);
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
                room_key: profile.room_kind === 'especial' ? profile.room_key : roomKey,
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

  /** Toque no chip selecionado limpa a atribuição desse tipo. */
  const handleChipPress = (
    profile: RoomAssignmentProfile,
    room: ChurchRoomSetting,
    assignmentKind: ChurchRoomKind
  ) => {
    const currentKey =
      assignmentKind === 'padrao' ? profile.padrao_room_key : profile.especial_room_key;
    if (currentKey === room.room_key) {
      void handleAssign(profile.profile_id, null, assignmentKind);
      return;
    }
    void handleAssign(profile.profile_id, room.room_key, assignmentKind);
  };

  const handleBatchAssign = async (
    profileIds: string[],
    roomKey: ChurchRoomKey,
    assignmentKind: ChurchRoomKind
  ) => {
    if (!profileIds.length) return;
    setAssigningBatch(true);
    try {
      let ok = 0;
      let lastMessage = '';
      for (const profileId of profileIds) {
        const result = await setUserRoomAssignment(profileId, roomKey, assignmentKind);
        lastMessage = result.message;
        if (result.success) ok += 1;
      }
      Toast.show({
        type: ok > 0 ? 'success' : 'error',
        text1: 'Distribuição',
        text2:
          ok === profileIds.length
            ? `${ok} membro(s) alocado(s).`
            : ok > 0
              ? `${ok} de ${profileIds.length} alocados. ${lastMessage}`
              : lastMessage || 'Falha ao alocar.',
      });
      await loadProfiles(tab === 'distribuicao' ? '' : search);
    } finally {
      setAssigningBatch(false);
    }
  };

  const isRoomDirty = (room: ChurchRoomSetting) =>
    (drafts[room.room_key] ?? '').trim() !== room.display_label.trim();

  const renderRoomRow = (room: ChurchRoomSetting) => {
    const period = roomPeriodLabel(room);
    const dirty = isRoomDirty(room);
    const busySave = savingKey === room.room_key;
    const busyDelete = deletingKey === room.room_key;

    return (
      <View key={room.room_key} style={styles.roomRow}>
        <View style={styles.roomRowMain}>
          <View style={styles.roomMetaRow}>
            <Text style={styles.kindBadge}>{roomKindLabel(room.room_kind)}</Text>
            {room.is_system ? <Text style={styles.metaMuted}>sistema</Text> : null}
            {period ? <Text style={styles.metaMuted}>{period}</Text> : null}
          </View>
          <TextInput
            style={styles.roomNameInput}
            value={drafts[room.room_key] ?? ''}
            onChangeText={(text) =>
              setDrafts((prev) => ({
                ...prev,
                [room.room_key]: text,
              }))
            }
            placeholder="Nome da sala"
            placeholderTextColor={MINIMAL_UI.textMuted}
          />
        </View>
        <View style={styles.roomRowActions}>
          {dirty ? (
            <TouchableOpacity
              style={styles.textAction}
              onPress={() => void handleSaveRoom(room.room_key)}
              disabled={busySave}
              accessibilityRole="button"
              accessibilityLabel={`Salvar nome da sala ${room.room_key}`}
            >
              {busySave ? (
                <ActivityIndicator color={MINIMAL_UI.accent} size="small" />
              ) : (
                <Text style={styles.textActionPrimary}>Salvar</Text>
              )}
            </TouchableOpacity>
          ) : null}
          {!room.is_system ? (
            <TouchableOpacity
              style={styles.textAction}
              onPress={() => void handleDeleteRoom(room)}
              disabled={busyDelete}
              accessibilityRole="button"
              accessibilityLabel={`Excluir sala ${room.display_label}`}
            >
              {busyDelete ? (
                <ActivityIndicator color="#B91C1C" size="small" />
              ) : (
                <Text style={styles.textActionDanger}>Excluir</Text>
              )}
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <View style={styles.tabs} accessibilityRole="tablist">
        {(
          [
            { key: 'salas', label: 'Salas' },
            { key: 'membros', label: 'Membros' },
            { key: 'distribuicao', label: 'Distribuição' },
          ] as const
        ).map((item) => {
          const selected = tab === item.key;
          return (
            <TouchableOpacity
              key={item.key}
              style={[styles.tab, selected && styles.tabSelected]}
              onPress={() => setTab(item.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={item.label}
            >
              <Text style={[styles.tabText, selected && styles.tabTextSelected]}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {tab === 'salas' ? (
        <View style={styles.tabBody}>
          {padraoRooms.length > 0 ? (
            <View style={styles.group}>
              <Text style={styles.groupTitle}>Padrão</Text>
              <Text style={styles.groupHint}>Permanentes · base do membro</Text>
              {padraoRooms.map(renderRoomRow)}
            </View>
          ) : null}

          {especialRooms.length > 0 ? (
            <View style={styles.group}>
              <Text style={styles.groupTitle}>Especial</Text>
              <Text style={styles.groupHint}>Com período · sobrepõe a padrão enquanto vigente</Text>
              {especialRooms.map(renderRoomRow)}
            </View>
          ) : null}

          {padraoRooms.length === 0 && especialRooms.length === 0 ? (
            <Text style={styles.empty}>Nenhuma sala cadastrada ainda.</Text>
          ) : null}

          {!showCreate ? (
            <TouchableOpacity
              style={styles.createToggle}
              onPress={() => setShowCreate(true)}
              accessibilityRole="button"
              accessibilityLabel="Criar nova sala"
            >
              <Text style={styles.createToggleText}>+ Nova sala</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.createBlock}>
              <View style={styles.createHeader}>
                <Text style={styles.groupTitle}>Nova sala</Text>
                <TouchableOpacity
                  onPress={() => {
                    setShowCreate(false);
                    setNewRoomName('');
                    setNewStartDate('');
                    setNewEndDate('');
                    setNewRoomKind('padrao');
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Cancelar criação"
                >
                  <Text style={styles.textActionMuted}>Cancelar</Text>
                </TouchableOpacity>
              </View>

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
                style={styles.fieldInput}
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
                      style={styles.fieldInput}
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
                      style={styles.fieldInput}
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
                  <Text style={styles.primaryButtonText}>Criar</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      ) : null}

      {tab === 'membros' ? (
        <View style={styles.tabBody}>
          <View style={styles.searchRow}>
            <TextInput
              style={[styles.fieldInput, styles.searchInput]}
              value={search}
              onChangeText={setSearch}
              placeholder="Buscar nome ou telefone"
              placeholderTextColor={MINIMAL_UI.textMuted}
              onSubmitEditing={() => void loadProfiles(search)}
              returnKeyType="search"
            />
            <TouchableOpacity
              style={styles.searchButton}
              onPress={() => void loadProfiles(search)}
              accessibilityRole="button"
              accessibilityLabel="Buscar membros"
            >
              <Text style={styles.searchButtonText}>Buscar</Text>
            </TouchableOpacity>
          </View>

          {especialRooms.length > 0 ? (
            <Text style={styles.assignHint}>
              Toque no chip selecionado para limpar. Especial vale só no período.
            </Text>
          ) : (
            <Text style={styles.assignHint}>Toque no chip selecionado para limpar a atribuição.</Text>
          )}

          {loadingProfiles ? (
            <ActivityIndicator color={MINIMAL_UI.accent} style={styles.loader} />
          ) : profiles.length === 0 ? (
            <Text style={styles.empty}>Nenhum usuário encontrado.</Text>
          ) : (
            profiles.map((profile) => {
              const busy = busyProfileId === profile.profile_id;
              const age = getAgeFromBirthDate(profile.birth_date);
              const roomSummary = formatProfileRoomSummary(profile);
              const metaParts = [
                age !== null ? `${age} anos` : null,
                profile.phone || null,
              ].filter(Boolean);

              return (
                <View key={profile.profile_id} style={styles.profileRow}>
                  <View style={styles.profileHeader}>
                    <Text style={styles.profileName} numberOfLines={1}>
                      {profile.full_name}
                    </Text>
                    {metaParts.length > 0 ? (
                      <Text style={styles.profileMeta} numberOfLines={1}>
                        {metaParts.join(' · ')}
                      </Text>
                    ) : null}
                    {roomSummary ? (
                      <Text style={styles.profileRoom} numberOfLines={2}>
                        {roomSummary}
                      </Text>
                    ) : (
                      <Text style={styles.profileRoomMuted}>Sem sala</Text>
                    )}
                  </View>

                  <View style={styles.assignBlock}>
                    <Text style={styles.assignLabel}>Padrão</Text>
                    <View style={styles.chipRow}>
                      {padraoRooms.map((room) => {
                        const selected = profile.padrao_room_key === room.room_key;
                        return (
                          <TouchableOpacity
                            key={`padrao-${room.room_key}`}
                            style={[styles.chip, selected && styles.chipSelected]}
                            disabled={busy}
                            onPress={() => handleChipPress(profile, room, 'padrao')}
                            accessibilityRole="button"
                            accessibilityLabel={
                              selected
                                ? `Remover padrão ${room.display_label} de ${profile.full_name}`
                                : `Atribuir ${profile.full_name} à padrão ${room.display_label}`
                            }
                          >
                            <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                              {room.display_label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  {especialRooms.length > 0 ? (
                    <View style={styles.assignBlock}>
                      <Text style={styles.assignLabel}>Especial</Text>
                      <View style={styles.chipRow}>
                        {especialRooms.map((room) => {
                          const selected = profile.especial_room_key === room.room_key;
                          return (
                            <TouchableOpacity
                              key={`especial-${room.room_key}`}
                              style={[styles.chip, selected && styles.chipSelected]}
                              disabled={busy}
                              onPress={() => handleChipPress(profile, room, 'especial')}
                              accessibilityRole="button"
                              accessibilityLabel={
                                selected
                                  ? `Remover especial ${room.display_label} de ${profile.full_name}`
                                  : `Atribuir ${profile.full_name} à especial ${room.display_label}`
                              }
                            >
                              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                                {room.display_label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  ) : null}
                </View>
              );
            })
          )}
        </View>
      ) : null}

      {tab === 'distribuicao' ? (
        <View style={styles.tabBody}>
          <ChurchRoomDistributionTab
            rooms={enabledRooms}
            profiles={profiles}
            loading={loadingProfiles}
            busyProfileId={busyProfileId}
            assigningBatch={assigningBatch}
            onAssign={handleBatchAssign}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    gap: 16,
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: MINIMAL_UI.divider,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabSelected: {
    borderBottomColor: MINIMAL_UI.blueDark,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: MINIMAL_UI.textMuted,
    textAlign: 'center',
  },
  tabTextSelected: {
    color: MINIMAL_UI.blueDark,
    fontWeight: '700',
  },
  tabBody: {
    gap: 16,
  },
  group: {
    gap: 2,
  },
  groupTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: MINIMAL_UI.blueDark,
    letterSpacing: 0.2,
  },
  groupHint: {
    fontSize: 12,
    color: MINIMAL_UI.textMuted,
    marginBottom: 6,
  },
  roomRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: MINIMAL_UI.divider,
  },
  roomRowMain: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  roomMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  kindBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: MINIMAL_UI.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  metaMuted: {
    fontSize: 11,
    color: MINIMAL_UI.textMuted,
  },
  roomNameInput: {
    color: MINIMAL_UI.text,
    fontSize: 16,
    fontWeight: '600',
    paddingVertical: 2,
  },
  roomRowActions: {
    alignItems: 'flex-end',
    gap: 6,
    paddingTop: 18,
  },
  textAction: {
    minHeight: 28,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  textActionPrimary: {
    color: MINIMAL_UI.accent,
    fontWeight: '700',
    fontSize: 13,
  },
  textActionDanger: {
    color: '#B91C1C',
    fontWeight: '600',
    fontSize: 13,
  },
  textActionMuted: {
    color: MINIMAL_UI.textMuted,
    fontWeight: '600',
    fontSize: 13,
  },
  createToggle: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
  },
  createToggleText: {
    color: MINIMAL_UI.accent,
    fontWeight: '700',
    fontSize: 14,
  },
  createBlock: {
    gap: 12,
    paddingTop: 4,
  },
  createHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  kindRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  kindChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.background,
  },
  kindChipSelected: {
    borderColor: MINIMAL_UI.blueDark,
    backgroundColor: MINIMAL_UI.blueDark,
  },
  kindChipText: {
    color: MINIMAL_UI.text,
    fontSize: 13,
    fontWeight: '600',
  },
  kindChipTextSelected: {
    color: MINIMAL_UI.onDark,
  },
  fieldInput: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: MINIMAL_UI.divider,
    color: MINIMAL_UI.text,
    fontSize: 15,
    paddingVertical: 10,
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
    backgroundColor: MINIMAL_UI.blueDark,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 10,
    minWidth: 96,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: MINIMAL_UI.onDark,
    fontWeight: '700',
    fontSize: 14,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  searchInput: {
    flex: 1,
  },
  searchButton: {
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  searchButtonText: {
    color: MINIMAL_UI.accent,
    fontWeight: '700',
    fontSize: 14,
  },
  assignHint: {
    fontSize: 12,
    lineHeight: 16,
    color: MINIMAL_UI.textMuted,
    marginTop: -8,
  },
  loader: {
    marginTop: 12,
  },
  empty: {
    color: MINIMAL_UI.textMuted,
    fontSize: 14,
    marginTop: 4,
  },
  profileRow: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: MINIMAL_UI.divider,
    gap: 10,
  },
  profileHeader: {
    gap: 2,
  },
  profileName: {
    color: MINIMAL_UI.blueDark,
    fontSize: 15,
    fontWeight: '700',
  },
  profileMeta: {
    color: MINIMAL_UI.textMuted,
    fontSize: 12,
  },
  profileRoom: {
    color: MINIMAL_UI.accent,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  profileRoomMuted: {
    color: MINIMAL_UI.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  assignBlock: {
    gap: 6,
  },
  assignLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: MINIMAL_UI.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.background,
  },
  chipSelected: {
    borderColor: MINIMAL_UI.blueDark,
    backgroundColor: MINIMAL_UI.blueDark,
  },
  chipText: {
    color: MINIMAL_UI.text,
    fontSize: 12,
    fontWeight: '600',
  },
  chipTextSelected: {
    color: MINIMAL_UI.onDark,
  },
});

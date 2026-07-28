import type { ChurchRoomKey, ChurchRoomKind, ChurchRoomSetting } from '@/lib/churchRoomSettings';
import { getAgeFromBirthDate } from '@/lib/kidsTeensStatus';
import { MINIMAL_ICON, MINIMAL_UI } from '@/lib/minimalUiTheme';
import type { RoomAssignmentProfile } from '@/lib/userRoomAssignment';
import { MaterialIcons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

type Props = {
  rooms: ChurchRoomSetting[];
  profiles: RoomAssignmentProfile[];
  loading: boolean;
  busyProfileId: string | null;
  assigningBatch?: boolean;
  onAssign: (
    profileIds: string[],
    roomKey: ChurchRoomKey,
    assignmentKind: ChurchRoomKind
  ) => void | Promise<void>;
};

function roomKindLabel(kind: ChurchRoomKind): string {
  return kind === 'especial' ? 'Especial' : 'Padrão';
}

function isUnallocated(profile: RoomAssignmentProfile): boolean {
  return !profile.padrao_room_key && !profile.especial_room_key;
}

function isInRoom(profile: RoomAssignmentProfile, room: ChurchRoomSetting): boolean {
  if (room.room_kind === 'especial') {
    return profile.especial_room_key === room.room_key;
  }
  return profile.padrao_room_key === room.room_key;
}

/**
 * Aba Distribuição: salas em linhas expansíveis + não alocados com checkbox.
 */
export function ChurchRoomDistributionTab({
  rooms,
  profiles,
  loading,
  busyProfileId,
  assigningBatch = false,
  onAssign,
}: Props) {
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});

  const sortedRooms = useMemo(
    () => [...rooms].sort((a, b) => a.sort_order - b.sort_order || a.display_label.localeCompare(b.display_label)),
    [rooms]
  );

  const membersByRoom = useMemo(() => {
    const map = new Map<string, RoomAssignmentProfile[]>();
    for (const room of sortedRooms) {
      map.set(
        room.room_key,
        profiles
          .filter((profile) => isInRoom(profile, room))
          .sort((a, b) => a.full_name.localeCompare(b.full_name, 'pt-BR'))
      );
    }
    return map;
  }, [profiles, sortedRooms]);

  const unallocated = useMemo(
    () =>
      profiles
        .filter(isUnallocated)
        .sort((a, b) => a.full_name.localeCompare(b.full_name, 'pt-BR')),
    [profiles]
  );

  const selectedList = useMemo(
    () => unallocated.filter((profile) => selectedIds[profile.profile_id]),
    [selectedIds, unallocated]
  );

  const toggleExpanded = (key: string) => {
    setExpandedKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleSelected = (profileId: string) => {
    setSelectedIds((prev) => ({ ...prev, [profileId]: !prev[profileId] }));
  };

  const handleAssignSelected = async (room: ChurchRoomSetting) => {
    const ids = selectedList.map((profile) => profile.profile_id);
    if (!ids.length) return;
    await onAssign(ids, room.room_key, room.room_kind);
    setSelectedIds({});
  };

  const renderMemberLine = (profile: RoomAssignmentProfile) => {
    const age = getAgeFromBirthDate(profile.birth_date);
    const meta = [age !== null ? `${age} anos` : null, profile.phone || null]
      .filter(Boolean)
      .join(' · ');

    return (
      <View key={profile.profile_id} style={styles.memberLine}>
        <Text style={styles.memberName} numberOfLines={1}>
          {profile.full_name}
        </Text>
        {meta ? (
          <Text style={styles.memberMeta} numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
      </View>
    );
  };

  const renderAccordion = (
    key: string,
    title: string,
    subtitle: string | null,
    count: number,
    children: React.ReactNode
  ) => {
    const expanded = !!expandedKeys[key];
    return (
      <View key={key} style={styles.accordion}>
        <TouchableOpacity
          style={styles.accordionHeader}
          onPress={() => toggleExpanded(key)}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={`${title}, ${count} membros`}
        >
          <View style={styles.accordionHeaderText}>
            <Text style={styles.accordionTitle} numberOfLines={1}>
              {title}
              <Text style={styles.accordionCount}> ({count})</Text>
            </Text>
            {subtitle ? (
              <Text style={styles.accordionSubtitle} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
          <MaterialIcons
            name={expanded ? 'expand-less' : 'expand-more'}
            size={MINIMAL_ICON.chevron}
            color={MINIMAL_UI.blueDark}
          />
        </TouchableOpacity>
        {expanded ? <View style={styles.accordionBody}>{children}</View> : null}
      </View>
    );
  };

  if (loading) {
    return <ActivityIndicator color={MINIMAL_UI.accent} style={styles.loader} />;
  }

  return (
    <View style={styles.root}>
      <Text style={styles.hint}>
        Toque em uma sala para ver os membros. Em Não alocados, marque e escolha a sala de destino.
      </Text>

      {sortedRooms.map((room) => {
        const members = membersByRoom.get(room.room_key) ?? [];
        const period =
          room.room_kind === 'especial' && room.start_date && room.end_date
            ? `${roomKindLabel(room.room_kind)} · período`
            : roomKindLabel(room.room_kind);

        return renderAccordion(
          room.room_key,
          room.display_label,
          period,
          members.length,
          members.length === 0 ? (
            <Text style={styles.empty}>Nenhum membro nesta sala.</Text>
          ) : (
            members.map(renderMemberLine)
          )
        );
      })}

      {renderAccordion(
        '__unallocated__',
        'Não alocados',
        'Sem sala padrão nem especial',
        unallocated.length,
        <>
          {unallocated.length === 0 ? (
            <Text style={styles.empty}>Todos os membros estão alocados.</Text>
          ) : (
            unallocated.map((profile) => {
              const checked = !!selectedIds[profile.profile_id];
              const busy = busyProfileId === profile.profile_id || assigningBatch;
              const age = getAgeFromBirthDate(profile.birth_date);
              const meta = [age !== null ? `${age} anos` : null, profile.phone || null]
                .filter(Boolean)
                .join(' · ');

              return (
                <View key={profile.profile_id} style={styles.unallocatedRow}>
                  <TouchableOpacity
                    style={[styles.checkbox, checked && styles.checkboxChecked]}
                    onPress={() => toggleSelected(profile.profile_id)}
                    disabled={busy}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked, disabled: busy }}
                    accessibilityLabel={`Selecionar ${profile.full_name}`}
                  >
                    {checked ? <Text style={styles.checkmark}>✓</Text> : null}
                  </TouchableOpacity>
                  <View style={styles.unallocatedInfo}>
                    <Text style={styles.memberName} numberOfLines={1}>
                      {profile.full_name}
                    </Text>
                    {meta ? (
                      <Text style={styles.memberMeta} numberOfLines={1}>
                        {meta}
                      </Text>
                    ) : null}
                  </View>
                </View>
              );
            })
          )}

          {selectedList.length > 0 ? (
            <View style={styles.assignPanel}>
              <Text style={styles.assignLabel}>
                Atribuir {selectedList.length}{' '}
                {selectedList.length === 1 ? 'selecionado' : 'selecionados'} a:
              </Text>
              <View style={styles.chipRow}>
                {sortedRooms.map((room) => (
                  <TouchableOpacity
                    key={`assign-${room.room_key}`}
                    style={styles.chip}
                    disabled={assigningBatch}
                    onPress={() => void handleAssignSelected(room)}
                    accessibilityRole="button"
                    accessibilityLabel={`Atribuir selecionados a ${room.display_label}`}
                  >
                    <Text style={styles.chipText}>{room.display_label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {assigningBatch ? (
                <ActivityIndicator color={MINIMAL_UI.accent} style={styles.batchLoader} />
              ) : null}
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 8,
  },
  hint: {
    fontSize: 12,
    lineHeight: 16,
    color: MINIMAL_UI.textMuted,
    marginBottom: 4,
  },
  loader: {
    marginTop: 12,
  },
  accordion: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: MINIMAL_UI.divider,
  },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: MINIMAL_UI.rowHover,
    paddingHorizontal: 8,
  },
  accordionHeaderText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  accordionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: MINIMAL_UI.blueDark,
  },
  accordionCount: {
    fontWeight: '600',
    color: MINIMAL_UI.textMuted,
  },
  accordionSubtitle: {
    fontSize: 11,
    color: MINIMAL_UI.textMuted,
  },
  accordionBody: {
    paddingVertical: 8,
    paddingHorizontal: 8,
    gap: 6,
    backgroundColor: MINIMAL_UI.background,
  },
  memberLine: {
    paddingVertical: 6,
    paddingHorizontal: 4,
    gap: 2,
  },
  memberName: {
    fontSize: 14,
    fontWeight: '600',
    color: MINIMAL_UI.text,
  },
  memberMeta: {
    fontSize: 12,
    color: MINIMAL_UI.textMuted,
  },
  empty: {
    color: MINIMAL_UI.textMuted,
    fontSize: 13,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  unallocatedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  unallocatedInfo: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: MINIMAL_UI.icon,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  checkboxChecked: {
    backgroundColor: MINIMAL_UI.icon,
  },
  checkmark: {
    color: MINIMAL_UI.background,
    fontSize: 14,
    fontWeight: '900',
  },
  assignPanel: {
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: MINIMAL_UI.divider,
    gap: 8,
  },
  assignLabel: {
    fontSize: 12,
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
  chipText: {
    color: MINIMAL_UI.text,
    fontSize: 12,
    fontWeight: '600',
  },
  batchLoader: {
    marginTop: 4,
  },
});

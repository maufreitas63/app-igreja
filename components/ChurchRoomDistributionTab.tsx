import { DropdownSelect } from '@/components/ui/DropdownSelect';
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
 * Aba Distribuição: salas em linhas expansíveis + não alocados com dropdown de sala.
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

  const sortedRooms = useMemo(
    () =>
      [...rooms].sort(
        (a, b) => a.sort_order - b.sort_order || a.display_label.localeCompare(b.display_label)
      ),
    [rooms]
  );

  const roomOptions = useMemo(
    () =>
      sortedRooms.map((room) => ({
        value: room.room_key,
        label:
          room.room_kind === 'especial'
            ? `${room.display_label} (especial)`
            : room.display_label,
      })),
    [sortedRooms]
  );

  const roomByKey = useMemo(() => {
    const map = new Map<string, ChurchRoomSetting>();
    for (const room of sortedRooms) {
      map.set(room.room_key, room);
    }
    return map;
  }, [sortedRooms]);

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

  const toggleExpanded = (key: string) => {
    setExpandedKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handlePickRoom = (profileId: string, roomKey: string) => {
    const room = roomByKey.get(roomKey);
    if (!room) return;
    void onAssign([profileId], room.room_key, room.room_kind);
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
        Toque em uma sala para ver os membros. Em Não alocados, escolha a sala no dropdown ao lado
        do nome.
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
        unallocated.length === 0 ? (
          <Text style={styles.empty}>Todos os membros estão alocados.</Text>
        ) : (
          unallocated.map((profile) => {
            const busy = busyProfileId === profile.profile_id || assigningBatch;
            const age = getAgeFromBirthDate(profile.birth_date);
            const meta = [age !== null ? `${age} anos` : null, profile.phone || null]
              .filter(Boolean)
              .join(' · ');

            return (
              <View key={profile.profile_id} style={styles.unallocatedRow}>
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
                <View style={styles.dropdownWrap}>
                  {busy ? (
                    <ActivityIndicator color={MINIMAL_UI.accent} size="small" />
                  ) : (
                    <DropdownSelect
                      options={roomOptions}
                      selectedValue=""
                      onValueChange={(roomKey) => handlePickRoom(profile.profile_id, roomKey)}
                      modalTitle={`Alocar ${profile.full_name}`}
                      placeholder="Sala"
                      variant="minimal"
                      size="compact"
                      disabled={busy || roomOptions.length === 0}
                      style={styles.dropdown}
                      triggerTextStyle={styles.dropdownText}
                      triggerIconColor={MINIMAL_UI.icon}
                    />
                  )}
                </View>
              </View>
            );
          })
        )
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
  dropdownWrap: {
    flexShrink: 0,
    minWidth: 120,
    maxWidth: '46%',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  dropdown: {
    alignSelf: 'stretch',
    minWidth: 120,
  },
  dropdownText: {
    color: MINIMAL_UI.blueDark,
    fontSize: 12,
    fontWeight: '700',
  },
});

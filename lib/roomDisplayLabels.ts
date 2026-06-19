import {
  buildKidsRoomBadgeLabel,
  buildKidsRoomLabel,
  buildTeensRoomBadgeLabel,
  buildTeensRoomLabel,
  DEFAULT_ENTITY_PREFIX,
  KIDS_ROOM_DISPLAY_LABEL,
  TEENS_ROOM_DISPLAY_LABEL,
} from '@/lib/entityPrefixCore';

export {
  KIDS_ROOM_DISPLAY_LABEL,
  TEENS_ROOM_DISPLAY_LABEL,
  buildKidsRoomBadgeLabel,
  buildKidsRoomLabel,
  buildTeensRoomBadgeLabel,
  buildTeensRoomLabel,
};

/** Converte rótulos legados (Kids/Teens/KIDS/TEENS) para Infantil/Jovens na exibição. */
export function mapLegacyRoomDisplayLabel(value: string): string {
  if (!value?.trim()) {
    return value;
  }

  return value
    .replace(/\bKIDS\b/g, KIDS_ROOM_DISPLAY_LABEL)
    .replace(/\bKids\b/g, KIDS_ROOM_DISPLAY_LABEL)
    .replace(/\bTEENS\b/g, TEENS_ROOM_DISPLAY_LABEL)
    .replace(/\bTeens\b/g, TEENS_ROOM_DISPLAY_LABEL);
}

export function buildRoomDisplayLabels(prefix: string = DEFAULT_ENTITY_PREFIX) {
  const kidsRoomLabel = buildKidsRoomLabel(prefix);
  const teensRoomLabel = buildTeensRoomLabel(prefix);
  const kidsRoomBadgeLabel = buildKidsRoomBadgeLabel(prefix);
  const teensRoomBadgeLabel = buildTeensRoomBadgeLabel(prefix);

  return {
    prefix,
    kidsRoomLabel: mapLegacyRoomDisplayLabel(kidsRoomLabel),
    teensRoomLabel: mapLegacyRoomDisplayLabel(teensRoomLabel),
    kidsRoomBadgeLabel: mapLegacyRoomDisplayLabel(kidsRoomBadgeLabel),
    teensRoomBadgeLabel: mapLegacyRoomDisplayLabel(teensRoomBadgeLabel),
  };
}

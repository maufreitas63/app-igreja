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

export type RoomDisplayLabelOverrides = {
  kidsDisplayLabel?: string | null;
  teensDisplayLabel?: string | null;
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

function withCustomLabel(prefix: string, label: string): string {
  const safeLabel = label.trim() || '';
  const trimmedPrefix = (prefix ?? '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (!safeLabel) {
    return trimmedPrefix;
  }
  return trimmedPrefix ? `${trimmedPrefix} ${safeLabel}` : safeLabel;
}

export function buildRoomDisplayLabels(
  prefix: string = DEFAULT_ENTITY_PREFIX,
  overrides?: RoomDisplayLabelOverrides
) {
  const kidsBase = overrides?.kidsDisplayLabel?.trim() || KIDS_ROOM_DISPLAY_LABEL;
  const teensBase = overrides?.teensDisplayLabel?.trim() || TEENS_ROOM_DISPLAY_LABEL;

  const kidsRoomLabel = withCustomLabel(prefix, kidsBase);
  const teensRoomLabel = withCustomLabel(prefix, teensBase);
  const kidsRoomBadgeLabel = kidsRoomLabel;
  const teensRoomBadgeLabel = teensRoomLabel;

  return {
    prefix,
    kidsRoomLabel: mapLegacyRoomDisplayLabel(kidsRoomLabel),
    teensRoomLabel: mapLegacyRoomDisplayLabel(teensRoomLabel),
    kidsRoomBadgeLabel: mapLegacyRoomDisplayLabel(kidsRoomBadgeLabel),
    teensRoomBadgeLabel: mapLegacyRoomDisplayLabel(teensRoomBadgeLabel),
    kidsDisplayLabel: kidsBase,
    teensDisplayLabel: teensBase,
  };
}

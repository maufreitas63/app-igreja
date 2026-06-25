import { getAppParameterValue } from '@/lib/appParameters';
import { getEventCalendarDate } from '@/lib/eventDate';
import { formatShortName } from '@/lib/formatShortName';
import { fetchMaintenanceScaleLogs } from '@/lib/maintenanceScalesApi';
import { supabase } from '@/lib/supabase';

export const ROOM_SERVIDOR_SCALE_PARAMETER = {
  kids: 'escala_codigo_servidor_kids',
  teens: 'escala_codigo_servidor_teens',
} as const;

/** Chaves legadas em `app_parameters` (compatibilidade). */
const LEGACY_ROOM_SERVIDOR_SCALE_PARAMETER = {
  kids: 'escala_codigo_monitor_kids',
  teens: 'escala_codigo_monitor_teens',
} as const;

export type RoomServidorRoom = 'KIDS' | 'TEENS';

export type RoomServidorAssignment = {
  room: RoomServidorRoom;
  volunteerName: string;
};

const normalizePersonName = (value: string | null | undefined) =>
  (value ?? '')
    .trim()
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const normalizeScaleToken = (value: string | null | undefined) =>
  normalizePersonName(value).replace(/[^a-z0-9]+/g, '');

const includesRoomRoleToken = (normalizedName: string) =>
  normalizedName.includes('servidor') || normalizedName.includes('monitor');

export const personNamesMatch = (
  profileOrVolunteerName: string | null | undefined,
  volunteerName: string | null | undefined
) => {
  const left = normalizePersonName(profileOrVolunteerName);
  const right = normalizePersonName(volunteerName);

  if (!left || !right) {
    return false;
  }

  if (left === right) {
    return true;
  }

  const leftShort = normalizePersonName(formatShortName(profileOrVolunteerName));
  const rightShort = normalizePersonName(formatShortName(volunteerName));

  return leftShort === right || left === rightShort || leftShort === rightShort;
};

const matchesConfiguredScaleCode = (
  scaleCode: string,
  configuredCode: string | null | undefined
) => {
  const normalizedConfigured = normalizeScaleToken(configuredCode);
  const normalizedScale = normalizeScaleToken(scaleCode);

  if (!normalizedConfigured || !normalizedScale) {
    return false;
  }

  return normalizedScale === normalizedConfigured;
};

export const isKidsRoomServidorScale = (
  scaleName: string,
  scaleCode: string,
  configuredKidsCode?: string | null
) => {
  if (matchesConfiguredScaleCode(scaleCode, configuredKidsCode)) {
    return true;
  }

  const normalizedName = normalizePersonName(scaleName);
  const normalizedCode = normalizePersonName(scaleCode);

  return (
    (includesRoomRoleToken(normalizedName) && normalizedName.includes('kids'))
    || (normalizedName.includes('sala') && normalizedName.includes('kids'))
    || (includesRoomRoleToken(normalizedName) && normalizedName.includes('infantil'))
    || (normalizedName.includes('sala') && normalizedName.includes('infantil'))
    || normalizedName.includes('ibn kids')
    || normalizedName.includes('ibnkids')
    || normalizedName.includes('ibn infantil')
    || normalizedName.includes('ibninfantil')
    || normalizedCode.includes('servidor_kids')
    || normalizedCode.includes('monitor_kids')
    || normalizedCode.includes('sala_kids')
    || normalizedCode.includes('ibn_kids')
    || normalizedCode === 'servidor_ibn_kids'
    || normalizedCode === 'monitor_ibn_kids'
  );
};

export const isTeensRoomServidorScale = (
  scaleName: string,
  scaleCode: string,
  configuredTeensCode?: string | null
) => {
  if (matchesConfiguredScaleCode(scaleCode, configuredTeensCode)) {
    return true;
  }

  const normalizedName = normalizePersonName(scaleName);
  const normalizedCode = normalizePersonName(scaleCode);

  return (
    (includesRoomRoleToken(normalizedName) && normalizedName.includes('teens'))
    || (normalizedName.includes('sala') && normalizedName.includes('teens'))
    || (includesRoomRoleToken(normalizedName) && normalizedName.includes('jovens'))
    || (normalizedName.includes('sala') && normalizedName.includes('jovens'))
    || normalizedName.includes('ibn teens')
    || normalizedName.includes('ibnteens')
    || normalizedName.includes('ibn jovens')
    || normalizedName.includes('ibnjovens')
    || normalizedCode.includes('servidor_teens')
    || normalizedCode.includes('monitor_teens')
    || normalizedCode.includes('sala_teens')
    || normalizedCode.includes('ibn_teens')
    || normalizedCode === 'servidor_ibn_teens'
    || normalizedCode === 'monitor_ibn_teens'
  );
};

const isRoomServidorScale = (
  room: RoomServidorRoom,
  scaleName: string,
  scaleCode: string,
  configuredCodes: { kids: string | null; teens: string | null }
) =>
  room === 'KIDS'
    ? isKidsRoomServidorScale(scaleName, scaleCode, configuredCodes.kids)
    : isTeensRoomServidorScale(scaleName, scaleCode, configuredCodes.teens);

export const formatRoomServidorNames = (names: string[]) => {
  const unique = Array.from(
    new Set(
      names
        .map((name) => formatShortName(name))
        .filter((name) => Boolean(name) && name !== '—')
    )
  );

  if (!unique.length) {
    return 'Nenhum servidor escalado';
  }

  return unique.join(', ');
};

async function readScaleParameter(primaryKey: string, legacyKey: string) {
  const primary = (await getAppParameterValue(primaryKey))?.trim();
  if (primary) {
    return primary;
  }

  return (await getAppParameterValue(legacyKey))?.trim() || null;
}

export async function loadRoomServidorScaleCodes() {
  const [kidsCode, teensCode] = await Promise.all([
    readScaleParameter(
      ROOM_SERVIDOR_SCALE_PARAMETER.kids,
      LEGACY_ROOM_SERVIDOR_SCALE_PARAMETER.kids
    ),
    readScaleParameter(
      ROOM_SERVIDOR_SCALE_PARAMETER.teens,
      LEGACY_ROOM_SERVIDOR_SCALE_PARAMETER.teens
    ),
  ]);

  return {
    kids: kidsCode,
    teens: teensCode,
  };
}

export async function fetchRoomServidorAssignmentsForDate(
  serviceDate: string | null | undefined
): Promise<RoomServidorAssignment[]> {
  const normalizedDate = getEventCalendarDate(serviceDate);

  if (!normalizedDate) {
    return [];
  }

  const [configuredCodes, scaleLogs] = await Promise.all([
    loadRoomServidorScaleCodes(),
    fetchMaintenanceScaleLogs(),
  ]);

  return scaleLogs
    .filter((entry) => entry.serviceDate === normalizedDate)
    .flatMap((entry) => {
      const assignments: RoomServidorAssignment[] = [];

      if (
        isRoomServidorScale(
          'KIDS',
          entry.scaleTypeName,
          entry.scaleTypeCode,
          configuredCodes
        )
      ) {
        assignments.push({ room: 'KIDS', volunteerName: entry.volunteerName });
      }

      if (
        isRoomServidorScale(
          'TEENS',
          entry.scaleTypeName,
          entry.scaleTypeCode,
          configuredCodes
        )
      ) {
        assignments.push({ room: 'TEENS', volunteerName: entry.volunteerName });
      }

      return assignments;
    });
}

export const groupRoomServidorNames = (assignments: RoomServidorAssignment[]) => ({
  kids: assignments
    .filter((entry) => entry.room === 'KIDS')
    .map((entry) => entry.volunteerName),
  teens: assignments
    .filter((entry) => entry.room === 'TEENS')
    .map((entry) => entry.volunteerName),
});

export const canProfileCheckInRoom = (
  profileName: string | null | undefined,
  room: RoomServidorRoom,
  assignments: RoomServidorAssignment[]
) =>
  assignments
    .filter((entry) => entry.room === room)
    .some((entry) => personNamesMatch(profileName, entry.volunteerName));

export async function checkSessionIsRoomServidorSuperAdmin(profileId: string | null | undefined) {
  if (!profileId?.trim()) {
    return false;
  }

  const { data, error } = await supabase.rpc('is_super_admin_profile', {
    p_profile_id: profileId.trim(),
  });

  if (error) {
    return false;
  }

  return data === true;
}

import { getAppParameterValue } from '@/lib/appParameters';
import { getEventCalendarDate } from '@/lib/eventDate';
import { formatShortName } from '@/lib/formatShortName';
import { fetchMaintenanceScaleLogs } from '@/lib/maintenanceScalesApi';
import { supabase } from '@/lib/supabase';

export const ROOM_MONITOR_SCALE_PARAMETER = {
  kids: 'escala_codigo_monitor_kids',
  teens: 'escala_codigo_monitor_teens',
} as const;

export type RoomMonitorRoom = 'KIDS' | 'TEENS';

export type RoomMonitorAssignment = {
  room: RoomMonitorRoom;
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

export const isKidsRoomMonitorScale = (
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
    (normalizedName.includes('monitor') && normalizedName.includes('kids'))
    || (normalizedName.includes('sala') && normalizedName.includes('kids'))
    || normalizedName.includes('ibn kids')
    || normalizedName.includes('ibnkids')
    || normalizedCode.includes('monitor_kids')
    || normalizedCode.includes('sala_kids')
    || normalizedCode.includes('ibn_kids')
    || normalizedCode === 'monitor_ibn_kids'
  );
};

export const isTeensRoomMonitorScale = (
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
    (normalizedName.includes('monitor') && normalizedName.includes('teens'))
    || (normalizedName.includes('sala') && normalizedName.includes('teens'))
    || normalizedName.includes('ibn teens')
    || normalizedName.includes('ibnteens')
    || normalizedCode.includes('monitor_teens')
    || normalizedCode.includes('sala_teens')
    || normalizedCode.includes('ibn_teens')
    || normalizedCode === 'monitor_ibn_teens'
  );
};

const isRoomMonitorScale = (
  room: RoomMonitorRoom,
  scaleName: string,
  scaleCode: string,
  configuredCodes: { kids: string | null; teens: string | null }
) =>
  room === 'KIDS'
    ? isKidsRoomMonitorScale(scaleName, scaleCode, configuredCodes.kids)
    : isTeensRoomMonitorScale(scaleName, scaleCode, configuredCodes.teens);

export const formatRoomMonitorNames = (names: string[]) => {
  const unique = Array.from(
    new Set(
      names
        .map((name) => formatShortName(name))
        .filter((name) => Boolean(name) && name !== '—')
    )
  );

  if (!unique.length) {
    return 'Nenhum monitor escalado';
  }

  return unique.join(', ');
};

export async function loadRoomMonitorScaleCodes() {
  const [kidsCode, teensCode] = await Promise.all([
    getAppParameterValue(ROOM_MONITOR_SCALE_PARAMETER.kids),
    getAppParameterValue(ROOM_MONITOR_SCALE_PARAMETER.teens),
  ]);

  return {
    kids: kidsCode?.trim() || null,
    teens: teensCode?.trim() || null,
  };
}

export async function fetchRoomMonitorAssignmentsForDate(
  serviceDate: string | null | undefined
): Promise<RoomMonitorAssignment[]> {
  const normalizedDate = getEventCalendarDate(serviceDate);

  if (!normalizedDate) {
    return [];
  }

  const [configuredCodes, scaleLogs] = await Promise.all([
    loadRoomMonitorScaleCodes(),
    fetchMaintenanceScaleLogs(),
  ]);

  return scaleLogs
    .filter((entry) => entry.serviceDate === normalizedDate)
    .flatMap((entry) => {
      const assignments: RoomMonitorAssignment[] = [];

      if (
        isRoomMonitorScale(
          'KIDS',
          entry.scaleTypeName,
          entry.scaleTypeCode,
          configuredCodes
        )
      ) {
        assignments.push({ room: 'KIDS', volunteerName: entry.volunteerName });
      }

      if (
        isRoomMonitorScale(
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

export const groupRoomMonitorNames = (assignments: RoomMonitorAssignment[]) => ({
  kids: assignments
    .filter((entry) => entry.room === 'KIDS')
    .map((entry) => entry.volunteerName),
  teens: assignments
    .filter((entry) => entry.room === 'TEENS')
    .map((entry) => entry.volunteerName),
});

export const canProfileCheckInRoom = (
  profileName: string | null | undefined,
  room: RoomMonitorRoom,
  assignments: RoomMonitorAssignment[]
) =>
  assignments
    .filter((entry) => entry.room === room)
    .some((entry) => personNamesMatch(profileName, entry.volunteerName));

export async function checkSessionIsRoomMonitorSuperAdmin(profileId: string | null | undefined) {
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

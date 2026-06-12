import {
  canProfileCheckInRoom,
  checkSessionIsRoomMonitorSuperAdmin,
  fetchRoomMonitorAssignmentsForDate,
  groupRoomMonitorNames,
  type RoomMonitorAssignment,
  type RoomMonitorRoom,
} from '@/lib/roomMonitorScales';
import { useCallback, useEffect, useState } from 'react';

export type UseRoomMonitorScalesOptions = {
  enabled?: boolean;
  profileFullName?: string | null;
  profileId?: string | null;
};

export const useRoomMonitorScales = (
  eventDate: string | null | undefined,
  options?: UseRoomMonitorScalesOptions
) => {
  const enabled = options?.enabled !== false;
  const profileFullName = options?.profileFullName ?? null;
  const profileId = options?.profileId ?? null;

  const [assignments, setAssignments] = useState<RoomMonitorAssignment[]>([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    if (!enabled || !eventDate) {
      setAssignments([]);
      setIsSuperAdmin(false);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [nextAssignments, superAdmin] = await Promise.all([
        fetchRoomMonitorAssignmentsForDate(eventDate),
        checkSessionIsRoomMonitorSuperAdmin(profileId),
      ]);

      setAssignments(nextAssignments);
      setIsSuperAdmin(superAdmin);
    } catch (fetchError) {
      setAssignments([]);
      setIsSuperAdmin(false);
      setError(fetchError instanceof Error ? fetchError : new Error('Erro ao carregar monitores.'));
    } finally {
      setLoading(false);
    }
  }, [enabled, eventDate, profileId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const groupedNames = groupRoomMonitorNames(assignments);

  const canCheckInRoom = useCallback(
    (room: RoomMonitorRoom) => {
      if (isSuperAdmin) {
        return true;
      }

      return canProfileCheckInRoom(profileFullName, room, assignments);
    },
    [assignments, isSuperAdmin, profileFullName]
  );

  return {
    assignments,
    kidsMonitorNames: groupedNames.kids,
    teensMonitorNames: groupedNames.teens,
    canCheckInKids: canCheckInRoom('KIDS'),
    canCheckInTeens: canCheckInRoom('TEENS'),
    isSuperAdmin,
    loading,
    error,
    refetch,
  };
};

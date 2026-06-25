import {
  canProfileCheckInRoom,
  checkSessionIsRoomServidorSuperAdmin,
  fetchRoomServidorAssignmentsForDate,
  groupRoomServidorNames,
  type RoomServidorAssignment,
  type RoomServidorRoom,
} from '@/lib/roomServidorScales';
import { useCallback, useEffect, useState } from 'react';

export type UseRoomServidorScalesOptions = {
  enabled?: boolean;
  profileFullName?: string | null;
  profileId?: string | null;
};

export const useRoomServidorScales = (
  eventDate: string | null | undefined,
  options?: UseRoomServidorScalesOptions
) => {
  const enabled = options?.enabled !== false;
  const profileFullName = options?.profileFullName ?? null;
  const profileId = options?.profileId ?? null;

  const [assignments, setAssignments] = useState<RoomServidorAssignment[]>([]);
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
        fetchRoomServidorAssignmentsForDate(eventDate),
        checkSessionIsRoomServidorSuperAdmin(profileId),
      ]);

      setAssignments(nextAssignments);
      setIsSuperAdmin(superAdmin);
    } catch (fetchError) {
      setAssignments([]);
      setIsSuperAdmin(false);
      setError(fetchError instanceof Error ? fetchError : new Error('Erro ao carregar servidores.'));
    } finally {
      setLoading(false);
    }
  }, [enabled, eventDate, profileId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const groupedNames = groupRoomServidorNames(assignments);

  const canCheckInRoom = useCallback(
    (room: RoomServidorRoom) => {
      if (isSuperAdmin) {
        return true;
      }

      return canProfileCheckInRoom(profileFullName, room, assignments);
    },
    [assignments, isSuperAdmin, profileFullName]
  );

  return {
    assignments,
    kidsServidorNames: groupedNames.kids,
    teensServidorNames: groupedNames.teens,
    canCheckInKids: canCheckInRoom('KIDS'),
    canCheckInTeens: canCheckInRoom('TEENS'),
    isSuperAdmin,
    loading,
    error,
    refetch,
  };
};

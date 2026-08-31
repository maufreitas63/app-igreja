import {
  canProfileCheckInRoom,
  checkSessionCanBypassRoomServidorScale,
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
  const [canBypassScale, setCanBypassScale] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    if (!enabled || !eventDate) {
      setAssignments([]);
      setCanBypassScale(false);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [nextAssignments, bypassScale] = await Promise.all([
        fetchRoomServidorAssignmentsForDate(eventDate),
        checkSessionCanBypassRoomServidorScale(profileId),
      ]);

      setAssignments(nextAssignments);
      setCanBypassScale(bypassScale);
    } catch (fetchError) {
      setAssignments([]);
      setCanBypassScale(false);
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
      if (canBypassScale) {
        return true;
      }

      return canProfileCheckInRoom(profileFullName, room, assignments);
    },
    [assignments, canBypassScale, profileFullName]
  );

  return {
    assignments,
    kidsServidorNames: groupedNames.kids,
    teensServidorNames: groupedNames.teens,
    canCheckInKids: canCheckInRoom('KIDS'),
    canCheckInTeens: canCheckInRoom('TEENS'),
    isSuperAdmin: canBypassScale,
    loading,
    error,
    refetch,
  };
};

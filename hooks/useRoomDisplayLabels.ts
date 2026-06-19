import { useEntityPrefix } from '@/context/EntityPrefixContext';
import { buildRoomDisplayLabels } from '@/lib/roomDisplayLabels';
import { useMemo } from 'react';

export function useRoomDisplayLabels() {
  const { prefix } = useEntityPrefix();

  return useMemo(() => buildRoomDisplayLabels(prefix), [prefix]);
}

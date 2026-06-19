import {
  buildFamilyId,
  buildNewFamilyRecordingHint,
  DEFAULT_ENTITY_PREFIX,
  getEntityPrefix,
} from '@/lib/entityPrefix';
import { buildRoomDisplayLabels } from '@/lib/roomDisplayLabels';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type EntityPrefixContextValue = {
  prefix: string;
  kidsRoomLabel: string;
  teensRoomLabel: string;
  kidsRoomBadgeLabel: string;
  teensRoomBadgeLabel: string;
  newFamilyRecordingHint: string;
  familyIdExample: string;
};

const EntityPrefixContext = createContext<EntityPrefixContextValue>({
  ...buildRoomDisplayLabels(DEFAULT_ENTITY_PREFIX),
  newFamilyRecordingHint: buildNewFamilyRecordingHint(DEFAULT_ENTITY_PREFIX),
  familyIdExample: buildFamilyId(DEFAULT_ENTITY_PREFIX, 1),
});

export function EntityPrefixProvider({ children }: { children: React.ReactNode }) {
  const [prefix, setPrefix] = useState(DEFAULT_ENTITY_PREFIX);

  useEffect(() => {
    let active = true;

    void getEntityPrefix().then((loadedPrefix) => {
      if (active) {
        setPrefix(loadedPrefix);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<EntityPrefixContextValue>(
    () => ({
      ...buildRoomDisplayLabels(prefix),
      newFamilyRecordingHint: buildNewFamilyRecordingHint(prefix),
      familyIdExample: buildFamilyId(prefix, 1),
    }),
    [prefix]
  );

  return (
    <EntityPrefixContext.Provider value={value}>{children}</EntityPrefixContext.Provider>
  );
}

export function useEntityPrefix(): EntityPrefixContextValue {
  return useContext(EntityPrefixContext);
}

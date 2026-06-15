import {
  buildKidsRoomBadgeLabel,
  buildKidsRoomLabel,
  buildNewFamilyRecordingHint,
  buildTeensRoomBadgeLabel,
  buildTeensRoomLabel,
  buildFamilyId,
  DEFAULT_ENTITY_PREFIX,
  getEntityPrefix,
} from '@/lib/entityPrefix';
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
  prefix: DEFAULT_ENTITY_PREFIX,
  kidsRoomLabel: buildKidsRoomLabel(DEFAULT_ENTITY_PREFIX),
  teensRoomLabel: buildTeensRoomLabel(DEFAULT_ENTITY_PREFIX),
  kidsRoomBadgeLabel: buildKidsRoomBadgeLabel(DEFAULT_ENTITY_PREFIX),
  teensRoomBadgeLabel: buildTeensRoomBadgeLabel(DEFAULT_ENTITY_PREFIX),
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
      prefix,
      kidsRoomLabel: buildKidsRoomLabel(prefix),
      teensRoomLabel: buildTeensRoomLabel(prefix),
      kidsRoomBadgeLabel: buildKidsRoomBadgeLabel(prefix),
      teensRoomBadgeLabel: buildTeensRoomBadgeLabel(prefix),
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

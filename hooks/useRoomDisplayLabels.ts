import { useEntityPrefix } from '@/context/EntityPrefixContext';
import {
  getRoomLabelFromSettings,
  listChurchRoomSettings,
  type ChurchRoomSetting,
} from '@/lib/churchRoomSettings';
import { buildRoomDisplayLabels } from '@/lib/roomDisplayLabels';
import { subscribeActiveTenantChange } from '@/lib/tenantSession';
import { useEffect, useMemo, useState } from 'react';

export function useChurchRoomSettings() {
  const [settings, setSettings] = useState<ChurchRoomSetting[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const load = () => {
      setLoading(true);
      void listChurchRoomSettings({ forceRefresh: true })
        .then((rows) => {
          if (active) setSettings(rows);
        })
        .catch((error) => {
          console.error('listChurchRoomSettings:', error);
          if (active) setSettings([]);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    };

    load();
    const unsubscribe = subscribeActiveTenantChange(() => load());

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return { settings, loading, enabledSettings: settings.filter((row) => row.is_enabled) };
}

export function useRoomDisplayLabels() {
  const { prefix } = useEntityPrefix();
  const { settings } = useChurchRoomSettings();

  return useMemo(
    () =>
      buildRoomDisplayLabels(prefix, {
        kidsDisplayLabel: getRoomLabelFromSettings(settings, 'KIDS'),
        teensDisplayLabel: getRoomLabelFromSettings(settings, 'TEENS'),
      }),
    [prefix, settings]
  );
}

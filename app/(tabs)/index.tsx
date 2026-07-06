import { EventsInboxHome } from '@/components/minimal/EventsInboxHome';
import { MinimalHomeHeader } from '@/components/minimal/MinimalHomeHeader';
import { MinimalScreenLayout } from '@/components/minimal/MinimalScreenLayout';
import { useGhostMode } from '@/context/GhostModeContext';
import { loadEffectiveSessionProfile } from '@/lib/loadSessionProfile';
import { getStoredUserPhone } from '@/lib/userSession';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';

const formatDisplayName = (fullName: string) => {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);

  if (parts.length <= 1) {
    return parts[0] ?? fullName;
  }

  return `${parts[0]} ${parts[parts.length - 1]}`;
};

export default function DashboardIndexScreen() {
  const { isActive: ghostModeActive, state: ghostModeState } = useGhostMode();
  const [headerUserName, setHeaderUserName] = useState('Usuário');

  useFocusEffect(
    useCallback(() => {
      let active = true;

      void (async () => {
        const phone = await getStoredUserPhone();

        if (!phone?.trim() || !active) {
          return;
        }

        const sessionProfile = await loadEffectiveSessionProfile(phone);
        const profileName = sessionProfile?.full_name?.trim();

        if (profileName && active) {
          setHeaderUserName(formatDisplayName(profileName));
        }
      })();

      return () => {
        active = false;
      };
    }, [ghostModeActive, ghostModeState?.targetProfileId])
  );

  return (
    <MinimalScreenLayout header={<MinimalHomeHeader userName={headerUserName} />}>
      <EventsInboxHome />
    </MinimalScreenLayout>
  );
}

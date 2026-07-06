import { EventsInboxHome } from '@/components/minimal/EventsInboxHome';
import { MinimalScreenLayout } from '@/components/minimal/MinimalScreenLayout';
import React from 'react';

export default function DashboardIndexScreen() {
  return (
    <MinimalScreenLayout>
      <EventsInboxHome />
    </MinimalScreenLayout>
  );
}

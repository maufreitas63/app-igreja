import { MinimalMainPanel } from '@/components/minimal/MinimalMainPanel';
import { MINIMAL_EU_QUERO_FOOTER_HEIGHT } from '@/components/minimal/MinimalEuQueroFooter';
import { MinimalScreenLayout } from '@/components/minimal/MinimalScreenLayout';
import React from 'react';

export default function DashboardIndexScreen() {
  return (
    <MinimalScreenLayout
      scroll={false}
      showGreeting
      contentContainerStyle={{
        paddingBottom: MINIMAL_EU_QUERO_FOOTER_HEIGHT + 12,
      }}
    >
      <MinimalMainPanel />
    </MinimalScreenLayout>
  );
}

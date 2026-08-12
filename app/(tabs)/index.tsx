import { MinimalMainPanel } from '@/components/minimal/MinimalMainPanel';
import { MinimalEuQueroFooter } from '@/components/minimal/MinimalEuQueroFooter';
import { MinimalScreenLayout } from '@/components/minimal/MinimalScreenLayout';
import { useHomeBackExitConfirmation } from '@/hooks/useHomeBackExitConfirmation';
import React from 'react';

export default function DashboardIndexScreen() {
  useHomeBackExitConfirmation();

  return (
    <MinimalScreenLayout scroll={false} showGreeting footer={<MinimalEuQueroFooter />}>
      <MinimalMainPanel />
    </MinimalScreenLayout>
  );
}

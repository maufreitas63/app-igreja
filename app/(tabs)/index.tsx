import { MinimalMainPanel } from '@/components/minimal/MinimalMainPanel';
import { MinimalEuQueroFooter } from '@/components/minimal/MinimalEuQueroFooter';
import { MinimalScreenLayout } from '@/components/minimal/MinimalScreenLayout';
import React from 'react';

export default function DashboardIndexScreen() {
  return (
    <MinimalScreenLayout scroll={false} showGreeting footer={<MinimalEuQueroFooter />}>
      <MinimalMainPanel />
    </MinimalScreenLayout>
  );
}

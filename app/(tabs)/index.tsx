import { MinimalMainPanel } from '@/components/minimal/MinimalMainPanel';
import { MinimalScreenLayout } from '@/components/minimal/MinimalScreenLayout';
import React from 'react';

export default function DashboardIndexScreen() {
  return (
    <MinimalScreenLayout scroll={false}>
      <MinimalMainPanel />
    </MinimalScreenLayout>
  );
}

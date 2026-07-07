import { PerfilClassPanel } from '@/components/PerfilClassPanel';
import { MinimalScreenLayout } from '@/components/minimal/MinimalScreenLayout';
import { ScreenAccessGate } from '@/components/ScreenAccessGate';
import { useGroupedManageCardAccess } from '@/hooks/useGroupedManageCardAccess';
import React from 'react';

export default function PerfilScreen() {
  const accessStatus = useGroupedManageCardAccess();

  return (
    <ScreenAccessGate status={accessStatus}>
      <MinimalScreenLayout>
        <PerfilClassPanel />
      </MinimalScreenLayout>
    </ScreenAccessGate>
  );
}

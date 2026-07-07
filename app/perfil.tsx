import { PerfilClassPanel } from '@/components/PerfilClassPanel';
import { MinimalScreenLayout } from '@/components/minimal/MinimalScreenLayout';
import { ScreenAccessGate } from '@/components/ScreenAccessGate';
import { usePerfilScreenAccess } from '@/hooks/usePerfilScreenAccess';
import React from 'react';

export default function PerfilScreen() {
  const accessStatus = usePerfilScreenAccess();

  return (
    <ScreenAccessGate status={accessStatus}>
      <MinimalScreenLayout scroll={false}>
        <PerfilClassPanel />
      </MinimalScreenLayout>
    </ScreenAccessGate>
  );
}

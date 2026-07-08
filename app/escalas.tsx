import { ScalesClassPanel } from '@/components/ScalesClassPanel';
import { MinimalScreenLayout } from '@/components/minimal/MinimalScreenLayout';
import { ScreenAccessGate } from '@/components/ScreenAccessGate';
import { useScalesScreenAccess } from '@/hooks/useScalesScreenAccess';
import React from 'react';

export default function EscalasScreen() {
  const accessStatus = useScalesScreenAccess();

  return (
    <ScreenAccessGate status={accessStatus}>
      <MinimalScreenLayout scroll={false}>
        <ScalesClassPanel />
      </MinimalScreenLayout>
    </ScreenAccessGate>
  );
}

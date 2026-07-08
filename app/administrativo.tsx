import { AdministrativoClassPanel } from '@/components/AdministrativoClassPanel';
import { MinimalScreenLayout } from '@/components/minimal/MinimalScreenLayout';
import { ScreenAccessGate } from '@/components/ScreenAccessGate';
import { useAdministrativoScreenAccess } from '@/hooks/useAdministrativoScreenAccess';
import React from 'react';

export default function AdministrativoScreen() {
  const accessStatus = useAdministrativoScreenAccess();

  return (
    <ScreenAccessGate status={accessStatus}>
      <MinimalScreenLayout scroll={false}>
        <AdministrativoClassPanel />
      </MinimalScreenLayout>
    </ScreenAccessGate>
  );
}

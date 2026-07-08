import { MembersListsClassPanel } from '@/components/MembersListsClassPanel';
import { MinimalScreenLayout } from '@/components/minimal/MinimalScreenLayout';
import { ScreenAccessGate } from '@/components/ScreenAccessGate';
import { useMembersListsScreenAccess } from '@/hooks/useMembersListsScreenAccess';
import React from 'react';

export default function MembrosScreen() {
  const accessStatus = useMembersListsScreenAccess();

  return (
    <ScreenAccessGate status={accessStatus}>
      <MinimalScreenLayout scroll={false}>
        <MembersListsClassPanel />
      </MinimalScreenLayout>
    </ScreenAccessGate>
  );
}

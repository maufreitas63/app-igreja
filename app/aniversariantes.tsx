import { BirthdaysClassPanel } from '@/components/BirthdaysClassPanel';
import { MinimalScreenLayout } from '@/components/minimal/MinimalScreenLayout';
import { ScreenAccessGate } from '@/components/ScreenAccessGate';
import { useBirthdaysScreenAccess } from '@/hooks/useBirthdaysScreenAccess';
import React from 'react';

export default function AniversariantesScreen() {
  const accessStatus = useBirthdaysScreenAccess();

  return (
    <ScreenAccessGate status={accessStatus}>
      <MinimalScreenLayout scroll={false}>
        <BirthdaysClassPanel />
      </MinimalScreenLayout>
    </ScreenAccessGate>
  );
}

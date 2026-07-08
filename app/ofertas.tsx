import { OfferingsClassPanel } from '@/components/OfferingsClassPanel';
import { MinimalScreenLayout } from '@/components/minimal/MinimalScreenLayout';
import { ScreenAccessGate } from '@/components/ScreenAccessGate';
import { useOfferingsScreenAccess } from '@/hooks/useOfferingsScreenAccess';
import React from 'react';

export default function OfertasScreen() {
  const accessStatus = useOfferingsScreenAccess();

  return (
    <ScreenAccessGate status={accessStatus}>
      <MinimalScreenLayout scroll={false}>
        <OfferingsClassPanel />
      </MinimalScreenLayout>
    </ScreenAccessGate>
  );
}

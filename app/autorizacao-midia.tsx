import { AuthorizationForm } from '@/components/AuthorizationForm';
import { MinimalScreenLayout } from '@/components/minimal/MinimalScreenLayout';
import { ScreenAccessGate } from '@/components/ScreenAccessGate';
import { useMediaAuthorizationAccess } from '@/hooks/useMediaAuthorizationAccess';
import { isMinimalPresentationRoute } from '@/lib/dashboardReturnNavigation';
import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

export default function MediaAuthorizationScreen() {
  const params = useLocalSearchParams();
  const isMinimalPresentation = isMinimalPresentationRoute(params.presentation);
  const { status, sessionProfileId } = useMediaAuthorizationAccess();

  const content = sessionProfileId ? (
    <AuthorizationForm profileId={sessionProfileId} />
  ) : null;

  return (
    <ScreenAccessGate status={status}>
      {isMinimalPresentation ? (
        <MinimalScreenLayout scroll={false}>
          <View className="min-h-0 flex-1 bg-minimal-bg">{content}</View>
        </MinimalScreenLayout>
      ) : (
        <View className="flex-1 bg-minimal-bg p-4">{content}</View>
      )}
    </ScreenAccessGate>
  );
}

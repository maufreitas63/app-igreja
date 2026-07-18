import { EventsInboxHome } from '@/components/minimal/EventsInboxHome';
import React from 'react';
import { View } from 'react-native';

/** Conteúdo principal da home minimalista (eventos). */
export function MinimalMainPanel() {
  return (
    <View className="min-h-0 w-full flex-1">
      <EventsInboxHome />
    </View>
  );
}

import { EventRegistrationCupInline } from '@/components/minimal/EventRegistrationCupInline';
import { useMinimalHome } from '@/context/MinimalHomeContext';
import { formatEventDateTimeLabel } from '@/lib/eventDate';
import React from 'react';
import { Text, View } from 'react-native';

type Props = {
  menuButton: React.ReactNode;
};

/** Linha do topo: menu + evento expandido em duas metades iguais (50/50). */
export function MinimalExpandedEventBar({ menuButton }: Props) {
  const { expandedEvent } = useMinimalHome();

  if (!expandedEvent) {
    return <View className="w-full flex-row items-start">{menuButton}</View>;
  }

  const local = expandedEvent.event_local?.trim() || 'Sem local informado';
  const meta = formatEventDateTimeLabel(expandedEvent.event_date);

  return (
    <View className="min-h-[52px] w-full flex-row items-stretch border-b border-minimal-border">
      <View className="min-w-0 flex-1">
        <View className="flex-1 flex-row items-center gap-1 py-1 pr-1">
          {menuButton}
          <View className="min-w-0 flex-1 justify-center gap-0.5">
            <Text className="text-minimal-inbox text-minimal-blue-dark" numberOfLines={2}>
              {expandedEvent.name}
            </Text>
            <Text className="text-minimal-preview text-minimal-blue" numberOfLines={1}>
              {local}
            </Text>
          </View>
        </View>
      </View>
      <View className="min-w-0 flex-1 items-center justify-center gap-0.5 border-l border-minimal-border px-2 py-1.5">
        <Text className="text-center text-xs text-minimal-blue" numberOfLines={2}>
          {meta}
        </Text>
        <EventRegistrationCupInline event={expandedEvent} />
      </View>
    </View>
  );
}

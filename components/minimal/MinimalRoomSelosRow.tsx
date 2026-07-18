import { useRoomDisplayLabels } from '@/hooks/useRoomDisplayLabels';
import React from 'react';
import { Text, View } from 'react-native';

type Props = {
  showKids?: boolean;
  showTeens?: boolean;
};

/** Selos de salas (ex.: IBN Infantil / IBN Jovens) no modo minimalista. */
export function MinimalRoomSelosRow({ showKids = false, showTeens = false }: Props) {
  const { kidsRoomBadgeLabel, teensRoomBadgeLabel } = useRoomDisplayLabels();

  if (!showKids && !showTeens) {
    return null;
  }

  return (
    <View className="w-full flex-row flex-wrap items-center gap-2">
      {showKids ? (
        <View className="min-w-0 max-w-full grow basis-[48%] shrink flex-row items-center justify-center rounded-full border border-[#1E40AF]/35 bg-[#1E40AF]/10 px-2.5 py-1.5">
          <Text
            className="min-w-0 shrink text-center text-[13px] font-bold text-minimal-blue-dark"
            numberOfLines={1}
          >
            {kidsRoomBadgeLabel}
          </Text>
        </View>
      ) : null}
      {showTeens ? (
        <View className="min-w-0 max-w-full grow basis-[48%] shrink flex-row items-center justify-center rounded-full border border-[#1E40AF]/35 bg-[#1E40AF]/10 px-2.5 py-1.5">
          <Text
            className="min-w-0 shrink text-center text-[13px] font-bold text-minimal-blue-dark"
            numberOfLines={1}
          >
            {teensRoomBadgeLabel}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

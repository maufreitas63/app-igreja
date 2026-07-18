import { EventOrchestratorPanel } from '@/components/EventOrchestratorPanel';
import { ScreenAccessGate } from '@/components/ScreenAccessGate';
import { usePalette } from '@/context/PaletteContext';
import { useEventOrchestratorScreenAccess } from '@/hooks/useEventOrchestratorScreenAccess';
import { buildIndexScreenGradient } from '@/lib/paletteTheme';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import React from 'react';
import { Pressable, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function EventOrchestratorScreen() {
  const router = useRouter();
  const { colors } = usePalette();
  const gradient = buildIndexScreenGradient(colors);
  const accessStatus = useEventOrchestratorScreenAccess();

  return (
    <ScreenAccessGate status={accessStatus}>
      <LinearGradient colors={gradient} className="flex-1">
        <SafeAreaView className="flex-1 px-5 pt-2">
          <Stack.Screen options={{ headerShown: false }} />
          <Pressable onPress={() => router.back()} className="mb-2 self-start py-1">
            <Text className="text-base font-semibold">Voltar</Text>
          </Pressable>
          <EventOrchestratorPanel contentContainerStyle={{ flex: 1 }} />
        </SafeAreaView>
      </LinearGradient>
    </ScreenAccessGate>
  );
}

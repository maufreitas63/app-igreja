import { EventOrchestratorPanel } from '@/components/EventOrchestratorPanel';
import { ScreenAccessGate } from '@/components/ScreenAccessGate';
import { usePalette } from '@/context/PaletteContext';
import { useEventOrchestratorScreenAccess } from '@/hooks/useEventOrchestratorScreenAccess';
import { buildIndexScreenGradient } from '@/lib/paletteTheme';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function EventOrchestratorScreen() {
  const router = useRouter();
  const { colors } = usePalette();
  const gradient = buildIndexScreenGradient(colors);
  const accessStatus = useEventOrchestratorScreenAccess();

  return (
    <ScreenAccessGate status={accessStatus}>
      <LinearGradient colors={gradient} style={styles.gradient}>
        <SafeAreaView style={styles.safeArea}>
          <Stack.Screen options={{ headerShown: false }} />
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>Voltar</Text>
          </Pressable>
          <EventOrchestratorPanel contentContainerStyle={styles.content} />
        </SafeAreaView>
      </LinearGradient>
    </ScreenAccessGate>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    marginBottom: 8,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
});

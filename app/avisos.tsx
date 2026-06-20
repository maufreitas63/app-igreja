import { usePalette } from '@/context/PaletteContext';
import { buildIndexScreenGradient } from '@/lib/paletteTheme';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AvisosScreen() {
  const router = useRouter();
  const { colors } = usePalette();
  const gradient = buildIndexScreenGradient(colors);

  return (
    <LinearGradient colors={gradient} style={styles.gradient}>
      <SafeAreaView style={styles.safeArea}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>Voltar</Text>
          </Pressable>
          <Text style={styles.title}>Avisos</Text>
        </View>
        <View style={[styles.card, { borderColor: `${colors.accent}55` }]}>
          <Text style={[styles.cardTitle, { color: colors.accent }]}>Comunicados do culto</Text>
          <Text style={styles.cardBody}>
            Esta área recebe os avisos orientados pela equipe durante o evento. Quando o líder
            acionar a rota Avisos no orquestrador, você será guiado até aqui automaticamente.
          </Text>
        </View>
      </SafeAreaView>
    </LinearGradient>
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
  header: {
    marginBottom: 16,
    gap: 8,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  backButtonText: {
    color: '#CBD5E1',
    fontSize: 14,
    fontWeight: '700',
  },
  title: {
    color: '#F8FAFC',
    fontSize: 28,
    fontWeight: '800',
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    padding: 18,
    gap: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  cardBody: {
    color: '#CBD5E1',
    fontSize: 14,
    lineHeight: 21,
  },
});

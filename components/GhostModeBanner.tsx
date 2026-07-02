import { useGhostMode } from '@/context/GhostModeContext';
import { formatShortName } from '@/lib/formatShortName';
import { FontAwesome } from '@expo/vector-icons';
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function GhostModeBanner() {
  const { isActive, state, endGhostMode } = useGhostMode();
  const insets = useSafeAreaInsets();

  if (!isActive || !state) {
    return null;
  }

  const label = formatShortName(state.targetFullName);

  return (
    <View
      style={[
        styles.container,
        Platform.OS === 'web' ? styles.containerWeb : null,
        { paddingTop: Math.max(insets.top, Platform.OS === 'web' ? 8 : 0) },
      ]}
      pointerEvents="box-none"
    >
      <View style={styles.inner}>
        <View style={styles.labelRow}>
          <FontAwesome name="user-secret" size={14} color="#FDE68A" />
          <Text style={styles.label} numberOfLines={2}>
            MODO GHOST ATIVO: Visualizando como {label}
          </Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.exitButton, pressed && styles.exitButtonPressed]}
          onPress={() => void endGhostMode()}
          accessibilityRole="button"
          accessibilityLabel="Encerrar Modo Ghost"
        >
          <Text style={styles.exitButtonText}>Sair</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 99990,
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  containerWeb: {
    position: 'fixed' as unknown as 'absolute',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(127, 29, 29, 0.94)',
    borderColor: 'rgba(252, 211, 77, 0.55)',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  labelRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    flex: 1,
    color: '#FEF3C7',
    fontSize: 13,
    fontWeight: '700',
  },
  exitButton: {
    borderRadius: 8,
    backgroundColor: '#FCD34D',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  exitButtonPressed: {
    opacity: 0.85,
  },
  exitButtonText: {
    color: '#1c1917',
    fontSize: 12,
    fontWeight: '800',
  },
});

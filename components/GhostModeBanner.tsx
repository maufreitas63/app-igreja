import { useGhostMode } from '@/context/GhostModeContext';
import { formatShortName } from '@/lib/formatShortName';
import { FontAwesome } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const CONTENT_HORIZONTAL_INSET = 16;

export function GhostModeBanner() {
  const { isActive, state, endGhostMode } = useGhostMode();
  const insets = useSafeAreaInsets();
  const [operatorShortName, setOperatorShortName] = useState<string | null>(null);

  useEffect(() => {
    if (!isActive || !state?.realProfileId) {
      setOperatorShortName(null);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const { supabase } = await import('@/lib/supabase');
        const { data } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', state.realProfileId)
          .maybeSingle();
        if (cancelled) {
          return;
        }
        const name = typeof data?.full_name === 'string' ? data.full_name.trim() : '';
        setOperatorShortName(name ? formatShortName(name) : 'Auditor');
      } catch {
        if (!cancelled) {
          setOperatorShortName('Auditor');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isActive, state?.realProfileId]);

  if (!isActive || !state) {
    return null;
  }

  const targetLabel = formatShortName(state.targetFullName);
  const operatorLabel = operatorShortName ?? 'Auditor';

  return (
    <View
      style={[
        styles.container,
        Platform.OS === 'web' ? styles.containerWeb : null,
        { paddingTop: Math.max(insets.top, Platform.OS === 'web' ? 6 : 0) },
      ]}
      pointerEvents="box-none"
    >
      <View style={styles.inner}>
        <FontAwesome name="user-secret" size={13} color="#FDE68A" style={styles.icon} />
        <View style={styles.textBlock}>
          <Text style={styles.labelTitle}>Modo Ghost ativo (auditor)</Text>
          <Text style={styles.labelSubtitle} numberOfLines={3}>
            {operatorLabel} está simulado como {targetLabel} — não é o login da pessoa
          </Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.exitButton, pressed && styles.exitButtonPressed]}
          onPress={() => void endGhostMode()}
          hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
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
    paddingHorizontal: CONTENT_HORIZONTAL_INSET,
    paddingBottom: 4,
    alignItems: 'flex-end',
  },
  containerWeb: {
    position: 'fixed' as unknown as 'absolute',
  },
  inner: {
    width: '58%',
    maxWidth: 360,
    minWidth: 200,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(127, 29, 29, 0.94)',
    borderColor: 'rgba(252, 211, 77, 0.55)',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  icon: {
    marginTop: 1,
  },
  textBlock: {
    flex: 1,
    minWidth: 0,
  },
  labelTitle: {
    color: '#FDE68A',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    lineHeight: 13,
  },
  labelSubtitle: {
    color: '#FEF3C7',
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 14,
    marginTop: 1,
  },
  exitButton: {
    borderRadius: 8,
    backgroundColor: '#FCD34D',
    minWidth: 48,
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exitButtonPressed: {
    opacity: 0.85,
  },
  exitButtonText: {
    color: '#1c1917',
    fontSize: 13,
    fontWeight: '800',
  },
});

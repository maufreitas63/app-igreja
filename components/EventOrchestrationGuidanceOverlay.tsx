import { usePalette } from '@/context/PaletteContext';
import React, { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';

type Props = {
  visible: boolean;
  message: string;
  onHidden?: () => void;
};

export function EventOrchestrationGuidanceOverlay({ visible, message, onHidden }: Props) {
  const { colors } = usePalette();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    if (!visible) {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 280,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 12,
          duration: 280,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) {
          onHidden?.();
        }
      });
      return;
    }

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 320,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 320,
        useNativeDriver: true,
      }),
    ]).start();
  }, [onHidden, opacity, translateY, visible]);

  if (!visible && !message) {
    return null;
  }

  return (
    <View style={styles.host} pointerEvents="none">
      <Animated.View
        style={[
          styles.card,
          {
            opacity,
            transform: [{ translateY }],
            borderColor: `${colors.accent}88`,
            backgroundColor: `${colors.secondary}F2`,
          },
        ]}
      >
        <Text style={[styles.title, { color: colors.accent }]}>Orquestração do evento</Text>
        <Text style={styles.message}>{message}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: Platform.OS === 'web' ? 72 : 96,
    zIndex: 9998,
  },
  card: {
    width: 'min(92%, 420px)' as unknown as number,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  title: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  message: {
    color: '#F8FAFC',
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '600',
  },
});

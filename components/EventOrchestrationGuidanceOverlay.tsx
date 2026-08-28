import { boxShadowStyle } from '@/lib/boxShadow';
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
  const scale = useRef(new Animated.Value(1)).current;

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
        Animated.timing(scale, {
          toValue: 1,
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

    scale.setValue(0.94);

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
      Animated.sequence([
        Animated.spring(scale, {
          toValue: 1.05,
          friction: 4,
          tension: 180,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          friction: 6,
          tension: 160,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [onHidden, opacity, scale, translateY, visible]);

  if (!visible && !message) {
    return null;
  }

  return (
    <View style={styles.host}>
      <Animated.View
        style={[
          styles.card,
          {
            opacity,
            transform: [{ translateY }, { scale }],
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
    pointerEvents: 'none',
  },
  card: {
    width: 'min(92%, 420px)' as unknown as number,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 14,
    ...boxShadowStyle({
      color: '#000',
      offsetY: 6,
      blurRadius: 12,
      opacity: 0.25,
      elevation: 8,
    }),
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

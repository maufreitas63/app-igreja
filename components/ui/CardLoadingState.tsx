import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

type CardLoadingStateProps = {
  lines?: number;
  compact?: boolean;
};

export function CardLoadingState({ lines = 3, compact = false }: CardLoadingStateProps) {
  const pulse = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.85,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.35,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [pulse]);

  return (
    <View style={[styles.container, compact && styles.containerCompact]} accessibilityRole="progressbar">
      {Array.from({ length: lines }, (_, index) => (
        <Animated.View
          key={`skeleton-line-${index}`}
          style={[
            styles.line,
            index === lines - 1 && styles.lineShort,
            { opacity: pulse },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: 10,
    paddingVertical: 8,
  },
  containerCompact: {
    paddingVertical: 4,
    gap: 8,
  },
  line: {
    height: 14,
    borderRadius: 8,
    backgroundColor: 'rgba(148, 163, 184, 0.28)',
    width: '100%',
  },
  lineShort: {
    width: '62%',
  },
});

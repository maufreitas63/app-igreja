import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import React, { useCallback, useEffect, useRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

type BookFlipDirection = 'forward' | 'back';

type BookFlipTransitionProps = {
  from: React.ReactNode;
  direction?: BookFlipDirection;
  onDone: () => void;
};

const FLIP_MS = 720;

/**
 * A folha gira no eixo esquerdo. `forward` afasta a página atual e revela a
 * seguinte. `back` traz a página anterior, que está à esquerda, no movimento
 * contrário. Só transform e opacidade. Se a animação não concluir, um prazo
 * encerra a troca.
 */
export function BookFlipTransition({ from, direction = 'forward', onDone }: BookFlipTransitionProps) {
  const progress = useSharedValue(0);
  const turningBack = useSharedValue(direction === 'back');
  const onDoneRef = useRef(onDone);
  const finishedRef = useRef(false);
  onDoneRef.current = onDone;

  const complete = useCallback(() => {
    if (finishedRef.current) {
      return;
    }
    finishedRef.current = true;
    onDoneRef.current();
  }, []);

  useEffect(() => {
    finishedRef.current = false;
    turningBack.value = direction === 'back';
    progress.value = 0;
    progress.value = withTiming(
      1,
      { duration: FLIP_MS, easing: Easing.inOut(Easing.cubic) },
      (finished) => {
        if (finished) {
          runOnJS(complete)();
        }
      }
    );
    const timer = setTimeout(complete, FLIP_MS + 80);
    return () => clearTimeout(timer);
  }, [complete, direction, progress, turningBack]);

  const turningStyle = useAnimatedStyle(() => {
    const turn = turningBack.value ? -180 + progress.value * 180 : progress.value * -180;
    const faceVisible = turningBack.value ? progress.value >= 0.5 : progress.value < 0.5;
    return {
      opacity: faceVisible ? 1 : 0,
      transform: [{ perspective: 1400 }, { rotateY: `${turn}deg` }],
    };
  });

  const shadeStyle = useAnimatedStyle(() => ({
    opacity: Math.sin(progress.value * Math.PI) * 0.38,
  }));

  return (
    <View style={styles.host} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View pointerEvents="none" style={[styles.shade, shadeStyle]} />
      <Animated.View style={[styles.sheet, styles.turning, turningStyle]}>{from}</Animated.View>
    </View>
  );
}

const turningOrigin =
  Platform.OS === 'web'
    ? ({
        transformOrigin: 'left center',
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
      } as object)
    : {
        transformOrigin: 'left center' as const,
        backfaceVisibility: 'hidden' as const,
      };

const styles = StyleSheet.create({
  host: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 4,
    overflow: 'hidden',
    backgroundColor: 'transparent',
    ...(Platform.OS === 'web'
      ? ({ perspective: 1400, transformStyle: 'preserve-3d' } as object)
      : null),
  },
  sheet: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: MINIMAL_UI.background,
  },
  turning: turningOrigin,
  shade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0f172a',
  },
});

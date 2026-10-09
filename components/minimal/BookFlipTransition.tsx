import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import { LinearGradient } from 'expo-linear-gradient';
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
  /** Folha que se dobra e vira. Chamado duas vezes (metade esquerda e direita). */
  renderLeaf: () => React.ReactNode;
  /** Página que fica por baixo e aparece conforme a folha sai. */
  renderUnder: () => React.ReactNode;
  direction?: BookFlipDirection;
  pageWidth: number;
  onDone: () => void;
};

const FLIP_MS = 1280;
const IS_WEB = Platform.OS === 'web';

function clamp01(value: number) {
  'worklet';
  return Math.min(1, Math.max(0, value));
}

function foldProgress(progress: number, back: boolean) {
  'worklet';
  return back ? clamp01((progress - 0.28) / 0.72) : clamp01(progress / 0.72);
}

function spineProgress(progress: number, back: boolean) {
  'worklet';
  return back ? clamp01(progress / 0.72) : clamp01((progress - 0.45) / 0.55);
}

/**
 * Dobra de livro: a metade de fora vira no vinco central e, em seguida, a
 * folha gira na lombada esquerda. A sombra acompanha o papel. Se a animação
 * não concluir, um prazo encerra a troca.
 */
export function BookFlipTransition({
  renderLeaf,
  renderUnder,
  direction = 'forward',
  pageWidth,
  onDone,
}: BookFlipTransitionProps) {
  const progress = useSharedValue(0);
  const turningBack = useSharedValue(direction === 'back');
  const pageWidthSv = useSharedValue(pageWidth);
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
    pageWidthSv.value = pageWidth;
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
  }, [complete, direction, pageWidth, pageWidthSv, progress, turningBack]);

  const spineStyle = useAnimatedStyle(() => {
    const back = turningBack.value;
    const spineP = spineProgress(progress.value, back);
    const angle = back ? -180 + spineP * 180 : spineP * -180;
    const lift = Math.sin(progress.value * Math.PI) * 36;
    const turn = { rotateY: `${angle}deg` };
    const rise = { translateZ: lift };
    return {
      transform: IS_WEB ? [rise, turn] : [{ perspective: 1200 }, rise, turn],
    };
  });

  const foldStyle = useAnimatedStyle(() => {
    const back = turningBack.value;
    const foldP = foldProgress(progress.value, back);
    const angle = back ? -180 + foldP * 180 : foldP * -180;
    return {
      transform: [{ rotateY: `${angle}deg` }],
    };
  });

  const rightShadeStyle = useAnimatedStyle(() => {
    const foldP = foldProgress(progress.value, turningBack.value);
    return {
      opacity: 0.2 + Math.sin(foldP * Math.PI) * 0.8,
      transform: [{ translateX: -foldP * pageWidthSv.value * 0.16 }],
    };
  });

  const leftShadeStyle = useAnimatedStyle(() => {
    const spineP = spineProgress(progress.value, turningBack.value);
    return { opacity: Math.sin(spineP * Math.PI) * 0.72 };
  });

  const creaseStyle = useAnimatedStyle(() => {
    const foldP = foldProgress(progress.value, turningBack.value);
    return { opacity: Math.sin(foldP * Math.PI) };
  });

  const leftFrontStyle = useAnimatedStyle(() => {
    const back = turningBack.value;
    const spineP = spineProgress(progress.value, back);
    const showFront = back ? spineP > 0.5 : spineP < 0.5;
    return { opacity: showFront ? 1 : 0 };
  });

  const leftBackStyle = useAnimatedStyle(() => {
    const back = turningBack.value;
    const spineP = spineProgress(progress.value, back);
    const showFront = back ? spineP > 0.5 : spineP < 0.5;
    return { opacity: showFront ? 0 : 1 };
  });

  const rightFrontStyle = useAnimatedStyle(() => {
    const back = turningBack.value;
    const foldP = foldProgress(progress.value, back);
    const showFront = back ? foldP > 0.5 : foldP < 0.5;
    return { opacity: showFront ? 1 : 0 };
  });

  const rightBackStyle = useAnimatedStyle(() => {
    const back = turningBack.value;
    const foldP = foldProgress(progress.value, back);
    const showFront = back ? foldP > 0.5 : foldP < 0.5;
    return { opacity: showFront ? 0 : 1 };
  });

  const underShadeStyle = useAnimatedStyle(() => ({
    opacity: Math.sin(progress.value * Math.PI) * 0.7,
  }));

  const bandStyle = useAnimatedStyle(() => {
    const travel = pageWidthSv.value * (turningBack.value ? progress.value : 1 - progress.value) * 0.62;
    return {
      opacity: Math.sin(progress.value * Math.PI),
      transform: [{ translateX: travel }],
    };
  });

  const halfSheet = pageWidth > 0 ? pageWidth : 1;

  return (
    <View
      style={styles.host}
      pointerEvents="auto"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={styles.stage} pointerEvents="none">
        <View style={styles.under}>{renderUnder()}</View>

        <Animated.View style={[styles.underShade, underShadeStyle]}>
          <LinearGradient
            colors={['rgba(15,23,42,0.55)', 'rgba(15,23,42,0.16)', 'rgba(15,23,42,0)']}
            locations={[0, 0.42, 1]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        <Animated.View style={[styles.band, bandStyle]}>
          <LinearGradient
            colors={['rgba(15,23,42,0.5)', 'rgba(15,23,42,0.08)', 'rgba(15,23,42,0)']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        <Animated.View style={[styles.leaf, spineStyle]}>
          <View style={styles.leftPivot} collapsable={false}>
            <Animated.View style={[styles.faceFront, leftFrontStyle]}>
              <View style={styles.halfClip}>
                <View style={{ width: halfSheet }}>{renderLeaf()}</View>
              </View>
              <Animated.View style={[styles.shadeFill, leftShadeStyle]}>
                <LinearGradient
                  colors={['rgba(15,23,42,0.05)', 'rgba(15,23,42,0.62)']}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={StyleSheet.absoluteFill}
                />
              </Animated.View>
            </Animated.View>
            <Animated.View style={[styles.faceBack, leftBackStyle]}>
              <LinearGradient
                colors={['#cfc6b8', '#f6f1e7', '#e4dcd0']}
                start={{ x: 1, y: 0.5 }}
                end={{ x: 0, y: 0.5 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          </View>

          <Animated.View style={[styles.rightPivot, foldStyle]} collapsable={false}>
            <Animated.View style={[styles.faceFront, rightFrontStyle]}>
              <View style={styles.halfClip}>
                <View style={{ width: halfSheet, marginLeft: -halfSheet / 2 }}>{renderLeaf()}</View>
              </View>
              <Animated.View style={[styles.rightShade, rightShadeStyle]}>
                <LinearGradient
                  colors={['rgba(255,255,255,0.42)', 'rgba(15,23,42,0)', 'rgba(15,23,42,0.62)']}
                  locations={[0, 0.28, 1]}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={StyleSheet.absoluteFill}
                />
              </Animated.View>
            </Animated.View>
            <Animated.View style={[styles.faceBack, rightBackStyle]}>
              <LinearGradient
                colors={['#b7aea0', '#f7f3ea', '#ddd4c6']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          </Animated.View>

          <Animated.View style={[styles.crease, creaseStyle]}>
            <LinearGradient
              colors={['rgba(15,23,42,0)', 'rgba(255,255,255,0.82)', 'rgba(15,23,42,0.4)', 'rgba(15,23,42,0)']}
              locations={[0, 0.42, 0.62, 1]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </Animated.View>
      </View>
    </View>
  );
}

const webPreserve =
  Platform.OS === 'web'
    ? ({
        transformStyle: 'preserve-3d',
        WebkitTransformStyle: 'preserve-3d',
      } as object)
    : null;

const webFace =
  Platform.OS === 'web'
    ? ({
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
      } as object)
    : { backfaceVisibility: 'hidden' as const };

const styles = StyleSheet.create({
  host: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 4,
    overflow: 'hidden',
    backgroundColor: MINIMAL_UI.background,
  },
  stage: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: MINIMAL_UI.background,
    ...(Platform.OS === 'web'
      ? ({
          perspective: 1200,
          perspectiveOrigin: 'left center',
          transformStyle: 'preserve-3d',
          WebkitTransformStyle: 'preserve-3d',
        } as object)
      : null),
  },
  under: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: MINIMAL_UI.background,
  },
  underShade: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  band: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: '42%',
    zIndex: 2,
  },
  leaf: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 3,
    transformOrigin: 'left center',
    ...webPreserve,
  },
  leftPivot: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: '50%',
    transformOrigin: 'left center',
    ...webPreserve,
  },
  rightPivot: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '50%',
    width: '50%',
    zIndex: 2,
    transformOrigin: 'left center',
    ...webPreserve,
  },
  faceFront: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: MINIMAL_UI.background,
    ...webFace,
  },
  faceBack: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#f3efe6',
    transform: [{ rotateY: '180deg' }],
    ...webFace,
  },
  halfClip: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    backgroundColor: MINIMAL_UI.background,
  },
  shadeFill: {
    ...StyleSheet.absoluteFillObject,
  },
  rightShade: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: '130%',
  },
  crease: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 28,
    left: '50%',
    marginLeft: -14,
    zIndex: 5,
  },
});

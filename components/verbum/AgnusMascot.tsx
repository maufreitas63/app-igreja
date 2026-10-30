import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';

export type AgnusReaction = 'THINKING' | 'CELEBRATING' | 'CONSOLING' | 'STREAK_FIRE';

const LINES: Record<AgnusReaction, { en: string; pt: string }> = {
  THINKING: { en: 'Read it slowly.', pt: 'Leia com calma.' },
  CELEBRATING: { en: 'Excellent!', pt: 'Excelente!' },
  CONSOLING: { en: "Don't give up!", pt: 'Não desista!' },
  STREAK_FIRE: { en: 'The lamp still burns.', pt: 'A lâmpada continua acesa.' },
};

type Props = {
  reaction: AgnusReaction;
};

export function AgnusMascot({ reaction }: Props) {
  const lift = useRef(new Animated.Value(0)).current;
  const line = LINES[reaction];
  const celebrating = reaction === 'CELEBRATING' || reaction === 'STREAK_FIRE';
  const eyesClosed = reaction === 'CELEBRATING';

  useEffect(() => {
    lift.setValue(0);
    if (reaction === 'THINKING' || reaction === 'CONSOLING') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(lift, { toValue: reaction === 'THINKING' ? -6 : -3, duration: 900, useNativeDriver: true }),
          Animated.timing(lift, { toValue: 0, duration: 900, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
    const jump = Animated.sequence([
      Animated.timing(lift, { toValue: -25, duration: 180, useNativeDriver: true }),
      Animated.spring(lift, { toValue: 0, useNativeDriver: true, friction: 4 }),
    ]);
    jump.start();
    return () => jump.stop();
  }, [lift, reaction]);

  return (
    <View style={styles.row}>
      <Animated.View style={{ transform: [{ translateY: lift }] }}>
        <Svg width={128} height={112} viewBox="0 0 128 112">
          <Ellipse cx="64" cy="104" rx="28" ry="5" fill="#E2E8F0" />
          <Circle cx="40" cy="72" r="18" fill="#FFFFFF" stroke="#94A3B8" strokeWidth="2" />
          <Circle cx="64" cy="68" r="22" fill="#FFFFFF" stroke="#94A3B8" strokeWidth="2" />
          <Circle cx="86" cy="74" r="16" fill="#FFFFFF" stroke="#94A3B8" strokeWidth="2" />
          <Circle cx="78" cy="40" r="20" fill="#FFFFFF" stroke="#94A3B8" strokeWidth="2" />
          <Ellipse cx="62" cy="32" rx="7" ry="10" fill="#FBCFE8" stroke="#94A3B8" strokeWidth="1.5" />
          <Ellipse cx="94" cy="32" rx="7" ry="10" fill="#FBCFE8" stroke="#94A3B8" strokeWidth="1.5" />
          {eyesClosed ? (
            <>
              <Path d="M70 40 Q74 36 78 40" stroke="#334155" strokeWidth="2" fill="none" />
              <Path d="M82 40 Q86 36 90 40" stroke="#334155" strokeWidth="2" fill="none" />
            </>
          ) : (
            <>
              <Circle cx="74" cy="40" r="2.2" fill="#334155" />
              <Circle cx="86" cy="40" r="2.2" fill="#334155" />
            </>
          )}
          <Path d="M74 48 Q80 52 86 48" stroke="#334155" strokeWidth="1.8" fill="none" />
          {reaction === 'THINKING' ? (
            <Path d="M18 58 h16 v18 h-16 z" fill="#FDE68A" stroke="#B45309" strokeWidth="1.5" />
          ) : null}
          {reaction === 'CONSOLING' ? (
            <Path d="M104 46 v40" stroke="#92400E" strokeWidth="3" strokeLinecap="round" />
          ) : null}
          {reaction === 'CELEBRATING' ? (
            <>
              <Path d="M20 70 q8 -16 16 0" stroke="#D97706" strokeWidth="2" fill="none" />
              <Circle cx="22" cy="28" r="3" fill="#FBBF24" />
              <Circle cx="108" cy="24" r="3" fill="#FBBF24" />
            </>
          ) : null}
          {reaction === 'STREAK_FIRE' ? (
            <Path d="M108 70 q8 -18 0 -28 q6 8 0 16 q-6 -6 0 12 z" fill="#F97316" />
          ) : null}
        </Svg>
      </Animated.View>
      <View style={[styles.bubble, celebrating ? styles.bubbleWarm : null]}>
        <Text style={styles.en}>{line.en}</Text>
        <Text style={styles.pt}>{line.pt}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bubble: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  bubbleWarm: {
    borderColor: '#FDE68A',
    backgroundColor: '#FFFBEB',
  },
  en: {
    color: '#1E3A8A',
    fontWeight: '800',
    fontSize: 15,
  },
  pt: {
    color: '#475569',
    marginTop: 2,
  },
});

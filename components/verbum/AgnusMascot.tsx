import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';

const OUTLINE = '#B08968';
const WOOL_LINE = '#C4A882';

function WoolBall({
  cx,
  cy,
  r,
  fill = '#FFF8F1',
}: {
  cx: number;
  cy: number;
  r: number;
  fill?: string;
}) {
  return <Circle cx={cx} cy={cy} r={r} fill={fill} stroke={WOOL_LINE} strokeWidth={1.35} />;
}

export type AgnusReaction = 'THINKING' | 'CELEBRATING' | 'CONSOLING' | 'STREAK_FIRE';

const LINES: Record<AgnusReaction, { en: string; pt: string }> = {
  THINKING: { en: 'Read it slowly.', pt: 'Leia com calma.' },
  CELEBRATING: { en: 'Excellent!', pt: 'Excelente!' },
  CONSOLING: { en: "Don't give up!", pt: 'Não desista!' },
  STREAK_FIRE: { en: 'The lamp still burns.', pt: 'A lâmpada continua acesa.' },
};

type Props = {
  reaction: AgnusReaction;
  lineEn?: string;
  linePt?: string;
};

export function AgnusMascot({ reaction, lineEn, linePt }: Props) {
  const lift = useRef(new Animated.Value(0)).current;
  const line = {
    en: lineEn ?? LINES[reaction].en,
    pt: linePt ?? LINES[reaction].pt,
  };
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
          <Ellipse cx="64" cy="107" rx="30" ry="3.5" fill="#E7D9CC" />
          {reaction === 'THINKING' ? (
            <>
              <Path d="M6 80 h13 v15 h-13 z" fill="#FDE68A" stroke="#B45309" strokeWidth="1.3" />
              <Path d="M12.5 80 v15" stroke="#B45309" strokeWidth="1" />
            </>
          ) : null}
          {reaction === 'CONSOLING' ? (
            <Path
              d="M116 92 V48 q0 -12 8 -10"
              stroke="#8B5E34"
              strokeWidth="2.4"
              fill="none"
              strokeLinecap="round"
            />
          ) : null}
          <Path d="M40 46 C28 34 8 36 6 48 C4 60 24 62 40 54 Z" fill="#F6D5C0" stroke={OUTLINE} strokeWidth="1.6" />
          <Path d="M36 47 C26 40 14 42 13 49 C12 55 26 57 36 52 Z" fill="#F7B6C4" />
          <Path d="M88 46 C100 34 120 36 122 48 C124 60 104 62 88 54 Z" fill="#F6D5C0" stroke={OUTLINE} strokeWidth="1.6" />
          <Path d="M92 47 C102 40 114 42 115 49 C116 55 102 57 92 52 Z" fill="#F7B6C4" />
          <WoolBall cx={38} cy={98} r={9} fill="#F3E0D0" />
          <WoolBall cx={90} cy={98} r={9} fill="#F3E0D0" />
          <WoolBall cx={50} cy={94} r={12} />
          <WoolBall cx={78} cy={94} r={12} />
          <WoolBall cx={64} cy={98} r={14} fill="#FFF9F4" />
          <WoolBall cx={56} cy={106} r={8} fill="#F6E7D8" />
          <WoolBall cx={74} cy={106} r={8} fill="#F6E7D8" />
          <Ellipse cx="64" cy="58" rx="26" ry="23" fill="#FFF6EC" stroke={OUTLINE} strokeWidth="1.8" />
          <WoolBall cx={64} cy={14} r={6} />
          <WoolBall cx={56} cy={20} r={8} />
          <WoolBall cx={72} cy={20} r={8} />
          <WoolBall cx={64} cy={26} r={11} fill="#FFF9F4" />
          <WoolBall cx={48} cy={30} r={9} />
          <WoolBall cx={80} cy={30} r={9} />
          <WoolBall cx={40} cy={38} r={7} fill="#F6E7D8" />
          <WoolBall cx={88} cy={38} r={7} fill="#F6E7D8" />
          <Ellipse cx="44" cy="66" rx="5" ry="3" fill="#F8C5D0" fillOpacity={0.85} />
          <Ellipse cx="84" cy="66" rx="5" ry="3" fill="#F8C5D0" fillOpacity={0.85} />
          {eyesClosed ? (
            <>
              <Path d="M47 55 Q53 49 59 55" stroke="#4A3328" strokeWidth="2.1" fill="none" strokeLinecap="round" />
              <Path d="M69 55 Q75 49 81 55" stroke="#4A3328" strokeWidth="2.1" fill="none" strokeLinecap="round" />
            </>
          ) : (
            <>
              <Ellipse cx="53" cy="55" rx="4.6" ry="5.3" fill="#4A3328" />
              <Ellipse cx="75" cy="55" rx="4.6" ry="5.3" fill="#4A3328" />
              <Circle cx="51.5" cy="53.2" r="1.7" fill="#FFFFFF" />
              <Circle cx="73.5" cy="53.2" r="1.7" fill="#FFFFFF" />
            </>
          )}
          <Path
            d="M64 62.5 c-1.3 0 -2.5 1.2 -2.5 2.5 c0 1.7 1.1 2.7 2.5 3.5 c1.4 -0.8 2.5 -1.8 2.5 -3.5 c0 -1.3 -1.2 -2.5 -2.5 -2.5 z"
            fill="#F29AAB"
          />
          <Path
            d={eyesClosed ? 'M54 68 Q64 76 74 68' : 'M57 69 Q64 73.5 71 69'}
            stroke="#E08E99"
            strokeWidth="1.6"
            fill="none"
            strokeLinecap="round"
          />
          {reaction === 'CELEBRATING' ? (
            <>
              <Circle cx="18" cy="20" r="2.4" fill="#FBBF24" />
              <Circle cx="112" cy="16" r="2.4" fill="#FBBF24" />
              <Path d="M14 70 q6 -12 12 0" stroke="#D97706" strokeWidth="1.8" fill="none" />
            </>
          ) : null}
          {reaction === 'STREAK_FIRE' ? (
            <Path d="M112 34 q6 -14 0 -22 q5 6 0 12 q-5 -5 0 10 z" fill="#F97316" />
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

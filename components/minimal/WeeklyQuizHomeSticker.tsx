import { fetchMemberWeeklyQuiz, formatSermonDateLabel } from '@/lib/weeklyQuizApi';
import { withFailClosedReturn } from '@/lib/failClosedNavigation';
import { subscribeActiveTenantChange } from '@/lib/tenantSession';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

const COLLAPSED_WIDTH = 48;
const EXPANDED_WIDTH = 268;
const STICKER_YELLOW = '#FACC15';
const STICKER_YELLOW_DARK = '#CA8A04';
const STICKER_INK = '#422006';

/** Etiqueta amarela do quiz, na borda direita da Home, no mesmo formato da admissão. */
export function WeeklyQuizHomeSticker() {
  const router = useRouter();
  const [title, setTitle] = useState<string | null>(null);
  const [dateLabel, setDateLabel] = useState('');
  const [resume, setResume] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const widthAnim = useRef(new Animated.Value(COLLAPSED_WIDTH)).current;

  const load = useCallback(async () => {
    try {
      const state = await fetchMemberWeeklyQuiz();
      const quiz = state.quiz;

      if (!quiz || quiz.completed) {
        setTitle(null);
        setDateLabel('');
        setResume(false);
        return;
      }

      setTitle(quiz.title);
      setDateLabel(formatSermonDateLabel(quiz.sermonPublishedAt));
      setResume(quiz.answeredCount > 0);
    } catch {
      setTitle(null);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
      return subscribeActiveTenantChange(() => {
        void load();
      });
    }, [load])
  );

  useEffect(() => {
    if (!title) {
      setExpanded(false);
      widthAnim.setValue(COLLAPSED_WIDTH);
    }
  }, [title, widthAnim]);

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: expanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH,
      duration: 220,
      useNativeDriver: false,
    }).start();
  }, [expanded, widthAnim]);

  if (!title) {
    return null;
  }

  const meta = `${dateLabel ? `Publicada em ${dateLabel} · ` : ''}${
    resume ? 'Continue de onde parou' : '10 perguntas para responder'
  }`;

  const openQuiz = () => {
    router.push({
      pathname: '/quiz-semanal',
      params: withFailClosedReturn({ contexto: '1' }),
    });
  };

  return (
    <View style={styles.anchor} pointerEvents="box-none">
      <Animated.View style={[styles.sticker, { width: widthAnim }]}>
        <Pressable
          onPress={() => setExpanded((current) => !current)}
          style={styles.tabHit}
          accessibilityRole="button"
          accessibilityLabel={
            expanded ? 'Recolher o quiz da pregação' : 'Expandir o quiz da pregação'
          }
        >
          <MaterialIcons name="quiz" size={20} color={STICKER_INK} />
          <View style={styles.divider} />
        </Pressable>

        {expanded ? (
          <Pressable
            onPress={openQuiz}
            style={styles.messageHit}
            accessibilityRole="button"
            accessibilityLabel="Abrir o quiz da pregação"
          >
            <View style={styles.copy}>
              <Text style={styles.kicker}>Quiz da última pregação</Text>
              <Text style={styles.title} numberOfLines={2}>
                {title}
              </Text>
              <Text style={styles.meta} numberOfLines={2}>
                {meta}
              </Text>
            </View>
            <MaterialIcons name="chevron-right" size={18} color={STICKER_INK} />
          </Pressable>
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: {
    position: 'absolute',
    top: 12,
    right: 0,
    zIndex: 51,
    alignItems: 'flex-end',
  },
  sticker: {
    minHeight: 48,
    maxWidth: '92%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: STICKER_YELLOW,
    borderTopLeftRadius: 10,
    borderBottomLeftRadius: 10,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    borderWidth: 1,
    borderRightWidth: 0,
    borderColor: STICKER_YELLOW_DARK,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: -2, height: 2 },
    elevation: 4,
  },
  tabHit: {
    width: COLLAPSED_WIDTH,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 8,
    paddingRight: 6,
    gap: 6,
  },
  divider: {
    width: StyleSheet.hairlineWidth * 2,
    alignSelf: 'stretch',
    marginVertical: 10,
    backgroundColor: STICKER_YELLOW_DARK,
  },
  messageHit: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingRight: 10,
    paddingVertical: 8,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  kicker: {
    color: STICKER_INK,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  title: {
    color: STICKER_INK,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 15,
  },
  meta: {
    color: STICKER_INK,
    fontSize: 11,
    lineHeight: 14,
  },
});

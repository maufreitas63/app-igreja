import { speakVerse } from '@/lib/verbum/api';
import type { LessonVerb } from '@/lib/verbum/types';
import { MaterialIcons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  verbs: LessonVerb[];
  onConclude: () => void;
};

export function LessonVerbSummary({ verbs, onConclude }: Props) {
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 280, useNativeDriver: true }).start();
  }, [fade]);

  return (
    <Animated.View style={[styles.wrap, { opacity: fade }]}>
      <View style={styles.header}>
        <MaterialIcons name="menu-book" size={28} color="#1E3A8A" />
        <Text style={styles.title}>Pílula de Gramática: Verbos da Lição</Text>
      </View>
      {verbs.map((verb) => (
        <View key={verb.id} style={styles.card}>
          <Text style={styles.root}>
            {verb.infinitiveEn}
            <Text style={styles.rootPt}>{` (${verb.infinitivePt})`}</Text>
          </Text>
          <View style={styles.badges}>
            <Text style={styles.badge}>{verb.tenseEn}</Text>
            <Text style={styles.badge}>{verb.tensePt}</Text>
            <Text style={[styles.badge, verb.verbType === 'IRREGULAR' ? styles.badgeIrregular : null]}>
              {verb.verbType === 'IRREGULAR' ? 'Irregular' : verb.verbType === 'MODAL' ? 'Modal' : 'Regular'}
            </Text>
          </View>
          <Text style={styles.verse}>{verb.verseEn}</Text>
          <Text style={styles.versePt}>{verb.versePt}</Text>
          <View style={styles.columns}>
            <Text style={styles.columnTitle}>Inglês</Text>
            <Text style={styles.columnTitle}>Português</Text>
          </View>
          {verb.conjugations.map((row) => (
            <View key={`${verb.id}-${row.person}-${row.pronounEn}`} style={styles.pair}>
              <View style={styles.cell}>
                <Text style={styles.form}>{`${row.pronounEn} ${row.formEn}`}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Ouvir ${row.pronounEn} ${row.formEn}`}
                  onPress={() => speakVerse(`${row.pronounEn} ${row.formEn}`, null)}
                  style={styles.speaker}
                >
                  <MaterialIcons name="volume-up" size={18} color="#0369A1" />
                </Pressable>
              </View>
              <Text style={styles.formPt}>{`${row.pronounPt} ${row.formPt}`}</Text>
            </View>
          ))}
        </View>
      ))}
      <Pressable style={styles.conclude} onPress={onConclude} accessibilityRole="button">
        <Text style={styles.concludeLabel}>CONCLUIR LIÇÃO & COLETAR TALENTOS</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 12,
  },
  header: {
    alignItems: 'center',
    gap: 6,
  },
  title: {
    color: '#1E3A8A',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#DBE4F3',
    padding: 16,
    gap: 8,
  },
  root: {
    color: '#1E3A8A',
    fontSize: 22,
    fontWeight: '800',
  },
  rootPt: {
    color: '#3B4F93',
    fontWeight: '700',
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  badge: {
    overflow: 'hidden',
    backgroundColor: '#E0F2FE',
    color: '#0369A1',
    fontWeight: '800',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeIrregular: {
    backgroundColor: '#FFE4E6',
    color: '#BE123C',
  },
  verse: {
    color: '#24315C',
    fontWeight: '700',
    lineHeight: 22,
  },
  versePt: {
    color: '#64748B',
    lineHeight: 20,
  },
  columns: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  columnTitle: {
    flex: 1,
    color: '#1E3A8A',
    fontWeight: '800',
  },
  pair: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  form: {
    flex: 1,
    color: '#24315C',
    fontWeight: '700',
  },
  formPt: {
    flex: 1,
    color: '#334155',
    fontWeight: '700',
  },
  speaker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E0F2FE',
  },
  conclude: {
    minHeight: 54,
    borderRadius: 16,
    borderBottomWidth: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    borderBottomColor: '#047857',
    paddingHorizontal: 12,
  },
  concludeLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.4,
    textAlign: 'center',
  },
});

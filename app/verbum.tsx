import { AgnusMascot } from '@/components/verbum/AgnusMascot';
import { CloseFooterBar } from '@/components/minimal/CloseFooterBar';
import { MinimalScreenLayout } from '@/components/minimal/MinimalScreenLayout';
import { useReturnToCallerOnLeave } from '@/hooks/useReturnToCallerOnLeave';
import { resolveReturnDashboardCardParam, resolveReturnRouteParam, withReturnRoute } from '@/lib/dashboardReturnNavigation';
import { loadVerbumCourse, restoreVerbumShield } from '@/lib/verbum/api';
import type { VerbumCourseHome, VerbumPathNode } from '@/lib/verbum/types';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

const NAVY = '#1E3A8A';
const LOCK_MESSAGE = 'Complete as lições anteriores para desbloquear este memorial!';

function sideStyle(index: number) {
  const slot = index % 5;
  if (slot === 1) {
    return 'left' as const;
  }
  if (slot === 3) {
    return 'right' as const;
  }
  return 'center' as const;
}

export default function VerbumScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const returnRoute = resolveReturnRouteParam(params) || '/escolha-plataforma';
  const returnToCaller = useReturnToCallerOnLeave({
    returnRoute,
    returnDashboardCard: resolveReturnDashboardCardParam(params),
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [course, setCourse] = useState<VerbumCourseHome | null>(null);
  const [lockedId, setLockedId] = useState<number | null>(null);
  const [selected, setSelected] = useState<VerbumPathNode | null>(null);
  const pulse = useRef(new Animated.Value(1)).current;
  const shake = useRef(new Animated.Value(0)).current;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setCourse(await loadVerbumCourse());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível abrir o Verbum.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const openLesson = (lessonId: number) => {
    router.push({
      pathname: '/verbum-licao',
      params: withReturnRoute('/verbum', { lessonId: String(lessonId) }),
    });
  };

  const openCanon = () => {
    router.push({
      pathname: '/verbum-canon',
      params: withReturnRoute(returnRoute),
    });
  };

  const practiceMemorial = async () => {
    try {
      const learner = await restoreVerbumShield();
      setCourse((current) => (current ? { ...current, learner } : current));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível restaurar o escudo.');
    }
  };

  const onNode = (node: VerbumPathNode) => {
    if (node.status === 'locked') {
      setLockedId(node.id);
      shake.setValue(0);
      Animated.sequence([
        Animated.timing(shake, { toValue: -10, duration: 50, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 10, duration: 50, useNativeDriver: true }),
        Animated.timing(shake, { toValue: -10, duration: 50, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 10, duration: 50, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 0, duration: 50, useNativeDriver: true }),
      ]).start();
      return;
    }
    setLockedId(null);
    setSelected(node);
  };

  const continueSelected = () => {
    if (!selected?.nextLessonId) {
      return;
    }
    const lessonId = selected.nextLessonId;
    setSelected(null);
    openLesson(lessonId);
  };

  const shieldsLabel = course?.learner.infiniteShields
    ? 'Escudos infinitos'
    : `${course?.learner.shields ?? 0} Escudos de Fé`;
  const section = course?.section;

  return (
    <MinimalScreenLayout scroll={false} footer={<CloseFooterBar onPress={returnToCaller} />}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Verbum</Text>
        <Text style={styles.subtitle}>Inglês de Gênesis ao Apocalipse</Text>
        <Pressable style={styles.canon} onPress={openCanon} accessibilityRole="button">
          <Text style={styles.canonLabel}>Cânon</Text>
        </Pressable>
        {loading ? <ActivityIndicator color={NAVY} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {course ? (
          <>
            <View style={styles.stats}>
              <Text style={styles.stat}>Lâmpada acesa: {course.learner.streak}</Text>
              <Text style={styles.stat}>{shieldsLabel}</Text>
              <Text style={styles.stat}>{course.learner.talents} Talentos</Text>
            </View>
            {section ? (
              <View style={styles.banner}>
                <Text style={styles.bannerTitle}>{section.title}</Text>
                <Text style={styles.bannerMeta}>
                  Nível {section.cefr} · {section.book}
                </Text>
              </View>
            ) : null}
            {course.learner.shields <= 0 && !course.learner.infiniteShields ? (
              <Pressable style={styles.secondary} onPress={() => void practiceMemorial()} accessibilityRole="button">
                <Text style={styles.secondaryLabel}>
                  Altar de Memoriais ({course.memorialsDue} para restaurar)
                </Text>
              </Pressable>
            ) : null}
            {course.path.reduce<VerbumPathNode[][]>((groups, node) => {
              const last = groups[groups.length - 1];
              if (!last || last[0]?.unitTitle !== node.unitTitle) {
                groups.push([node]);
              } else {
                last.push(node);
              }
              return groups;
            }, []).map((nodes) => (
              <View key={nodes[0].unitTitle} style={styles.unitBlock}>
                <View style={styles.unitBanner}>
                  <Text style={styles.unitBannerText}>{nodes[0].unitTitle}</Text>
                </View>
                <View style={styles.path}>
                  {nodes.map((node, index) => {
                    const side = sideStyle(index);
                    const current = node.status === 'current';
                    return (
                      <View key={node.id} style={[styles.nodeWrap, styles[side]]}>
                        {current ? (
                          <AgnusMascot
                            reaction="THINKING"
                            lineEn="Ready for the next step?"
                            linePt="Pronto para dar o próximo passo?"
                          />
                        ) : null}
                        <Animated.View
                          style={{
                            transform: [
                              ...(current ? [{ scale: pulse }] : []),
                              ...(lockedId === node.id ? [{ translateX: shake }] : []),
                            ],
                          }}
                        >
                          <Pressable
                            accessibilityRole="button"
                            onPress={() => onNode(node)}
                            style={[
                              styles.node,
                              current ? styles.nodeCurrent : null,
                              node.boss ? styles.nodeBoss : null,
                              node.status === 'done' ? styles.nodeDone : null,
                              node.status === 'done' && node.boss ? styles.nodeCrown : null,
                              node.status === 'locked' ? styles.nodeLocked : null,
                            ]}
                          >
                            <Text style={[styles.nodeMark, node.status === 'locked' ? styles.nodeMarkLocked : null]}>
                              {node.status === 'locked' ? '🔒' : node.boss ? '♛' : node.status === 'done' ? '★' : String(node.seq)}
                            </Text>
                          </Pressable>
                        </Animated.View>
                        <Text style={styles.nodeTitle}>{node.title}</Text>
                        {node.status === 'done' ? <Text style={styles.stars}>★★★</Text> : null}
                        {lockedId === node.id ? <Text style={styles.lockNote}>{LOCK_MESSAGE}</Text> : null}
                      </View>
                    );
                  })}
                </View>
              </View>
            ))}
          </>
        ) : null}
      </ScrollView>
      <Modal visible={selected != null} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <View style={styles.backdrop}>
          <Pressable style={styles.backdropTap} onPress={() => setSelected(null)} />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{selected?.title}</Text>
            <Text style={styles.modalProgress}>
              {selected
                ? `Lição ${selected.status === 'done' ? selected.totalLevels : selected.completedLevels + 1} de ${selected.totalLevels}`
                : ''}
            </Text>
            <Pressable
              accessibilityRole="button"
              disabled={!selected?.nextLessonId}
              onPress={continueSelected}
              style={({ pressed }) => [styles.modalButton, pressed ? styles.modalButtonPressed : null]}
            >
              <Text style={styles.modalButtonLabel}>
                {selected?.status === 'done' ? 'REVER' : `CONTINUAR (+${selected?.xpReward ?? 15} XP)`}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </MinimalScreenLayout>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 28,
    gap: 10,
  },
  title: {
    color: NAVY,
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    color: '#3B4F93',
    fontSize: 16,
    textAlign: 'center',
  },
  canon: {
    alignSelf: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#8FB4E0',
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  canonLabel: {
    color: NAVY,
    fontWeight: '800',
  },
  error: {
    color: '#B91C1C',
    textAlign: 'center',
  },
  stats: {
    gap: 2,
  },
  stat: {
    color: '#24315C',
    fontSize: 14,
    textAlign: 'center',
  },
  banner: {
    backgroundColor: NAVY,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  bannerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  bannerMeta: {
    color: '#DBEAFE',
    textAlign: 'center',
    marginTop: 4,
  },
  secondary: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#8FB4E0',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  secondaryLabel: {
    color: NAVY,
    fontWeight: '700',
    textAlign: 'center',
  },
  unitBlock: {
    gap: 8,
    marginTop: 8,
  },
  unitBanner: {
    backgroundColor: '#F7F6EF',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  unitBannerText: {
    color: NAVY,
    fontWeight: '800',
    textAlign: 'center',
  },
  path: {
    gap: 8,
    paddingTop: 4,
  },
  nodeWrap: {
    width: '78%',
    alignItems: 'center',
    gap: 6,
  },
  left: {
    alignSelf: 'flex-start',
  },
  center: {
    alignSelf: 'center',
  },
  right: {
    alignSelf: 'flex-end',
  },
  node: {
    width: 74,
    height: 74,
    borderRadius: 37,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
    borderBottomWidth: 6,
    borderBottomColor: '#1E3A8A',
  },
  nodeCurrent: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 4,
    borderColor: '#BFDBFE',
  },
  nodeBoss: {
    width: 108,
    height: 108,
    borderRadius: 54,
  },
  nodeDone: {
    backgroundColor: '#059669',
    borderBottomColor: '#065F46',
  },
  nodeCrown: {
    backgroundColor: '#D97706',
    borderBottomColor: '#92400E',
  },
  nodeLocked: {
    backgroundColor: '#E2E8F0',
    borderBottomColor: '#94A3B8',
  },
  nodeMark: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
  },
  nodeMarkLocked: {
    color: '#64748B',
  },
  nodeTitle: {
    color: '#24315C',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  lockNote: {
    color: '#9F1239',
    backgroundColor: '#FFE4E6',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    textAlign: 'center',
    fontWeight: '700',
  },
  stars: {
    color: '#D97706',
    fontWeight: '800',
    letterSpacing: 2,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  backdropTap: {
    ...StyleSheet.absoluteFillObject,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    gap: 12,
    zIndex: 2,
  },
  modalTitle: {
    color: NAVY,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  modalProgress: {
    color: '#3B4F93',
    textAlign: 'center',
    fontSize: 16,
  },
  modalButton: {
    backgroundColor: '#10B981',
    borderRadius: 16,
    borderBottomWidth: 4,
    borderBottomColor: '#047857',
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalButtonPressed: {
    borderBottomWidth: 0,
    marginTop: 4,
  },
  modalButtonLabel: {
    color: '#FFFFFF',
    fontWeight: '800',
    letterSpacing: 0.6,
  },
});

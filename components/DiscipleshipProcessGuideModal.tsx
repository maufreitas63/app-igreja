import {
  DISCIPLESHIP_PROCESS_GUIDE_INTRO,
  DISCIPLESHIP_PROCESS_GUIDE_STEPS,
} from '@/lib/discipleshipProcessGuide';
import { MINIMAL_SECTION_TITLE, MINIMAL_UI } from '@/lib/minimalUiTheme';
import { FontAwesome } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  visible: boolean;
  onClose: () => void;
};

const SCREEN_WIDTH = Dimensions.get('window').width;
const DRAWER_WIDTH = Math.min(420, Math.round(SCREEN_WIDTH * 0.92));

/**
 * Drawer/modal com o descritivo dos 5 passos da Trilha —
 * orientação rápida para pastores e mentores.
 */
export function DiscipleshipProcessGuideModal({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const slideX = useRef(new Animated.Value(DRAWER_WIDTH)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      slideX.setValue(DRAWER_WIDTH);
      backdropOpacity.setValue(0);
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.spring(slideX, {
          toValue: 0,
          friction: 9,
          tension: 68,
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }

    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(slideX, {
        toValue: DRAWER_WIDTH,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, backdropOpacity, slideX]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent={Platform.OS === 'android'}
    >
      <View style={styles.root} pointerEvents="box-none">
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Fechar guia">
          <Animated.View
            style={[
              styles.backdrop,
              {
                opacity: backdropOpacity.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 0.45],
                }),
              },
            ]}
          />
        </Pressable>

        <Animated.View
          style={[
            styles.drawer,
            {
              width: DRAWER_WIDTH,
              paddingTop: Math.max(insets.top, 12),
              paddingBottom: Math.max(insets.bottom, 16),
              transform: [{ translateX: slideX }],
            },
          ]}
        >
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.kicker}>Liderança pastoral</Text>
              <Text style={styles.title}>Guia do Processo</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Fechar"
              activeOpacity={0.85}
            >
              <FontAwesome name="times" size={18} color={MINIMAL_UI.icon} />
            </TouchableOpacity>
          </View>

          <Text style={styles.intro}>{DISCIPLESHIP_PROCESS_GUIDE_INTRO}</Text>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {DISCIPLESHIP_PROCESS_GUIDE_STEPS.map((step) => (
              <View key={step.step} style={styles.stepCard}>
                <View style={styles.stepHeader}>
                  <View style={styles.stepBadge}>
                    <Text style={styles.stepBadgeText}>{step.step}</Text>
                  </View>
                  <Text style={styles.stepTitle}>{step.title}</Text>
                </View>

                <Text style={styles.sectionLabel}>Propósito</Text>
                <Text style={styles.purposeText}>{step.purpose}</Text>

                <Text style={styles.sectionLabel}>Foco do líder</Text>
                <Text style={styles.focusText}>{step.leaderFocus}</Text>
              </View>
            ))}
          </ScrollView>

          <TouchableOpacity style={styles.doneBtn} onPress={onClose} activeOpacity={0.85}>
            <Text style={styles.doneBtnText}>Entendi</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0F172A',
  },
  drawer: {
    height: '100%',
    backgroundColor: MINIMAL_UI.background,
    borderLeftWidth: 1,
    borderLeftColor: MINIMAL_UI.border,
    paddingHorizontal: 18,
    shadowColor: '#0F172A',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: -4, height: 0 },
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 10,
  },
  headerCopy: {
    flex: 1,
    gap: 2,
  },
  kicker: {
    color: MINIMAL_UI.textMuted,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  title: {
    ...MINIMAL_SECTION_TITLE,
    textAlign: 'left',
    paddingHorizontal: 0,
    fontSize: 22,
  },
  closeBtn: {
    padding: 8,
    marginTop: 2,
  },
  intro: {
    color: MINIMAL_UI.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 14,
  },
  scroll: {
    flex: 1,
    minHeight: 0,
  },
  scrollContent: {
    gap: 12,
    paddingBottom: 12,
  },
  stepCard: {
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    borderRadius: 14,
    backgroundColor: MINIMAL_UI.rowHover,
    padding: 14,
    gap: 6,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 4,
  },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: MINIMAL_UI.blueDark,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepBadgeText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
  },
  stepTitle: {
    flex: 1,
    color: MINIMAL_UI.blueDark,
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 21,
  },
  sectionLabel: {
    marginTop: 4,
    color: MINIMAL_UI.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  purposeText: {
    color: MINIMAL_UI.text,
    fontSize: 13,
    lineHeight: 19,
  },
  focusText: {
    color: MINIMAL_UI.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  doneBtn: {
    marginTop: 8,
    backgroundColor: MINIMAL_UI.blueDark,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  doneBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 14,
  },
});

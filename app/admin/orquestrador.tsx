import {
  fetchEventControlState,
  sessionCanManageEventControl,
  updateEventControlRoute,
} from '@/lib/eventOrchestrationApi';
import {
  EVENT_ORCHESTRATION_LEADER_BUTTONS,
  type EventOrchestrationRouteCode,
} from '@/lib/eventOrchestrationRoutes';
import { usePalette } from '@/context/PaletteContext';
import { buildIndexScreenGradient } from '@/lib/paletteTheme';
import { showAppToast } from '@/lib/appToast';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function EventOrchestratorScreen() {
  const router = useRouter();
  const { colors } = usePalette();
  const gradient = buildIndexScreenGradient(colors);

  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [activeRoute, setActiveRoute] = useState<EventOrchestrationRouteCode | null>(null);
  const [savingRoute, setSavingRoute] = useState<EventOrchestrationRouteCode | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadState = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [canManage, state] = await Promise.all([
        sessionCanManageEventControl(),
        fetchEventControlState(),
      ]);

      setAllowed(canManage);
      setActiveRoute(state?.activeRoute ?? null);

      if (!canManage) {
        setError('Apenas administradores podem usar o orquestrador.');
      }
    } catch (loadError) {
      setAllowed(false);
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Não foi possível carregar o orquestrador.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  const handleSelectRoute = async (routeCode: EventOrchestrationRouteCode) => {
    if (!allowed || savingRoute) {
      return;
    }

    setSavingRoute(routeCode);
    setError(null);

    try {
      const result = await updateEventControlRoute(routeCode);

      if (!result.success) {
        setError(result.message);
        showAppToast({ type: 'error', text1: 'Orquestrador', text2: result.message });
        return;
      }

      setActiveRoute(routeCode);
      showAppToast({
        type: 'success',
        text1: 'Orquestrador',
        text2: `Rota ativa: ${EVENT_ORCHESTRATION_LEADER_BUTTONS.find((item) => item.code === routeCode)?.label ?? routeCode}`,
      });
    } catch (saveError) {
      const message =
        saveError instanceof Error ? saveError.message : 'Não foi possível atualizar a rota.';
      setError(message);
      showAppToast({ type: 'error', text1: 'Orquestrador', text2: message });
    } finally {
      setSavingRoute(null);
    }
  };

  return (
    <LinearGradient colors={gradient} style={styles.gradient}>
      <SafeAreaView style={styles.safeArea}>
        <Stack.Screen options={{ headerShown: false }} />
        <ScrollView contentContainerStyle={styles.content}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>Voltar</Text>
          </Pressable>

          <Text style={styles.title}>Orquestrador do Evento</Text>
          <Text style={styles.subtitle}>
            Escolha para onde os membros conectados devem ser guiados em tempo real.
          </Text>

          {loading ? <ActivityIndicator color={colors.accent} size="large" /> : null}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {!loading && allowed ? (
            <View style={styles.buttonsGrid}>
              {EVENT_ORCHESTRATION_LEADER_BUTTONS.map((option) => {
                const isActive = activeRoute === option.code;
                const isSaving = savingRoute === option.code;

                return (
                  <Pressable
                    key={option.code}
                    style={[
                      styles.routeButton,
                      {
                        backgroundColor: isActive ? colors.primary : `${colors.primary}CC`,
                        borderColor: isActive ? colors.accent : `${colors.accent}66`,
                      },
                    ]}
                    onPress={() => void handleSelectRoute(option.code)}
                    disabled={Boolean(savingRoute)}
                  >
                    {isSaving ? (
                      <ActivityIndicator color="#0F172A" />
                    ) : (
                      <>
                        <Text style={styles.routeButtonLabel}>{option.label}</Text>
                        <Text style={styles.routeButtonHint}>{option.code}</Text>
                      </>
                    )}
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {!loading ? (
            <Pressable
              style={[styles.refreshButton, { borderColor: `${colors.accent}88` }]}
              onPress={() => void loadState()}
            >
              <Text style={[styles.refreshButtonText, { color: colors.accent }]}>
                Atualizar status
              </Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 28,
    gap: 14,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  backButtonText: {
    color: '#CBD5E1',
    fontSize: 14,
    fontWeight: '700',
  },
  title: {
    color: '#F8FAFC',
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 13,
    lineHeight: 18,
  },
  buttonsGrid: {
    gap: 12,
  },
  routeButton: {
    minHeight: 88,
    borderRadius: 18,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 18,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  routeButtonLabel: {
    color: '#0F172A',
    fontSize: 22,
    fontWeight: '900',
  },
  routeButtonHint: {
    color: 'rgba(15, 23, 42, 0.72)',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  refreshButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 8,
  },
  refreshButtonText: {
    fontSize: 13,
    fontWeight: '800',
  },
});

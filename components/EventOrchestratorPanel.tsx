import { EventAvisosManager } from '@/components/EventAvisosManager';
import { usePalette } from '@/context/PaletteContext';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import {
  fetchEventControlState,
  sessionCanManageEventControl,
  updateEventControlRoute,
} from '@/lib/eventOrchestrationApi';
import {
  EVENT_ORCHESTRATION_LEADER_BUTTONS,
  type EventOrchestrationLeaderRouteCode,
} from '@/lib/eventOrchestrationRoutes';
import { showAppToast } from '@/lib/appToast';
import { triggerOrchestrationButtonHaptic } from '@/lib/eventOrchestrationHaptics';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

type Props = {
  isActive?: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
  showTitle?: boolean;
  compact?: boolean;
  minimal?: boolean;
};

export function EventOrchestratorPanel({
  isActive = true,
  contentContainerStyle,
  showTitle = true,
  compact = false,
  minimal = false,
}: Props) {
  const { colors } = usePalette();

  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [activeRoute, setActiveRoute] = useState<EventOrchestrationLeaderRouteCode | null>(null);
  const [savingRoute, setSavingRoute] = useState<EventOrchestrationLeaderRouteCode | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadState = useCallback(async () => {
    if (!isActive) {
      return;
    }

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
        setError('Apenas perfis com o papel Orquestrador de Evento podem usar o orquestrador.');
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
  }, [isActive]);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  const handleSelectRoute = async (routeCode: EventOrchestrationLeaderRouteCode) => {
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
    <ScrollView
      style={[minimal && styles.scrollMinimal]}
      contentContainerStyle={[
        styles.content,
        compact && styles.contentCompact,
        minimal && styles.contentMinimal,
        contentContainerStyle,
      ]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {showTitle ? (
        <>
          <Text
            style={[
              styles.title,
              compact && styles.titleCompact,
              minimal && styles.titleMinimal,
            ]}
          >
            Orquestrador do Evento
          </Text>
          <Text style={[styles.subtitle, minimal && styles.subtitleMinimal]}>
            Escolha para onde os membros conectados devem ser guiados em tempo real.
          </Text>
        </>
      ) : null}

      {loading ? (
        <ActivityIndicator color={minimal ? MINIMAL_UI.accent : colors.accent} size="large" />
      ) : null}
      {error ? <Text style={[styles.errorText, minimal && styles.errorTextMinimal]}>{error}</Text> : null}

      {!loading && allowed ? (
        <View style={[styles.buttonsGrid, minimal && styles.buttonsGridMinimal]}>
          {EVENT_ORCHESTRATION_LEADER_BUTTONS.map((option) => {
            const isActiveRoute = activeRoute === option.code;
            const isSaving = savingRoute === option.code;

            return (
              <Pressable
                key={option.code}
                style={[
                  styles.routeButton,
                  compact && styles.routeButtonCompact,
                  minimal && styles.routeButtonMinimal,
                  minimal && isActiveRoute && styles.routeButtonActiveMinimal,
                  !minimal && {
                    backgroundColor: isActiveRoute ? colors.primary : `${colors.primary}CC`,
                    borderColor: isActiveRoute ? colors.accent : `${colors.accent}66`,
                  },
                ]}
                onPress={() => void handleSelectRoute(option.code)}
                onPressIn={triggerOrchestrationButtonHaptic}
                disabled={Boolean(savingRoute)}
              >
                {isSaving ? (
                  <ActivityIndicator color={minimal ? MINIMAL_UI.onDark : '#0F172A'} />
                ) : (
                  <>
                    <Text
                      style={[
                        styles.routeButtonLabel,
                        compact && styles.routeButtonLabelCompact,
                        minimal && styles.routeButtonLabelMinimal,
                        minimal && isActiveRoute && styles.routeButtonLabelActiveMinimal,
                      ]}
                    >
                      {option.label}
                    </Text>
                    {!compact ? (
                      <Text
                        style={[
                          styles.routeButtonHint,
                          minimal && styles.routeButtonHintMinimal,
                          minimal && isActiveRoute && styles.routeButtonHintActiveMinimal,
                        ]}
                      >
                        {option.code}
                      </Text>
                    ) : null}
                  </>
                )}
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {!loading && allowed ? <EventAvisosManager isActive={isActive} minimal={minimal} /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 14,
    paddingBottom: 8,
  },
  contentCompact: {
    gap: 10,
  },
  title: {
    color: '#3A96DD',
    fontSize: 22,
    fontWeight: '800',
  },
  titleCompact: {
    fontSize: 18,
  },
  subtitle: {
    color: 'rgba(58, 150, 221, 0.82)',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 4,
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 13,
    lineHeight: 18,
  },
  buttonsGrid: {
    gap: 10,
  },
  routeButton: {
    minHeight: 72,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  routeButtonCompact: {
    minHeight: 58,
    borderRadius: 14,
    paddingVertical: 10,
  },
  routeButtonLabel: {
    color: '#0F172A',
    fontSize: 20,
    fontWeight: '900',
  },
  routeButtonLabelCompact: {
    fontSize: 17,
  },
  routeButtonHint: {
    color: 'rgba(15, 23, 42, 0.72)',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 3,
  },
  contentMinimal: {
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    alignSelf: 'stretch',
  },
  titleMinimal: {
    color: MINIMAL_UI.text,
  },
  subtitleMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  errorTextMinimal: {
    color: '#DC2626',
  },
  buttonsGridMinimal: {
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
  },
  routeButtonMinimal: {
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    alignSelf: 'stretch',
    backgroundColor: MINIMAL_UI.background,
    borderColor: MINIMAL_UI.border,
  },
  routeButtonActiveMinimal: {
    backgroundColor: MINIMAL_UI.blueDark,
    borderColor: MINIMAL_UI.blueDark,
  },
  routeButtonLabelMinimal: {
    color: MINIMAL_UI.text,
    fontWeight: '700',
  },
  routeButtonLabelActiveMinimal: {
    color: MINIMAL_UI.onDark,
  },
  routeButtonHintMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  routeButtonHintActiveMinimal: {
    color: 'rgba(255, 255, 255, 0.82)',
  },
  scrollMinimal: {
    flex: 1,
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    alignSelf: 'stretch',
  },
});

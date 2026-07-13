import { EventAvisosManager } from '@/components/EventAvisosManager';
import { usePalette } from '@/context/PaletteContext';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import { sessionCanManageEventControl } from '@/lib/eventOrchestrationApi';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
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

/** Painel de manutenção de avisos (ex-orquestrador de rotas do culto). */
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
  const [error, setError] = useState<string | null>(null);

  const loadState = useCallback(async () => {
    if (!isActive) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const canManage = await sessionCanManageEventControl();
      setAllowed(canManage);

      if (!canManage) {
        setError('Apenas perfis com o papel Orquestrador de Evento podem manter avisos.');
      }
    } catch (loadError) {
      setAllowed(false);
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Não foi possível carregar a manutenção de avisos.'
      );
    } finally {
      setLoading(false);
    }
  }, [isActive]);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  return (
    <ScrollView
      style={[styles.scroll, minimal && styles.scrollMinimal]}
      contentContainerStyle={[
        styles.content,
        compact && styles.contentCompact,
        minimal && styles.contentMinimal,
        contentContainerStyle,
      ]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="always"
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
            Manutenção de Avisos
          </Text>
          <Text style={[styles.subtitle, minimal && styles.subtitleMinimal]}>
            Cadastre e publique comunicados que aparecem na home dos membros.
          </Text>
        </>
      ) : null}

      {loading ? (
        <ActivityIndicator color={minimal ? MINIMAL_UI.accent : colors.accent} size="large" />
      ) : null}
      {error ? <Text style={[styles.errorText, minimal && styles.errorTextMinimal]}>{error}</Text> : null}

      {!loading && allowed ? (
        <View style={styles.managerWrap}>
          <EventAvisosManager isActive={isActive} minimal={minimal} defaultExpanded />
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    alignSelf: 'stretch',
    overflow: 'hidden',
  },
  scrollMinimal: {
    flex: 1,
  },
  content: {
    gap: 14,
    paddingBottom: 8,
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
  },
  contentCompact: {
    gap: 10,
  },
  contentMinimal: {
    alignSelf: 'stretch',
  },
  title: {
    color: '#3A96DD',
    fontSize: 22,
    fontWeight: '800',
  },
  titleCompact: {
    fontSize: 18,
  },
  titleMinimal: {
    color: MINIMAL_UI.text,
  },
  subtitle: {
    color: 'rgba(58, 150, 221, 0.82)',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 4,
  },
  subtitleMinimal: {
    color: MINIMAL_UI.textMuted,
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 13,
    lineHeight: 18,
  },
  errorTextMinimal: {
    color: '#DC2626',
  },
  managerWrap: {
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    alignSelf: 'stretch',
    overflow: 'hidden',
  },
});

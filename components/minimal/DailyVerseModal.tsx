import { fetchDailyVerse, type DailyVerseDetails } from '@/lib/dailyVerse';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function DailyVerseModal({ visible, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verse, setVerse] = useState<DailyVerseDetails | null>(null);

  useEffect(() => {
    if (!visible) {
      return undefined;
    }

    let active = true;

    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const details = await fetchDailyVerse();

        if (!active) {
          return;
        }

        setVerse(details);
      } catch (loadError) {
        if (!active) {
          return;
        }

        const message =
          loadError instanceof Error
            ? loadError.message
            : 'Não foi possível carregar o versículo do dia.';
        setVerse(null);
        setError(message);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => undefined}>
          <Text style={styles.title}>Versículo do dia</Text>

          {loading ? (
            <View style={styles.loadingState}>
              <ActivityIndicator color={MINIMAL_UI.icon} size="small" />
              <Text style={styles.loadingText}>Carregando versículo…</Text>
            </View>
          ) : error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : verse ? (
            <View style={styles.verseBody}>
              <Text style={styles.verseText}>{verse.text}</Text>
              <Text style={styles.verseReference}>
                {verse.reference}
                {verse.version ? ` (${verse.version})` : ''}
              </Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Fechar versículo do dia"
          >
            <Text style={styles.closeButtonText}>Fechar</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    backgroundColor: MINIMAL_UI.background,
    paddingHorizontal: 20,
    paddingVertical: 18,
    gap: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: MINIMAL_UI.border,
  },
  title: {
    color: MINIMAL_UI.text,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  loadingState: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 12,
  },
  loadingText: {
    color: MINIMAL_UI.textMuted,
    fontSize: 14,
    textAlign: 'center',
  },
  errorText: {
    color: MINIMAL_UI.text,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    paddingVertical: 8,
  },
  verseBody: {
    gap: 10,
    paddingVertical: 4,
  },
  verseText: {
    color: MINIMAL_UI.text,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  verseReference: {
    color: MINIMAL_UI.textMuted,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  closeButton: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: MINIMAL_UI.rowHover,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: MINIMAL_UI.border,
  },
  closeButtonText: {
    color: MINIMAL_UI.text,
    fontSize: 14,
    fontWeight: '700',
  },
});

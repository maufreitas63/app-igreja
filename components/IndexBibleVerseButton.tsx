import { OpenBibleIcon } from '@/components/OpenBibleIcon';
import {
  fetchRandomBibleVerseByTheme,
  formatBibleVerseReference,
  type BibleVerseByTheme,
} from '@/lib/bibleVerseByTheme';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

type IndexBibleVerseButtonProps = {
  panelWidth: number;
};

export function IndexBibleVerseButton({ panelWidth }: IndexBibleVerseButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [verse, setVerse] = useState<BibleVerseByTheme | null>(null);

  const loadRandomVerse = useCallback(async () => {
    setIsOpen(true);
    setIsLoading(true);
    try {
      const nextVerse = await fetchRandomBibleVerseByTheme();
      if (!nextVerse) {
        Alert.alert(
          'Versículo indisponível',
          'Os versículos por tema ainda não foram carregados no Supabase. Execute os scripts bible-verses-by-theme.sql e bible-verses-by-theme-data.sql.'
        );
        setIsOpen(false);
        setVerse(null);
        return;
      }
      setVerse(nextVerse);
    } catch (error) {
      console.error('Erro ao carregar versículo bíblico:', error);
      Alert.alert('Versículo indisponível', 'Não foi possível carregar um versículo agora. Tente novamente.');
      setIsOpen(false);
      setVerse(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handlePress = () => {
    void loadRandomVerse();
  };

  const handleDismiss = () => {
    setIsOpen(false);
  };

  return (
    <>
      {isOpen ? (
        <Pressable
          style={styles.backdrop}
          onPress={handleDismiss}
          accessibilityLabel="Fechar versículo"
          accessibilityRole="button"
        />
      ) : null}

      {isOpen ? (
        <View
          pointerEvents="box-none"
          style={[styles.bubbleAnchor, { width: panelWidth }]}
        >
          <View style={[styles.bubble, { width: panelWidth }]}>
            {isLoading || !verse ? (
              <View style={styles.bubbleLoading}>
                <ActivityIndicator color="#A5B4FC" />
              </View>
            ) : (
              <>
                <Text style={styles.themeText}>{verse.theme_name}</Text>
                <Text style={styles.verseText}>{verse.texto}</Text>
                <Text style={styles.referenceText}>
                  {formatBibleVerseReference(verse)}
                </Text>
              </>
            )}
            <View style={styles.bubbleTail} />
          </View>
        </View>
      ) : null}

      <TouchableOpacity
        style={[styles.button, isOpen && styles.buttonActive]}
        onPress={handlePress}
        activeOpacity={0.9}
        disabled={isLoading}
        accessibilityRole="button"
        accessibilityLabel="Versículo bíblico por tema"
        accessibilityHint="Mostra um versículo aleatório em um balão"
        accessibilityState={{ disabled: isLoading, busy: isLoading }}
      >
        {isLoading ? (
          <ActivityIndicator color="#FDE68A" size="small" />
        ) : (
          <OpenBibleIcon size={28} />
        )}
      </TouchableOpacity>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    left: -600,
    right: -600,
    top: -2400,
    bottom: -24,
    zIndex: 3,
  },
  bubbleAnchor: {
    position: 'absolute',
    left: 0,
    bottom: 54,
    zIndex: 4,
    alignItems: 'flex-start',
  },
  bubble: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(165, 180, 252, 0.45)',
    backgroundColor: 'rgba(15, 23, 42, 0.96)',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  bubbleLoading: {
    minHeight: 88,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleTail: {
    position: 'absolute',
    left: 18,
    bottom: -8,
    width: 14,
    height: 14,
    backgroundColor: 'rgba(15, 23, 42, 0.96)',
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(165, 180, 252, 0.45)',
    transform: [{ rotate: '45deg' }],
  },
  themeText: {
    color: '#FDE68A',
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 26,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  verseText: {
    color: '#E2E8F0',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
  },
  referenceText: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    textAlign: 'right',
  },
  button: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    backgroundColor: 'rgba(148, 163, 184, 0.12)',
    borderColor: '#475569',
    zIndex: 5,
  },
  buttonActive: {
    backgroundColor: 'rgba(253, 230, 138, 0.16)',
    borderColor: '#FDE68A',
  },
});

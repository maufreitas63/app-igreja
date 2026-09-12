import {
  fetchPlatformGlossaryPublic,
  type GlossaryTermPublic,
} from '@/lib/glossary/glossaryApi';
import {
  compileGlossaryMatcher,
  type GlossaryMatcher,
} from '@/lib/glossary/glossaryMatch';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

type GlossaryContextValue = {
  enabled: boolean;
  matcher: GlossaryMatcher | null;
  openTerm: (term: GlossaryTermPublic) => void;
  refresh: (options?: { forceRefresh?: boolean }) => Promise<void>;
};

const GlossaryContext = createContext<GlossaryContextValue>({
  enabled: false,
  matcher: null,
  openTerm: () => {},
  refresh: async () => {},
});

const GlossarySkipContext = createContext(false);

export function useGlossaryHighlight() {
  return useContext(GlossaryContext);
}

export function useGlossarySkip() {
  return useContext(GlossarySkipContext);
}

/** Desliga o grifo em um subárvore (tabela de manutenção do dicionário). */
export function GlossarySkip({ children }: { children: React.ReactNode }) {
  return (
    <GlossarySkipContext.Provider value={true}>{children}</GlossarySkipContext.Provider>
  );
}

export function GlossaryProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabled] = useState(false);
  const [terms, setTerms] = useState<GlossaryTermPublic[]>([]);
  const [active, setActive] = useState<GlossaryTermPublic | null>(null);
  const { height } = useWindowDimensions();
  const panelMaxHeight = Math.round(height * 0.88);

  const refresh = useCallback(async (options?: { forceRefresh?: boolean }) => {
    const snapshot = await fetchPlatformGlossaryPublic(options);
    setEnabled(snapshot.enabled === true && snapshot.terms.length > 0);
    setTerms(snapshot.enabled === true ? snapshot.terms : []);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const matcher = useMemo(
    () => (enabled ? compileGlossaryMatcher(terms) : null),
    [enabled, terms]
  );

  const openTerm = useCallback((term: GlossaryTermPublic) => {
    setActive(term);
  }, []);

  const close = useCallback(() => setActive(null), []);

  const value = useMemo<GlossaryContextValue>(
    () => ({
      enabled,
      matcher,
      openTerm,
      refresh,
    }),
    [enabled, matcher, openTerm, refresh]
  );

  return (
    <GlossaryContext.Provider value={value}>
      {children}
      <Modal animationType="fade" transparent visible={active != null} onRequestClose={close}>
        <View style={styles.overlay}>
          <Pressable
            style={styles.backdrop}
            onPress={close}
            accessibilityLabel="Fechar definição"
          />
          <View style={[styles.panel, { maxHeight: panelMaxHeight }]}>
            <View style={styles.header}>
              <Text style={styles.title}>{active?.term ?? ''}</Text>
              <Pressable
                onPress={close}
                accessibilityRole="button"
                accessibilityLabel="Fechar definição"
                hitSlop={8}
                style={styles.headerClose}
              >
                <Text style={styles.headerCloseX}>×</Text>
              </Pressable>
            </View>
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator
            >
              <Text style={styles.definition}>{active?.description ?? ''}</Text>
            </ScrollView>
            <Pressable
              onPress={close}
              accessibilityRole="button"
              accessibilityLabel="Fechar"
              style={styles.closeBtn}
            >
              <Text style={styles.closeBtnText}>Fechar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </GlossaryContext.Provider>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    ...(Platform.OS === 'web' ? { zIndex: 100000 } : null),
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  panel: {
    backgroundColor: MINIMAL_UI.background,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    padding: 20,
    gap: 14,
    zIndex: 2,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: MINIMAL_UI.text,
  },
  headerClose: {
    minWidth: 28,
    minHeight: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCloseX: {
    color: '#DC2626',
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 24,
  },
  scroll: {
    flexGrow: 0,
    maxHeight: 280,
  },
  scrollContent: {
    paddingBottom: 4,
  },
  definition: {
    color: MINIMAL_UI.text,
    fontSize: 15,
    lineHeight: 22,
  },
  closeBtn: {
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: MINIMAL_UI.text,
    fontSize: 15,
    fontWeight: '700',
  },
});

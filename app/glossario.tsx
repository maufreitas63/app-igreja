import { CloseFooterBar } from '@/components/minimal/CloseFooterBar';
import { MinimalScreenLayout } from '@/components/minimal/MinimalScreenLayout';
import { ScreenAccessGate } from '@/components/ScreenAccessGate';
import { KnowledgeSectionTitle } from '@/components/knowledge/KnowledgeSectionTitle';
import { AppSwitch } from '@/components/ui/AppSwitch';
import { GlossarySkip, useGlossaryHighlight } from '@/context/GlossaryContext';
import { useGlossaryAdminAccess } from '@/hooks/useGlossaryAdminAccess';
import { useReturnToCallerOnLeave } from '@/hooks/useReturnToCallerOnLeave';
import {
  resolveReturnDashboardCardParam,
  resolveReturnRouteParam,
} from '@/lib/dashboardReturnNavigation';
import {
  fetchPlatformGlossaryAdmin,
  setPlatformGlossaryEnabled,
  setPlatformGlossaryTermActive,
  type GlossaryTermAdmin,
} from '@/lib/glossary/glossaryApi';
import { KNOWLEDGE_ROUTE } from '@/lib/knowledge/routeKeys';
import { MINIMAL_SECTION_TITLE, MINIMAL_UI } from '@/lib/minimalUiTheme';
import { FontAwesome } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';

// Proteção aplicada: Gestor não tem visibilidade do Super Administrador

function GlossaryAdminPanel() {
  const { refresh } = useGlossaryHighlight();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [terms, setTerms] = useState<GlossaryTermAdmin[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const snapshot = await fetchPlatformGlossaryAdmin();
      setEnabled(snapshot.enabled);
      setTerms(snapshot.terms);
    } catch (error) {
      console.error(error);
      Toast.show({
        type: 'error',
        text1: 'Dicionário',
        text2: error instanceof Error ? error.message : 'Não foi possível listar os termos.',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const handleToggleDisplay = async (next: boolean) => {
    const previous = enabled;
    setEnabled(next);
    setBusy(true);
    try {
      const saved = await setPlatformGlossaryEnabled(next);
      setEnabled(saved);
      await refresh({ forceRefresh: true });
      Toast.show({
        type: 'success',
        text1: 'Exibição dos termos',
        text2: saved ? 'Termos visíveis no aplicativo.' : 'Identificação desligada em todo o app.',
      });
    } catch (error) {
      setEnabled(previous);
      Toast.show({
        type: 'error',
        text1: 'Exibição dos termos',
        text2: error instanceof Error ? error.message : 'Não foi possível atualizar.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleToggleTerm = async (row: GlossaryTermAdmin) => {
    const next = !row.is_active;
    setTerms((current) =>
      current.map((item) => (item.id === row.id ? { ...item, is_active: next } : item))
    );
    setBusy(true);
    try {
      await setPlatformGlossaryTermActive(row.id, next);
      await refresh({ forceRefresh: true });
    } catch (error) {
      setTerms((current) =>
        current.map((item) => (item.id === row.id ? { ...item, is_active: row.is_active } : item))
      );
      Toast.show({
        type: 'error',
        text1: row.term,
        text2: error instanceof Error ? error.message : 'Não foi possível atualizar o termo.',
      });
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={MINIMAL_UI.blueDark} size="large" />
      </View>
    );
  }

  return (
    <GlossarySkip>
      <View style={styles.root}>
        <KnowledgeSectionTitle
          title="Dicionário de termos"
          routeKey={KNOWLEDGE_ROUTE.glossario}
          titleStyle={styles.title}
        />
        <Text style={styles.hint}>
          Plataforma: a mesma lista em todas as igrejas. Só o Super Administrador vê esta tela.
          Desmarque um termo para tirar o grifo no aplicativo; marque de novo para devolver.
        </Text>

        <View style={styles.masterRow}>
          <View style={styles.masterText}>
            <Text style={styles.masterLabel}>Exibir termos no aplicativo</Text>
            <Text style={styles.masterHint}>
              Primeiro controle: desliga a identificação em todas as telas, sem apagar o
              dicionário.
            </Text>
          </View>
          <AppSwitch
            value={enabled}
            onValueChange={(value) => void handleToggleDisplay(value)}
            disabled={busy}
            accessibilityLabel="Exibir termos no aplicativo"
          />
        </View>

        <View style={styles.headerRow}>
          <Text style={[styles.headerCell, styles.colCheck]}>Ativo</Text>
          <Text style={[styles.headerCell, styles.colTerm]}>Termo</Text>
          <Text style={[styles.headerCell, styles.colDesc]}>Descrição</Text>
        </View>

        {terms.map((row) => (
          <View key={row.id} style={styles.termRow}>
            <Pressable
              style={styles.colCheck}
              onPress={() => void handleToggleTerm(row)}
              disabled={busy}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: row.is_active, disabled: busy }}
              accessibilityLabel={
                row.is_active ? `Desativar ${row.term}` : `Ativar ${row.term}`
              }
              hitSlop={8}
            >
              <FontAwesome
                name={row.is_active ? 'check-square' : 'square-o'}
                size={20}
                color={row.is_active ? MINIMAL_UI.accent : MINIMAL_UI.textMuted}
              />
            </Pressable>
            <Text style={[styles.termName, styles.colTerm]}>{row.term}</Text>
            <Text style={[styles.termDesc, styles.colDesc]}>{row.description}</Text>
          </View>
        ))}
      </View>
    </GlossarySkip>
  );
}

export default function GlossarioScreen() {
  const accessStatus = useGlossaryAdminAccess();
  const params = useLocalSearchParams();
  const returnToCaller = useReturnToCallerOnLeave({
    returnRoute: resolveReturnRouteParam(params),
    returnDashboardCard: resolveReturnDashboardCardParam(params),
  });

  return (
    <ScreenAccessGate status={accessStatus}>
      <MinimalScreenLayout footer={<CloseFooterBar onPress={returnToCaller} />}>
        <GlossaryAdminPanel />
      </MinimalScreenLayout>
    </ScreenAccessGate>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    paddingBottom: 24,
  },
  loader: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  title: {
    ...MINIMAL_SECTION_TITLE,
    width: '100%',
  },
  hint: {
    color: MINIMAL_UI.textMuted,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  masterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 16,
    marginBottom: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.rowHover,
  },
  masterText: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  masterLabel: {
    color: MINIMAL_UI.text,
    fontSize: 15,
    fontWeight: '700',
  },
  masterHint: {
    color: MINIMAL_UI.textMuted,
    fontSize: 12,
    lineHeight: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: MINIMAL_UI.divider,
  },
  headerCell: {
    color: MINIMAL_UI.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  termRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: MINIMAL_UI.divider,
  },
  colCheck: {
    width: 36,
    paddingTop: 2,
    alignItems: 'center',
  },
  colTerm: {
    width: 128,
    flexShrink: 0,
  },
  colDesc: {
    flex: 1,
    minWidth: 0,
  },
  termName: {
    color: MINIMAL_UI.text,
    fontSize: 13,
    fontWeight: '700',
    paddingTop: 2,
  },
  termDesc: {
    color: MINIMAL_UI.text,
    fontSize: 13,
    lineHeight: 18,
  },
});

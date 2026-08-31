import { LivrosDoadosPanel } from '@/components/LivrosDoadosPanel';
import { LivrosEmprestimosPanel } from '@/components/LivrosEmprestimosPanel';
import { CloseFooterBar } from '@/components/minimal/CloseFooterBar';
import { MinimalScreenLayout } from '@/components/minimal/MinimalScreenLayout';
import { ScreenAccessGate } from '@/components/ScreenAccessGate';
import { useReturnToCallerOnLeave } from '@/hooks/useReturnToCallerOnLeave';
import { useScreenAccessGuard } from '@/hooks/useScreenAccessGuard';
import { ACCESS_SCREEN } from '@/lib/accessControl';
import {
  resolveReturnDashboardCardParam,
  resolveReturnRouteParam,
} from '@/lib/dashboardReturnNavigation';
import { MINIMAL_SECTION_TITLE, MINIMAL_UI } from '@/lib/minimalUiTheme';
import { useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type LivrosTab = 'acervo' | 'emprestimos' | 'historico';

const TABS: { id: LivrosTab; label: string }[] = [
  { id: 'acervo', label: 'Acervo' },
  { id: 'emprestimos', label: 'Empréstimos' },
  { id: 'historico', label: 'Histórico' },
];

export default function LivrosDoadosScreen() {
  const params = useLocalSearchParams();
  const returnToCaller = useReturnToCallerOnLeave({
    returnRoute: resolveReturnRouteParam(params),
    returnDashboardCard: resolveReturnDashboardCardParam(params),
  });
  const accessStatus = useScreenAccessGuard({
    resourceKey: ACCESS_SCREEN.livrosDoados,
    deniedMessage: 'Você não tem permissão para gerenciar o acervo e os empréstimos.',
  });
  const [tab, setTab] = useState<LivrosTab>('acervo');

  return (
    <ScreenAccessGate status={accessStatus}>
      <MinimalScreenLayout footer={<CloseFooterBar onPress={returnToCaller} />}>
        <Text style={styles.title}>Livros doados</Text>
        <View style={styles.tabs}>
          {TABS.map((item) => {
            const selected = tab === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.tab, selected && styles.tabSelected]}
                onPress={() => setTab(item.id)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
              >
                <Text style={[styles.tabLabel, selected && styles.tabLabelSelected]}>{item.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {tab === 'acervo' ? <LivrosDoadosPanel /> : null}
        {tab === 'emprestimos' ? <LivrosEmprestimosPanel mode="ativos" /> : null}
        {tab === 'historico' ? <LivrosEmprestimosPanel mode="historico" /> : null}
      </MinimalScreenLayout>
    </ScreenAccessGate>
  );
}

const styles = StyleSheet.create({
  title: {
    ...MINIMAL_SECTION_TITLE,
    marginBottom: 12,
  },
  tabs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  tab: {
    flex: 1,
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
  },
  tabSelected: {
    backgroundColor: MINIMAL_UI.blueDark,
    borderColor: MINIMAL_UI.blueDark,
  },
  tabLabel: {
    color: MINIMAL_UI.text,
    fontWeight: '700',
    fontSize: 13,
  },
  tabLabelSelected: {
    color: MINIMAL_UI.onDark,
  },
});

import { AliancaIndicadosList } from '@/components/alianca/AliancaIndicadosList';
import { KnowledgeSectionTitle } from '@/components/knowledge/KnowledgeSectionTitle';
import { CloseFooterBar } from '@/components/minimal/CloseFooterBar';
import { MinimalScreenLayout } from '@/components/minimal/MinimalScreenLayout';
import { ScreenAccessGate } from '@/components/ScreenAccessGate';
import { useIgrejasAdminAccess } from '@/hooks/useIgrejasAdminAccess';
import { useReturnToCallerOnLeave } from '@/hooks/useReturnToCallerOnLeave';
import {
  resolveReturnDashboardCardParam,
  resolveReturnRouteParam,
} from '@/lib/dashboardReturnNavigation';
import { MEMBER_HOME_PATH } from '@/lib/failClosedNavigation';
import { KNOWLEDGE_ROUTE } from '@/lib/knowledge/routeKeys';
import { MINIMAL_SECTION_TITLE, MINIMAL_UI } from '@/lib/minimalUiTheme';
import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function AliancaIndicadosScreen() {
  const accessStatus = useIgrejasAdminAccess(
    MEMBER_HOME_PATH,
    'Apenas o Super Administrador acessa o funil de Indicados.'
  );
  const params = useLocalSearchParams();
  const returnToCaller = useReturnToCallerOnLeave({
    returnRoute: resolveReturnRouteParam(params),
    returnDashboardCard: resolveReturnDashboardCardParam(params),
  });

  return (
    <ScreenAccessGate status={accessStatus}>
      <MinimalScreenLayout
        scroll={false}
        footer={<CloseFooterBar onPress={returnToCaller} />}
        contentContainerStyle={styles.layoutContent}
      >
        <View style={styles.root}>
          <KnowledgeSectionTitle
            title="Indicados"
            routeKey={KNOWLEDGE_ROUTE.aliancaIndicados}
            titleStyle={styles.title}
            accessibilityLabel="Como usar o funil Kanban de indicados da Aliança"
          />
          <Text style={styles.hint}>
            Funil exclusivo do Super Administrador. Avance uma coluna por vez; a atividade (1.1 a
            6.3) fica no card. 5.4 encerra a tratativa sem ir ao fechamento.
          </Text>
          <AliancaIndicadosList />
        </View>
      </MinimalScreenLayout>
    </ScreenAccessGate>
  );
}

const styles = StyleSheet.create({
  layoutContent: {
    flexGrow: 1,
  },
  root: {
    width: '100%',
    flex: 1,
    minHeight: 0,
    paddingBottom: 8,
    gap: 8,
  },
  title: {
    ...MINIMAL_SECTION_TITLE,
    width: '100%',
  },
  hint: {
    color: MINIMAL_UI.textMuted,
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 16,
    marginBottom: 4,
    lineHeight: 18,
  },
});

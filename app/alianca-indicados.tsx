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
import { KNOWLEDGE_ROUTE } from '@/lib/knowledge/routeKeys';
import { MINIMAL_SECTION_TITLE, MINIMAL_UI } from '@/lib/minimalUiTheme';
import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function AliancaIndicadosScreen() {
  const accessStatus = useIgrejasAdminAccess();
  const params = useLocalSearchParams();
  const returnToCaller = useReturnToCallerOnLeave({
    returnRoute: resolveReturnRouteParam(params),
    returnDashboardCard: resolveReturnDashboardCardParam(params),
  });

  return (
    <ScreenAccessGate status={accessStatus}>
      <MinimalScreenLayout footer={<CloseFooterBar onPress={returnToCaller} />}>
        <View style={styles.root}>
          <KnowledgeSectionTitle
            title="Indicados"
            routeKey={KNOWLEDGE_ROUTE.aliancaIndicados}
            titleStyle={styles.title}
            accessibilityLabel="Como usar a lista de indicados da Aliança"
          />
          <Text style={styles.hint}>
            Cada indicação traz nome, posição, celular, quem indicou e a instância. Avance o funil
            comercial na ordem que fizer sentido para aquele contato.
          </Text>
          <AliancaIndicadosList />
        </View>
      </MinimalScreenLayout>
    </ScreenAccessGate>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    paddingBottom: 24,
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
    marginBottom: 8,
    lineHeight: 18,
  },
});

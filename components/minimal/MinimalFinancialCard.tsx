import { DASHBOARD_CARD_SHELL, DASHBOARD_CARD_TYPO } from '@/lib/dashboardCardStyles';
import { VIGILANCE_SCALES_UI } from '@/lib/dashboardCardThemes';
import { ACCESS_SCREEN } from '@/lib/accessControl';
import { withReturnDashboardCard } from '@/lib/dashboardReturnNavigation';
import { DASHBOARD_FINANCIAL_CARD_ID } from '@/lib/financialModule';
import { navigateWithScreenAccess } from '@/lib/dashboardScreenNavigation';
import { MINIMAL_TYPO, MINIMAL_UI } from '@/lib/minimalUiTheme';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

/** Card financeiro do dashboard, adaptado à tela principal minimalista. */
export function MinimalFinancialCard() {
  const router = useRouter();

  return (
    <View style={styles.wrap}>
      <Text style={styles.sectionTitle}>Resultados Financeiros</Text>

      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.85}
        onPress={() => {
          void navigateWithScreenAccess(
            router,
            '/financial',
            ACCESS_SCREEN.financial,
            withReturnDashboardCard(DASHBOARD_FINANCIAL_CARD_ID),
            { method: 'push' }
          );
        }}
      >
        <Text style={styles.cardTitle}>Financeiro</Text>
        <View style={styles.body}>
          <Text style={styles.subtitle}>
            Gestão financeira da igreja, tudo em um só lugar.
          </Text>
          <View style={styles.ctaRow}>
            <MaterialIcons name="touch-app" size={32} color={VIGILANCE_SCALES_UI.accent} />
            <Text style={styles.cta}>Toque para abrir o módulo financeiro.</Text>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 0,
    backgroundColor: MINIMAL_UI.background,
  },
  sectionTitle: {
    fontSize: Math.round(MINIMAL_TYPO.screenTitle.fontSize * 1.3),
    fontWeight: MINIMAL_TYPO.screenTitle.fontWeight,
    color: MINIMAL_UI.blueDark,
    backgroundColor: MINIMAL_UI.background,
    textAlign: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  card: {
    marginHorizontal: 4,
    marginTop: 8,
    ...DASHBOARD_CARD_SHELL,
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 12,
    alignItems: 'stretch',
  },
  cardTitle: {
    ...DASHBOARD_CARD_TYPO.panelTitle,
    marginBottom: 4,
  },
  body: {
    gap: 16,
    paddingTop: 8,
  },
  subtitle: {
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 8,
  },
  cta: {
    flexShrink: 1,
    color: VIGILANCE_SCALES_UI.accent,
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
});

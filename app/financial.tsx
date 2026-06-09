import { FinancialMonthlyBulletin } from '@/components/FinancialMonthlyBulletin';
import { FinancialMonthlyBudgetComparison } from '@/components/FinancialMonthlyBudgetComparison';
import { FinancialLastTwelveMonths } from '@/components/FinancialLastTwelveMonths';
import { FinancialMonthlyComparison } from '@/components/FinancialMonthlyComparison';
import { ACCESS_SCREEN } from '@/lib/accessControl';
import { DASHBOARD_FINANCIAL_CARD_ID, FINANCIAL_HUB_ITEMS } from '@/lib/financialModule';
import { useScreenAccessGuard } from '@/hooks/useScreenAccessGuard';
import { formatFinancialMonthKey, formatFinancialMonthLabel } from '@/lib/financialMonth';
import { useFinancialsByMonth } from '@/hooks/useFinancialsByMonth';
import { FontAwesome } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

type FinancialSectionId = 'result' | 'comparison' | 'twelveMonths' | 'budget';

const FINANCIAL_SECTION_ORDER: FinancialSectionId[] = [
  'result',
  'comparison',
  'twelveMonths',
  'budget',
];

export default function FinancialScreen() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);

  useScreenAccessGuard({
    resourceKey: ACCESS_SCREEN.financial,
    deniedMessage: 'Você não tem permissão para abrir o módulo financeiro.',
  });
  const [expandedSection, setExpandedSection] = useState<FinancialSectionId | null>(null);

  const {
    loadingMonths,
    loadingEntries,
    errorMessage,
    commentsWarning,
    monthOptions,
    plannedOnlyMonthKeys,
    selectedMonth,
    setSelectedMonth,
    entries,
    previousBalance,
    currentBalance,
    comparisonPreviousMonth,
    comparisonPreviousMonthEntries,
    comparisonPreviousMonthOpeningBalance,
    comparisonPreviousMonthClosingBalance,
    budgetPlannedMonthEntries,
    budgetPlannedOpeningBalance,
    budgetPlannedClosingBalance,
    realizedEntriesThroughSelectedMonth,
    yearToDateRealizedBalance,
    reload,
  } = useFinancialsByMonth();

  const pickerValue = selectedMonth ? formatFinancialMonthKey(selectedMonth) : '';
  const selectedMonthIsPlannedOnly =
    Boolean(pickerValue) && plannedOnlyMonthKeys.has(pickerValue);

  const handleBackToDashboard = useCallback(() => {
    router.replace({
      pathname: '/(tabs)/dashboard',
      params: { dashboardCard: DASHBOARD_FINANCIAL_CARD_ID },
    });
  }, [router]);

  const budgetSectionBlocked = useMemo(
    () => !loadingEntries && Boolean(selectedMonth) && budgetPlannedMonthEntries.length === 0,
    [budgetPlannedMonthEntries.length, loadingEntries, selectedMonth]
  );

  const toggleSection = useCallback(
    (section: FinancialSectionId) => {
      if (section === 'budget' && budgetSectionBlocked) {
        return;
      }

      setExpandedSection((current) => (current === section ? null : section));
    },
    [budgetSectionBlocked]
  );

  const sectionsToRender = useMemo(
    () => (expandedSection ? [expandedSection] : FINANCIAL_SECTION_ORDER),
    [expandedSection]
  );

  useEffect(() => {
    if (budgetSectionBlocked && expandedSection === 'budget') {
      setExpandedSection(null);
    }
  }, [budgetSectionBlocked, expandedSection]);

  useEffect(() => {
    if (!expandedSection) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    });

    return () => cancelAnimationFrame(frame);
  }, [expandedSection, sectionsToRender]);

  const isLoading = loadingMonths || loadingEntries;

  const renderFinancialSection = (sectionId: FinancialSectionId) => {
    switch (sectionId) {
      case 'result':
        return (
          <View key="result" style={styles.resultSection}>
            <TouchableOpacity
              accessibilityLabel="Resultado do mês"
              accessibilityRole="button"
              accessibilityState={{ expanded: expandedSection === 'result' }}
              activeOpacity={0.85}
              onPress={() => toggleSection('result')}
              style={styles.resultSectionHeader}
            >
              <View style={styles.resultSectionHeaderText}>
                <Text style={styles.sectionLabel}>Resultado do mês</Text>
                {selectedMonth ? (
                  <Text style={styles.resultSectionMeta}>
                    {formatFinancialMonthLabel(selectedMonth)}
                  </Text>
                ) : null}
              </View>
              <FontAwesome
                name={expandedSection === 'result' ? 'chevron-up' : 'chevron-down'}
                size={14}
                color="#94A3B8"
              />
            </TouchableOpacity>

            {expandedSection === 'result' ? (
              <View style={styles.resultSectionBody}>
                {errorMessage ? (
                  <View style={styles.messageBox}>
                    <Text style={styles.errorText}>{errorMessage}</Text>
                    <TouchableOpacity
                      style={styles.retryButton}
                      onPress={() => void reload()}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.retryButtonText}>Atualizar</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}

                {!errorMessage && commentsWarning ? (
                  <View style={styles.warningBox}>
                    <Text style={styles.warningText}>{commentsWarning}</Text>
                  </View>
                ) : null}

                {isLoading ? (
                  <ActivityIndicator color="#10b981" style={styles.bulletinLoader} />
                ) : null}

                {!isLoading && !selectedMonth ? (
                  <Text style={styles.sectionHintText}>Selecione um mês acima para exibir o relatório.</Text>
                ) : null}

                {!isLoading && selectedMonth ? (
                  <FinancialMonthlyBulletin
                    entries={entries}
                    month={selectedMonth}
                    previousBalance={previousBalance}
                    currentBalance={currentBalance}
                    yearToDateRealizedBalance={yearToDateRealizedBalance}
                  />
                ) : null}
              </View>
            ) : null}
          </View>
        );

      case 'comparison':
        return (
          <View key="comparison" style={styles.comparisonSection}>
            <TouchableOpacity
              accessibilityLabel="Comparativo mensal"
              accessibilityRole="button"
              accessibilityState={{ expanded: expandedSection === 'comparison' }}
              activeOpacity={0.85}
              onPress={() => toggleSection('comparison')}
              style={styles.resultSectionHeader}
            >
              <View style={styles.resultSectionHeaderText}>
                <Text style={styles.sectionLabel}>Comparativo mensal</Text>
                {selectedMonth && comparisonPreviousMonth ? (
                  <Text style={styles.resultSectionMeta}>
                    {formatFinancialMonthLabel(comparisonPreviousMonth)} ×{' '}
                    {formatFinancialMonthLabel(selectedMonth)}
                  </Text>
                ) : null}
              </View>
              <FontAwesome
                name={expandedSection === 'comparison' ? 'chevron-up' : 'chevron-down'}
                size={14}
                color="#94A3B8"
              />
            </TouchableOpacity>

            {expandedSection === 'comparison' ? (
              <View style={styles.resultSectionBody}>
                {isLoading ? (
                  <ActivityIndicator color="#10b981" style={styles.bulletinLoader} />
                ) : null}

                {!isLoading && selectedMonth && comparisonPreviousMonth ? (
                  <FinancialMonthlyComparison
                    currentMonth={selectedMonth}
                    currentMonthEntries={entries}
                    currentMonthPreviousBalance={previousBalance}
                    currentMonthCurrentBalance={currentBalance}
                    previousMonth={comparisonPreviousMonth}
                    previousMonthEntries={comparisonPreviousMonthEntries}
                    previousMonthPreviousBalance={comparisonPreviousMonthOpeningBalance}
                    previousMonthCurrentBalance={comparisonPreviousMonthClosingBalance}
                  />
                ) : null}
              </View>
            ) : null}
          </View>
        );

      case 'twelveMonths':
        return (
          <View key="twelveMonths" style={styles.twelveMonthsSection}>
            <TouchableOpacity
              accessibilityLabel="Últimos 12 meses"
              accessibilityRole="button"
              accessibilityState={{ expanded: expandedSection === 'twelveMonths' }}
              activeOpacity={0.85}
              onPress={() => toggleSection('twelveMonths')}
              style={styles.resultSectionHeader}
            >
              <View style={styles.resultSectionHeaderText}>
                <Text style={styles.sectionLabel}>Últimos 12 meses</Text>
                {selectedMonth ? (
                  <Text style={styles.twelveMonthsSectionMeta}>
                    Realizado · até {formatFinancialMonthLabel(selectedMonth)}
                  </Text>
                ) : null}
              </View>
              <FontAwesome
                name={expandedSection === 'twelveMonths' ? 'chevron-up' : 'chevron-down'}
                size={14}
                color="#94A3B8"
              />
            </TouchableOpacity>

            {expandedSection === 'twelveMonths' ? (
              <View style={styles.resultSectionBody}>
                {isLoading ? (
                  <ActivityIndicator color="#10b981" style={styles.bulletinLoader} />
                ) : null}

                {!isLoading && selectedMonth ? (
                  <FinancialLastTwelveMonths
                    endMonth={selectedMonth}
                    realizedEntries={realizedEntriesThroughSelectedMonth}
                  />
                ) : null}
              </View>
            ) : null}
          </View>
        );

      case 'budget':
        return (
          <View
            key="budget"
            style={[styles.budgetSection, budgetSectionBlocked && styles.budgetSectionBlocked]}
          >
            <TouchableOpacity
              accessibilityLabel="Planejado e realizado"
              accessibilityRole="button"
              accessibilityState={{
                expanded: expandedSection === 'budget',
                disabled: budgetSectionBlocked,
              }}
              activeOpacity={budgetSectionBlocked ? 1 : 0.85}
              disabled={budgetSectionBlocked}
              onPress={() => toggleSection('budget')}
              style={styles.resultSectionHeader}
            >
              <View style={styles.resultSectionHeaderText}>
                <Text
                  style={[styles.sectionLabel, budgetSectionBlocked && styles.sectionLabelBlocked]}
                >
                  Planejado × Realizado
                </Text>
                {budgetSectionBlocked ? (
                  <Text style={styles.budgetSectionBlockedText}>
                    Sem orçamento planejado para este mês
                  </Text>
                ) : selectedMonth ? (
                  <Text style={styles.budgetSectionMeta}>
                    {formatFinancialMonthLabel(selectedMonth)}
                  </Text>
                ) : null}
              </View>
              <FontAwesome
                name={
                  budgetSectionBlocked
                    ? 'lock'
                    : expandedSection === 'budget'
                      ? 'chevron-up'
                      : 'chevron-down'
                }
                size={14}
                color={budgetSectionBlocked ? '#64748B' : '#94A3B8'}
              />
            </TouchableOpacity>

            {expandedSection === 'budget' && !budgetSectionBlocked ? (
              <View style={styles.resultSectionBody}>
                {isLoading ? (
                  <ActivityIndicator color="#10b981" style={styles.bulletinLoader} />
                ) : null}

                {!isLoading && selectedMonth ? (
                  <FinancialMonthlyBudgetComparison
                    month={selectedMonth}
                    plannedMonthEntries={budgetPlannedMonthEntries}
                    plannedOpeningBalance={budgetPlannedOpeningBalance}
                    plannedClosingBalance={budgetPlannedClosingBalance}
                    realizedMonthEntries={entries}
                    realizedOpeningBalance={previousBalance}
                    realizedClosingBalance={currentBalance}
                  />
                ) : null}
              </View>
            ) : null}
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <LinearGradient colors={['#0f172a', '#020617']} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.headerBar}>
          <TouchableOpacity
            accessibilityLabel="Voltar ao painel"
            accessibilityRole="button"
            activeOpacity={0.85}
            onPress={handleBackToDashboard}
            style={styles.headerBackButton}
          >
            <Text style={styles.headerBackText}>{'‹'}</Text>
          </TouchableOpacity>
          <View style={styles.headerTitles}>
            <Text style={styles.title}>Financeiro</Text>
            <Text style={styles.subtitle}>Gestão financeira da igreja</Text>
          </View>
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.rdShortcutSection}>
            {FINANCIAL_HUB_ITEMS.filter((item) => item.action.type === 'route').map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.rdShortcutButton}
                onPress={() => {
                  if (item.action.type === 'route') {
                    router.push('/expense-report');
                  }
                }}
                activeOpacity={0.85}
              >
                <FontAwesome name={item.icon} size={14} color="#D1FAE5" />
                <View style={styles.rdShortcutTextWrap}>
                  <Text style={styles.rdShortcutTitle}>{item.title}</Text>
                  <Text style={styles.rdShortcutSubtitle}>{item.subtitle}</Text>
                </View>
                <FontAwesome name="chevron-right" size={12} color="#94A3B8" />
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.monthFilterSection}>
            <Text style={styles.monthFilterLabel}>Selecionar mês</Text>
            <View style={styles.pickerWrapper}>
              {loadingMonths ? (
                <ActivityIndicator color="#10b981" style={styles.pickerLoader} />
              ) : monthOptions.length ? (
                <Picker
                  selectedValue={pickerValue}
                  onValueChange={(value) => {
                    const match = monthOptions.find(
                      (month) => formatFinancialMonthKey(month) === String(value)
                    );

                    if (match) {
                      setSelectedMonth(match);
                    }
                  }}
                  dropdownIconColor="#F8FAFC"
                  style={styles.picker}
                  itemStyle={styles.pickerItem}
                  mode="dropdown"
                >
                  {monthOptions.map((month) => {
                    const value = formatFinancialMonthKey(month);
                    const plannedOnly = plannedOnlyMonthKeys.has(value);
                    return (
                      <Picker.Item
                        key={value}
                        label={
                          plannedOnly
                            ? `${formatFinancialMonthLabel(month)} (só planejado)`
                            : formatFinancialMonthLabel(month)
                        }
                        value={value}
                      />
                    );
                  })}
                </Picker>
              ) : (
                <Text style={styles.pickerEmptyText}>Nenhum mês disponível.</Text>
              )}
            </View>
            {selectedMonthIsPlannedOnly ? (
              <Text style={styles.plannedOnlyHint}>
                Este mês só tem lançamentos PLANEJADO. O resultado REALIZADO aparece vazio; use a
                seção Orçamento ou Manutenção para editar o planejado.
              </Text>
            ) : null}
          </View>

          {sectionsToRender.map((sectionId) => renderFinancialSection(sectionId))}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 10,
  },
  headerBackButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBackText: {
    color: '#E2E8F0',
    fontSize: 28,
    lineHeight: 30,
    marginTop: -2,
  },
  headerTitles: {
    flex: 1,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 22,
    fontWeight: '800',
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 2,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 10,
  },
  rdShortcutSection: {
    gap: 8,
  },
  rdShortcutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    borderRadius: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  rdShortcutTextWrap: {
    flex: 1,
    gap: 2,
  },
  rdShortcutTitle: {
    color: '#ECFDF5',
    fontSize: 14,
    fontWeight: '800',
  },
  rdShortcutSubtitle: {
    color: '#94A3B8',
    fontSize: 11,
  },
  sectionLabel: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  monthFilterSection: {
    gap: 8,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: 'rgba(30, 41, 59, 0.55)',
  },
  monthFilterLabel: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  resultSection: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    backgroundColor: 'rgba(6, 78, 59, 0.15)',
    overflow: 'hidden',
  },
  resultSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 14,
  },
  resultSectionHeaderText: {
    flex: 1,
    gap: 4,
  },
  resultSectionMeta: {
    color: '#6EE7B7',
    fontSize: 13,
    fontWeight: '600',
  },
  resultSectionBody: {
    gap: 10,
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  comparisonSection: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.35)',
    backgroundColor: 'rgba(30, 58, 138, 0.15)',
    overflow: 'hidden',
  },
  twelveMonthsSection: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(20, 184, 166, 0.35)',
    backgroundColor: 'rgba(19, 78, 74, 0.15)',
    overflow: 'hidden',
  },
  twelveMonthsSectionMeta: {
    color: '#5EEAD4',
    fontSize: 13,
    fontWeight: '600',
  },
  budgetSection: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.35)',
    backgroundColor: 'rgba(88, 28, 135, 0.15)',
    overflow: 'hidden',
  },
  budgetSectionBlocked: {
    borderColor: '#334155',
    backgroundColor: 'rgba(30, 41, 59, 0.45)',
    opacity: 0.85,
  },
  sectionLabelBlocked: {
    color: '#64748B',
  },
  budgetSectionMeta: {
    color: '#C4B5FD',
    fontSize: 13,
    fontWeight: '600',
  },
  budgetSectionBlockedText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
    fontStyle: 'italic',
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    overflow: 'hidden',
    minHeight: 48,
    justifyContent: 'center',
  },
  picker: {
    color: '#F8FAFC',
    height: 48,
  },
  pickerItem: {
    color: '#F8FAFC',
    fontSize: 15,
  },
  pickerLoader: {
    paddingVertical: 10,
  },
  plannedOnlyHint: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 18,
  },
  pickerEmptyText: {
    color: '#94A3B8',
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 12,
  },
  sectionHintText: {
    color: '#94A3B8',
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 16,
  },
  messageBox: {
    gap: 8,
  },
  warningBox: {
    backgroundColor: 'rgba(251, 191, 36, 0.12)',
    borderColor: 'rgba(251, 191, 36, 0.35)',
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  warningText: {
    color: '#FCD34D',
    fontSize: 14,
    textAlign: 'center',
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 14,
    textAlign: 'center',
  },
  retryButton: {
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: '#10b981',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  retryButtonText: {
    color: '#6EE7B7',
    fontWeight: '700',
  },
  bulletinLoader: {
    marginVertical: 24,
  },
});

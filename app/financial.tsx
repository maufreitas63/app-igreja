import { FinancialMonthlyBankBalance } from '@/components/FinancialMonthlyBankBalance';
import { FinancialMonthlyBulletin } from '@/components/FinancialMonthlyBulletin';
import { FinancialMonthlyBudgetComparison } from '@/components/FinancialMonthlyBudgetComparison';
import { FinancialLastTwelveMonths } from '@/components/FinancialLastTwelveMonths';
import { FinancialMonthlyComparison } from '@/components/FinancialMonthlyComparison';
import { ACCESS_SCREEN } from '@/lib/accessControl';
import {
  resolveReturnDashboardCardParam,
  withReturnDashboardCard,
  pickRouteParam,
  isMinimalPresentationRoute,
} from '@/lib/dashboardReturnNavigation';
import { DASHBOARD_FINANCIAL_CARD_ID, FINANCIAL_HUB_ITEMS } from '@/lib/financialModule';
import { MinimalScreenLayout } from '@/components/minimal/MinimalScreenLayout';
import { ScreenAccessGate } from '@/components/ScreenAccessGate';
import { useScreenAccessGuard } from '@/hooks/useScreenAccessGuard';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import { formatFinancialMonthKey, formatFinancialMonthLabel } from '@/lib/financialMonth';
import { useFinancialsByMonth } from '@/hooks/useFinancialsByMonth';
import { DropdownSelect } from '@/components/ui/DropdownSelect';
import { CarouselFooterNav } from '@/components/ui/CarouselFooterNav';
import { FontAwesome } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

type FinancialSectionId = 'result' | 'comparison' | 'twelveMonths' | 'budget' | 'bankBalance';

const FINANCIAL_SECTION_ORDER: FinancialSectionId[] = [
  'result',
  'comparison',
  'twelveMonths',
  'budget',
  'bankBalance',
];

export default function FinancialScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    returnDashboardCard?: string | string[];
    presentation?: string | string[];
  }>();
  const isMinimalPresentation = isMinimalPresentationRoute(params.presentation);
  const returnDashboardCard = resolveReturnDashboardCardParam(params) ?? DASHBOARD_FINANCIAL_CARD_ID;
  const scrollRef = useRef<ScrollView>(null);

  const accessStatus = useScreenAccessGuard({
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

  const monthDropdownOptions = useMemo(
    () =>
      monthOptions.map((month) => {
        const value = formatFinancialMonthKey(month);
        const plannedOnly = plannedOnlyMonthKeys.has(value);

        return {
          value,
          label: plannedOnly
            ? `${formatFinancialMonthLabel(month)} (só planejado)`
            : formatFinancialMonthLabel(month),
        };
      }),
    [monthOptions, plannedOnlyMonthKeys]
  );

  const handleMenu = useCallback(() => {
    router.replace('/(tabs)');
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
              style={[styles.resultSectionHeader, styles.resultMonthSectionHeader]}
            >
              <View style={styles.resultSectionHeaderText}>
                <Text style={[styles.sectionLabel, styles.resultSectionLabel]}>Resultado do mês</Text>
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
              style={[styles.resultSectionHeader, styles.comparisonMonthSectionHeader]}
            >
              <View style={styles.resultSectionHeaderText}>
                <Text style={[styles.sectionLabel, styles.resultSectionLabel]}>
                  Comparativo mensal
                </Text>
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
              style={[styles.resultSectionHeader, styles.twelveMonthsSectionHeader]}
            >
              <View style={styles.resultSectionHeaderText}>
                <Text style={[styles.sectionLabel, styles.resultSectionLabel]}>Últimos 12 meses</Text>
                {selectedMonth ? (
                  <Text style={styles.resultSectionMeta}>
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

      case 'bankBalance':
        return (
          <View key="bankBalance" style={styles.bankBalanceSection}>
            <TouchableOpacity
              accessibilityLabel="Saldo bancário"
              accessibilityRole="button"
              accessibilityState={{ expanded: expandedSection === 'bankBalance' }}
              activeOpacity={0.85}
              onPress={() => toggleSection('bankBalance')}
              style={[styles.resultSectionHeader, styles.bankBalanceSectionHeader]}
            >
              <View style={styles.resultSectionHeaderText}>
                <Text style={[styles.sectionLabel, styles.resultSectionLabel]}>Saldo bancário</Text>
                {selectedMonth ? (
                  <Text style={styles.resultSectionMeta}>
                    {formatFinancialMonthLabel(selectedMonth)}
                  </Text>
                ) : null}
              </View>
              <FontAwesome
                name={expandedSection === 'bankBalance' ? 'chevron-up' : 'chevron-down'}
                size={14}
                color="#94A3B8"
              />
            </TouchableOpacity>

            {expandedSection === 'bankBalance' ? (
              <View style={styles.resultSectionBody}>
                {isLoading ? (
                  <ActivityIndicator color="#10b981" style={styles.bulletinLoader} />
                ) : null}

                {!isLoading && selectedMonth ? (
                  <FinancialMonthlyBankBalance
                    month={selectedMonth}
                    realizedEntriesThroughMonth={realizedEntriesThroughSelectedMonth}
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
              style={[styles.resultSectionHeader, styles.budgetSectionHeader]}
            >
              <View style={styles.resultSectionHeaderText}>
                <Text
                  style={[
                    styles.sectionLabel,
                    styles.resultSectionLabel,
                    budgetSectionBlocked && styles.sectionLabelBlocked,
                  ]}
                >
                  Planejado × Realizado
                </Text>
                {budgetSectionBlocked ? (
                  <Text style={styles.budgetSectionBlockedText}>
                    Sem orçamento planejado para este mês
                  </Text>
                ) : selectedMonth ? (
                  <Text style={styles.resultSectionMeta}>
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

  const monthFilter = (
    <View style={isMinimalPresentation ? styles.minimalMonthRow : styles.monthFilterRow}>
      <Text style={isMinimalPresentation ? styles.minimalMonthLabel : styles.monthFilterLabel}>
        Mês de referência
      </Text>
      {loadingMonths ? (
        <ActivityIndicator color={MINIMAL_UI.icon} style={styles.monthFilterLoader} />
      ) : monthDropdownOptions.length ? (
        <View style={styles.monthDropdownWrap}>
          <DropdownSelect
            options={monthDropdownOptions}
            selectedValue={pickerValue}
            onValueChange={(value) => {
              const match = monthOptions.find((month) => formatFinancialMonthKey(month) === value);

              if (match) {
                setSelectedMonth(match);
              }
            }}
            modalTitle="Selecionar mês"
            placeholder="Selecionar mês"
            style={[
              styles.monthDropdown,
              isMinimalPresentation && styles.minimalMonthDropdown,
            ]}
            triggerTextStyle={styles.financialMonthDropdownText}
            triggerIconColor="#54A2DD"
          />
        </View>
      ) : (
        <Text style={styles.monthFilterEmptyText}>Nenhum mês disponível.</Text>
      )}
    </View>
  );

  const rdFooter = (
    <TouchableOpacity
      style={styles.minimalRdButton}
      onPress={() =>
        router.push({
          pathname: '/expense-report',
          params: withReturnDashboardCard(returnDashboardCard),
        })
      }
      activeOpacity={0.85}
    >
      <Text style={styles.minimalRdButtonText}>Criar Relatório de Despesas (RD)</Text>
    </TouchableOpacity>
  );

  if (isMinimalPresentation) {
    return (
      <ScreenAccessGate status={accessStatus}>
        <MinimalScreenLayout title="Financeiro" fixedTop={monthFilter} footer={rdFooter}>
          {selectedMonthIsPlannedOnly ? (
            <Text style={styles.plannedOnlyHint}>
              Este mês só tem lançamentos PLANEJADO. O resultado REALIZADO aparece vazio.
            </Text>
          ) : null}
          <View style={styles.reportsList}>
            {sectionsToRender.map((sectionId) => renderFinancialSection(sectionId))}
          </View>
        </MinimalScreenLayout>
      </ScreenAccessGate>
    );
  }

  return (
    <ScreenAccessGate status={accessStatus}>
    <LinearGradient colors={['#0f172a', '#020617']} style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.headerBar}>
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
                style={[
                  styles.rdShortcutButton,
                  item.highlight && styles.rdShortcutButtonHighlighted,
                ]}
                onPress={() => {
                  if (item.action.type === 'route') {
                    router.push({
                      pathname: '/expense-report',
                      params: withReturnDashboardCard(returnDashboardCard),
                    });
                  }
                }}
                activeOpacity={0.85}
              >
                <FontAwesome name={item.icon} size={14} color="#D1FAE5" />
                <View style={styles.rdShortcutTextWrap}>
                  <View
                    style={[
                      styles.rdShortcutTitleWrap,
                      item.highlight && styles.rdShortcutTitleWrapHighlighted,
                    ]}
                  >
                    <Text
                      style={[
                        styles.rdShortcutTitle,
                        item.highlight && styles.rdShortcutTitleHighlighted,
                      ]}
                    >
                      {item.title}
                    </Text>
                  </View>
                  <Text style={styles.rdShortcutSubtitle}>{item.subtitle}</Text>
                </View>
                <FontAwesome name="chevron-right" size={12} color="#94A3B8" />
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.reportsSection}>
            <Text style={styles.reportsSectionTitle}>Relatórios</Text>

            <View style={styles.monthFilterRow}>
              <Text style={styles.monthFilterLabel}>Mês</Text>
              {loadingMonths ? (
                <ActivityIndicator color="#10b981" style={styles.monthFilterLoader} />
              ) : monthDropdownOptions.length ? (
                <View style={styles.monthDropdownWrap}>
                  <DropdownSelect
                    options={monthDropdownOptions}
                    selectedValue={pickerValue}
                    onValueChange={(value) => {
                      const match = monthOptions.find(
                        (month) => formatFinancialMonthKey(month) === value
                      );

                      if (match) {
                        setSelectedMonth(match);
                      }
                    }}
                    modalTitle="Selecionar mês"
                    placeholder="Selecionar mês"
                    style={styles.monthDropdown}
                    triggerTextStyle={styles.financialMonthDropdownText}
                    triggerIconColor="#54A2DD"
                  />
                </View>
              ) : (
                <Text style={styles.monthFilterEmptyText}>Nenhum mês disponível.</Text>
              )}
            </View>

            {selectedMonthIsPlannedOnly ? (
              <Text style={styles.plannedOnlyHint}>
                Este mês só tem lançamentos PLANEJADO. O resultado REALIZADO aparece vazio; use a
                seção Orçamento ou Manutenção para editar o planejado.
              </Text>
            ) : null}

            <View style={styles.reportsList}>
              {sectionsToRender.map((sectionId) => renderFinancialSection(sectionId))}
            </View>
          </View>
        </ScrollView>

        <View style={[styles.footerControls, { paddingBottom: insets.bottom + 10 }]}>
          <CarouselFooterNav
            currentIndex={0}
            totalCount={1}
            centerLabel="Menu"
            centerAccessibilityLabel="Menu"
            onCenterPress={handleMenu}
            onPreviousPress={() => undefined}
            onNextPress={() => undefined}
            hideSideNavigation
            hidePageIndicator
            accent="emerald"
          />
        </View>
      </SafeAreaView>
    </LinearGradient>
    </ScreenAccessGate>
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
  },
  headerTitles: {
    flex: 1,
  },
  footerControls: {
    paddingHorizontal: 16,
    paddingTop: 8,
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
  rdShortcutButtonHighlighted: {
    borderColor: 'rgba(52, 211, 153, 0.75)',
    backgroundColor: 'rgba(6, 95, 70, 0.42)',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  rdShortcutTextWrap: {
    flex: 1,
    gap: 4,
  },
  rdShortcutTitleWrap: {
    alignSelf: 'flex-start',
  },
  rdShortcutTitleWrapHighlighted: {
    borderRadius: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.28)',
    borderWidth: 1,
    borderColor: 'rgba(110, 231, 183, 0.45)',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  rdShortcutTitle: {
    color: '#ECFDF5',
    fontSize: 14,
    fontWeight: '800',
  },
  rdShortcutTitleHighlighted: {
    color: '#D1FAE5',
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
  reportsSection: {
    gap: 10,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: 'rgba(30, 41, 59, 0.55)',
  },
  reportsSectionTitle: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  monthFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
  },
  monthFilterLabel: {
    color: '#10b981',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    flexShrink: 0,
    marginRight: 'auto',
  },
  reportsList: {
    gap: 10,
  },
  resultSection: {
    width: '100%',
    alignSelf: 'flex-end',
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
  resultMonthSectionHeader: {
    backgroundColor: '#FFFFFF',
    borderWidth: 0,
    borderColor: 'rgba(0, 0, 0, 0)',
    boxSizing: 'content-box',
  },
  comparisonMonthSectionHeader: {
    backgroundColor: '#FFFFFF',
    borderWidth: 0,
  },
  twelveMonthsSectionHeader: {
    backgroundColor: '#FFFFFF',
    borderWidth: 0,
  },
  bankBalanceSectionHeader: {
    backgroundColor: '#FFFFFF',
    borderWidth: 0,
  },
  budgetSectionHeader: {
    backgroundColor: '#FFFFFF',
    borderWidth: 0,
  },
  resultSectionHeaderText: {
    flex: 1,
    gap: 4,
  },
  resultSectionLabel: {
    color: '#3A96DD',
  },
  resultSectionMeta: {
    color: '#5AA8E3',
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
    borderColor: 'rgba(52, 211, 153, 0.35)',
    backgroundColor: 'rgba(30, 58, 138, 0.15)',
    overflow: 'hidden',
  },
  twelveMonthsSection: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    backgroundColor: 'rgba(19, 78, 74, 0.15)',
    overflow: 'hidden',
  },
  budgetSection: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
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
  budgetSectionBlockedText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
    fontStyle: 'italic',
  },
  bankBalanceSection: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    backgroundColor: 'rgba(120, 53, 15, 0.15)',
    overflow: 'hidden',
  },
  monthDropdownWrap: {
    width: 209,
    minWidth: 209,
    maxWidth: 209,
    alignSelf: 'flex-end',
    flexShrink: 0,
  },
  monthDropdown: {
    width: '100%',
    minWidth: '100%',
    flex: 0,
    flexGrow: 0,
    flexShrink: 0,
    color: '#54A2DD',
  },
  monthFilterLoader: {
    flex: 1,
    paddingVertical: 8,
  },
  plannedOnlyHint: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 18,
  },
  monthFilterEmptyText: {
    flex: 1,
    color: '#94A3B8',
    fontSize: 14,
    paddingVertical: 8,
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
  minimalMonthRow: {
    gap: 8,
  },
  minimalMonthLabel: {
    color: MINIMAL_UI.text,
    fontSize: 14,
    fontWeight: '700',
  },
  minimalMonthDropdown: {
    borderColor: MINIMAL_UI.border,
    backgroundColor: MINIMAL_UI.background,
  },
  financialMonthDropdownText: {
    color: '#54A2DD',
  },
  minimalRdButton: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  minimalRdButtonText: {
    color: MINIMAL_UI.text,
    fontSize: 15,
    fontWeight: '700',
  },
});

import {
  formatPlanUserCap,
  planCoversActiveUsers,
  planTooSmallMessage,
} from '@/lib/billing/planCapacity';
import {
  BILLING_INTERVAL_LINE,
  BILLING_SCREEN_SUBTITLE,
} from '@/lib/billing/billingInterval';
import type { BillingPlan } from '@/lib/billing/types';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import { FontAwesome } from '@expo/vector-icons';
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

export type BillingContractInfo = {
  hasSubscription: boolean;
  planName: string | null;
  signedAt: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
};

export type BillingClassProps = {
  plans: BillingPlan[];
  currentPlanCode?: string | null;
  activeUsers?: number | null;
  activeMembers?: number | null;
  activeCongregados?: number | null;
  contract?: BillingContractInfo | null;
  loading?: boolean;
  checkoutLoadingPlanCode?: string | null;
  contractBusy?: boolean;
  onSubscribe: (plan: BillingPlan) => void;
  onRenewContract?: () => void;
  onRescindContract?: () => void;
  title?: string;
  subtitle?: string;
};

const PLAN_ICONS: Record<string, React.ComponentProps<typeof FontAwesome>['name']> = {
  semente: 'leaf',
  crescimento: 'line-chart',
  expansao: 'sitemap',
  ministerio: 'star',
};

function formatPtDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Módulo de planos de assinatura — stateless / isolado do dashboard.
 * Paleta: #FFFFFF + azuis. Checkout via callback (Stripe).
 */
export function BillingClass({
  plans,
  currentPlanCode = null,
  activeUsers = null,
  activeMembers = null,
  activeCongregados = null,
  contract = null,
  loading = false,
  checkoutLoadingPlanCode = null,
  contractBusy = false,
  onSubscribe,
  onRenewContract,
  onRescindContract,
  title = 'Assinaturas',
  subtitle = BILLING_SCREEN_SUBTITLE,
}: BillingClassProps) {
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={MINIMAL_UI.blue} />
      </View>
    );
  }

  const users = activeUsers ?? 0;
  const members = activeMembers ?? 0;
  const congregados = activeCongregados ?? 0;
  const showStatus = activeUsers != null || activeMembers != null || activeCongregados != null;
  const hasContract = contract?.hasSubscription === true;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>

      {showStatus ? (
        <Text style={styles.statusLine}>
          Status atual: {users.toLocaleString('pt-BR')} usuários ativos (
          {members.toLocaleString('pt-BR')} membros +{' '}
          {congregados.toLocaleString('pt-BR')} congregados)
          {currentPlanCode ? ` · plano ${currentPlanCode}` : ''}
        </Text>
      ) : null}

      {showStatus ? (
        <Text style={styles.hintLine}>
          O plano precisa comportar todos os usuários ativos. Pacotes com teto menor não ficam
          disponíveis para assinatura.
        </Text>
      ) : null}

      <View style={styles.contractCard}>
        <Text style={styles.contractTitle}>Contratação atual</Text>
        <Text style={styles.contractLine}>
          Pacote atual assinado: {hasContract ? contract?.planName || '—' : 'Nenhum pacote assinado'}
        </Text>
        <Text style={styles.contractLine}>
          Data da assinatura: {formatPtDate(contract?.signedAt)}
        </Text>
        <Text style={styles.contractLine}>
          Data da próxima renovação: {formatPtDate(contract?.currentPeriodEnd)}
        </Text>
        {contract?.cancelAtPeriodEnd ? (
          <Text style={styles.contractWarning}>
            Rescisão agendada: na data da próxima renovação a instância será desativada. Os
            usuários perderão o acesso; o super administrador continua podendo entrar.
          </Text>
        ) : null}

        <View style={styles.contractActions}>
          <Pressable
            style={({ pressed }) => [
              styles.cta,
              styles.ctaCurrent,
              (contractBusy || !hasContract) && styles.ctaDisabled,
              pressed && !contractBusy && hasContract && styles.ctaPressed,
            ]}
            disabled={contractBusy || !hasContract}
            onPress={() => onRenewContract?.()}
            accessibilityRole="button"
            accessibilityLabel="Renovar Contratação"
          >
            {contractBusy ? (
              <ActivityIndicator color={MINIMAL_UI.onDark} />
            ) : (
              <Text style={styles.ctaLabel}>Renovar Contratação</Text>
            )}
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.cta,
              styles.ctaRescind,
              (contractBusy || !hasContract || contract?.cancelAtPeriodEnd) && styles.ctaDisabled,
              pressed && !contractBusy && hasContract && !contract?.cancelAtPeriodEnd && styles.ctaPressed,
            ]}
            disabled={contractBusy || !hasContract || contract?.cancelAtPeriodEnd === true}
            onPress={() => onRescindContract?.()}
            accessibilityRole="button"
            accessibilityLabel="Rescindir Contratação"
          >
            <Text
              style={[
                styles.ctaLabel,
                styles.ctaRescindLabel,
                (contractBusy || !hasContract || contract?.cancelAtPeriodEnd) &&
                  styles.ctaRescindLabelDisabled,
              ]}
            >
              Rescindir Contratação
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.list}>
        {plans.map((plan) => {
          const isCurrent = currentPlanCode?.toLowerCase() === plan.code.toLowerCase();
          const busy = checkoutLoadingPlanCode === plan.code;
          const icon = PLAN_ICONS[plan.code] || 'circle-o';
          const fits = planCoversActiveUsers(plan.maxMembers, users);
          const canSubscribe = fits && !isCurrent;

          return (
            <View key={plan.id || plan.code} style={styles.card}>
              <View style={styles.cardHeader}>
                <FontAwesome name={icon} size={18} color={MINIMAL_UI.icon} />
                <Text style={styles.planName}>{plan.name}</Text>
              </View>
              <Text style={styles.planLimit}>{formatPlanUserCap(plan.maxMembers)}</Text>
              <Text style={styles.planInterval}>{BILLING_INTERVAL_LINE}</Text>
              {plan.description ? (
                <Text style={styles.planDescription}>{plan.description}</Text>
              ) : null}
              {!fits ? (
                <Text style={styles.unavailable}>{planTooSmallMessage(plan.maxMembers, users)}</Text>
              ) : null}
              {isCurrent ? (
                <Text style={styles.currentBadge}>Pacote em vigor</Text>
              ) : null}
              {canSubscribe ? (
                <Pressable
                  style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
                  disabled={busy}
                  onPress={() => onSubscribe(plan)}
                  accessibilityRole="button"
                  accessibilityLabel={`Assinar plano ${plan.name}`}
                >
                  {busy ? (
                    <ActivityIndicator color={MINIMAL_UI.onDark} />
                  ) : (
                    <Text style={styles.ctaLabel}>Assinar</Text>
                  )}
                </Pressable>
              ) : null}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
    gap: 12,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  title: {
    color: MINIMAL_UI.blueDark,
    fontSize: 24,
    fontWeight: '800',
  },
  subtitle: {
    color: MINIMAL_UI.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  statusLine: {
    color: MINIMAL_UI.blue,
    fontSize: 13,
    fontWeight: '600',
  },
  hintLine: {
    color: MINIMAL_UI.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  unavailable: {
    color: '#B91C1C',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  list: {
    gap: 14,
    marginTop: 8,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: MINIMAL_UI.border,
    paddingVertical: 14,
    gap: 6,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  planName: {
    color: MINIMAL_UI.blueDark,
    fontSize: 18,
    fontWeight: '700',
  },
  planLimit: {
    color: MINIMAL_UI.blue,
    fontSize: 14,
    fontWeight: '600',
  },
  planInterval: {
    color: MINIMAL_UI.blueDark,
    fontSize: 13,
    fontWeight: '700',
  },
  planDescription: {
    color: MINIMAL_UI.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  cta: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: MINIMAL_UI.blue,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center',
  },
  ctaCurrent: {
    backgroundColor: MINIMAL_UI.blueDark,
  },
  ctaPressed: {
    opacity: 0.88,
  },
  ctaLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  contractCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: MINIMAL_UI.border,
    padding: 14,
    gap: 6,
    marginTop: 4,
  },
  contractTitle: {
    color: MINIMAL_UI.blueDark,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  contractLine: {
    color: MINIMAL_UI.blueDark,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  contractWarning: {
    color: '#B91C1C',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    marginTop: 4,
  },
  contractActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  ctaDisabled: {
    opacity: 0.45,
  },
  ctaRescind: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#B91C1C',
  },
  ctaRescindLabel: {
    color: '#B91C1C',
  },
  ctaRescindLabelDisabled: {
    color: '#9CA3AF',
  },
  currentBadge: {
    color: MINIMAL_UI.blueDark,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
  },
});

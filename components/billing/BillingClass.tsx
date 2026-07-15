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

export type BillingClassProps = {
  plans: BillingPlan[];
  currentPlanCode?: string | null;
  subscriptionStatus?: string | null;
  memberCount?: number | null;
  loading?: boolean;
  checkoutLoadingPlanCode?: string | null;
  onSubscribe: (plan: BillingPlan) => void;
  title?: string;
  subtitle?: string;
};

const PLAN_ICONS: Record<string, React.ComponentProps<typeof FontAwesome>['name']> = {
  semente: 'leaf',
  crescimento: 'line-chart',
  expansao: 'sitemap',
  ministerio: 'star',
};

const formatMembers = (maxMembers: number) => {
  if (maxMembers < 0) return 'Membros ilimitados';
  return `Até ${maxMembers.toLocaleString('pt-BR')} membros`;
};

/**
 * Módulo de planos de assinatura — stateless / isolado do dashboard.
 * Paleta: #FFFFFF + azuis. Checkout via callback (Stripe).
 */
export function BillingClass({
  plans,
  currentPlanCode = null,
  subscriptionStatus = null,
  memberCount = null,
  loading = false,
  checkoutLoadingPlanCode = null,
  onSubscribe,
  title = 'Assinaturas',
  subtitle = 'Escolha o plano da sua igreja. O pagamento é processado com segurança pelo Stripe.',
}: BillingClassProps) {
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={MINIMAL_UI.blue} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>

      {subscriptionStatus ? (
        <Text style={styles.statusLine}>
          Status atual: {subscriptionStatus}
          {currentPlanCode ? ` · plano ${currentPlanCode}` : ''}
          {memberCount != null ? ` · ${memberCount} membros` : ''}
        </Text>
      ) : null}

      <View style={styles.list}>
        {plans.map((plan) => {
          const isCurrent = currentPlanCode?.toLowerCase() === plan.code.toLowerCase();
          const busy = checkoutLoadingPlanCode === plan.code;
          const icon = PLAN_ICONS[plan.code] || 'circle-o';

          return (
            <View key={plan.id || plan.code} style={styles.card}>
              <View style={styles.cardHeader}>
                <FontAwesome name={icon} size={18} color={MINIMAL_UI.icon} />
                <Text style={styles.planName}>{plan.name}</Text>
              </View>
              <Text style={styles.planLimit}>{formatMembers(plan.maxMembers)}</Text>
              {plan.description ? (
                <Text style={styles.planDescription}>{plan.description}</Text>
              ) : null}
              <Pressable
                style={({ pressed }) => [
                  styles.cta,
                  isCurrent && styles.ctaCurrent,
                  pressed && styles.ctaPressed,
                ]}
                disabled={busy}
                onPress={() => onSubscribe(plan)}
                accessibilityRole="button"
                accessibilityLabel={`Assinar plano ${plan.name}`}
              >
                {busy ? (
                  <ActivityIndicator color={MINIMAL_UI.onDark} />
                ) : (
                  <Text style={styles.ctaLabel}>{isCurrent ? 'Gerenciar / Renovar' : 'Assinar'}</Text>
                )}
              </Pressable>
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
});

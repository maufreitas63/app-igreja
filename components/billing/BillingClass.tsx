import type { BillingPlan } from '@/lib/billing/types';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import { cn } from '@/lib/utils';
import { FontAwesome } from '@expo/vector-icons';
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

export type BillingClassProps = {
  plans: BillingPlan[];
  currentPlanCode?: string | null;
  activeUsers?: number | null;
  activeMembers?: number | null;
  activeCongregados?: number | null;
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
  activeUsers = null,
  activeMembers = null,
  activeCongregados = null,
  loading = false,
  checkoutLoadingPlanCode = null,
  onSubscribe,
  title = 'Assinaturas',
  subtitle = 'Escolha o plano da sua igreja. O pagamento é processado com segurança pelo Stripe.',
}: BillingClassProps) {
  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-minimal-bg">
        <ActivityIndicator color={MINIMAL_UI.blue} />
      </View>
    );
  }

  const users = activeUsers ?? 0;
  const members = activeMembers ?? 0;
  const congregados = activeCongregados ?? 0;
  const showStatus = activeUsers != null || activeMembers != null || activeCongregados != null;

  return (
    <ScrollView
      className="flex-1 bg-minimal-bg"
      contentContainerClassName="gap-3 px-5 pb-10 pt-4"
      keyboardShouldPersistTaps="handled"
    >
      <Text className="text-2xl font-extrabold text-minimal-blue-dark">{title}</Text>
      <Text className="text-sm leading-5 text-minimal-muted">{subtitle}</Text>

      {showStatus ? (
        <Text className="text-[13px] font-semibold text-minimal-blue">
          Status atual: {users.toLocaleString('pt-BR')} usuários (
          {members.toLocaleString('pt-BR')} membros +{' '}
          {congregados.toLocaleString('pt-BR')} congregados) ativos
          {currentPlanCode ? ` · plano ${currentPlanCode}` : ''}
        </Text>
      ) : null}

      <View className="mt-2 gap-3.5">
        {plans.map((plan) => {
          const isCurrent = currentPlanCode?.toLowerCase() === plan.code.toLowerCase();
          const busy = checkoutLoadingPlanCode === plan.code;
          const icon = PLAN_ICONS[plan.code] || 'circle-o';

          return (
            <View
              key={plan.id || plan.code}
              className="gap-1.5 border-b border-minimal-border bg-minimal-bg py-3.5"
            >
              <View className="flex-row items-center gap-2.5">
                <FontAwesome name={icon} size={18} color={MINIMAL_UI.icon} />
                <Text className="text-lg font-bold text-minimal-blue-dark">{plan.name}</Text>
              </View>
              <Text className="text-sm font-semibold text-minimal-blue">
                {formatMembers(plan.maxMembers)}
              </Text>
              {plan.description ? (
                <Text className="text-[13px] leading-[18px] text-minimal-muted">{plan.description}</Text>
              ) : null}
              <Pressable
                className={cn(
                  'mt-2 min-w-[120px] items-center self-start rounded-lg px-4 py-2.5',
                  isCurrent ? 'bg-minimal-blue-dark' : 'bg-minimal-blue'
                )}
                style={({ pressed }) => (pressed ? { opacity: 0.88 } : null)}
                disabled={busy}
                onPress={() => onSubscribe(plan)}
                accessibilityRole="button"
                accessibilityLabel={`Assinar plano ${plan.name}`}
              >
                {busy ? (
                  <ActivityIndicator color={MINIMAL_UI.onDark} />
                ) : (
                  <Text className="text-sm font-bold text-minimal-on-dark">
                    {isCurrent ? 'Gerenciar / Renovar' : 'Assinar'}
                  </Text>
                )}
              </Pressable>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

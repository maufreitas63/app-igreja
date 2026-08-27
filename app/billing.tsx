import { BillingClass } from '@/components/billing/BillingClass';
import { CloseFooterBar } from '@/components/minimal/CloseFooterBar';
import { ScreenAccessGate } from '@/components/ScreenAccessGate';
import {
  createStripeCheckoutSession,
  getTenantBillingStatus,
  listBillingPlans,
} from '@/lib/billing/billingApi';
import type { BillingPlan } from '@/lib/billing/types';
import { FAIL_CLOSED_REDIRECT_PATH } from '@/lib/failClosedNavigation';
import { getStoredTenantId } from '@/lib/tenantSession';
import { useLeadershipRouteGuard } from '@/hooks/useLeadershipRouteGuard';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useCallback, useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

/**
 * Rota de assinaturas. Isolada do dashboard; hosta o BillingClass.
 * Ambiente: IBEP + Stripe Test Keys via /api/stripe-create-checkout.
 */
export default function BillingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const accessStatus = useLeadershipRouteGuard({
    deniedMessage: 'Você não tem permissão para abrir as assinaturas da igreja.',
    requireMaintenance: true,
  });
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [currentPlanCode, setCurrentPlanCode] = useState<string | null>(null);
  const [activeUsers, setActiveUsers] = useState<number | null>(null);
  const [activeMembers, setActiveMembers] = useState<number | null>(null);
  const [activeCongregados, setActiveCongregados] = useState<number | null>(null);
  const [checkoutLoadingPlanCode, setCheckoutLoadingPlanCode] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [planRows, billing] = await Promise.all([
        listBillingPlans(),
        getTenantBillingStatus(),
      ]);
      setPlans(planRows);
      setCurrentPlanCode(billing.plan?.code ?? null);
      setActiveUsers(billing.memberCount);
      setActiveMembers(billing.activeMembers);
      setActiveCongregados(billing.activeCongregados);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleSubscribe = async (plan: BillingPlan) => {
    try {
      const tenantId = await getStoredTenantId();
      if (!tenantId) {
        Toast.show({
          type: 'error',
          text1: 'Assinaturas',
          text2: 'Selecione a igreja (tenant) antes de assinar. Use ?igreja=IBEP.',
        });
        return;
      }

      setCheckoutLoadingPlanCode(plan.code);
      const origin =
        Platform.OS === 'web' && typeof window !== 'undefined'
          ? window.location.origin
          : undefined;
      const successUrl = origin
        ? `${origin}/billing?checkout=success&igreja=IBEP`
        : undefined;
      const cancelUrl = origin
        ? `${origin}/billing?checkout=cancel&igreja=IBEP`
        : undefined;

      const { url } = await createStripeCheckoutSession({
        tenantId,
        planCode: plan.code,
        successUrl,
        cancelUrl,
      });

      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.location.href = url;
        return;
      }

      await WebBrowser.openBrowserAsync(url);
      await refresh();
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Checkout Stripe',
        text2: error instanceof Error ? error.message : 'Falha ao iniciar assinatura.',
        visibilityTime: 6000,
      });
    } finally {
      setCheckoutLoadingPlanCode(null);
    }
  };

  return (
    <ScreenAccessGate status={accessStatus}>
    <View style={[styles.root, { paddingTop: Math.max(insets.top, 12) }]}>
      <BillingClass
        plans={plans}
        loading={loading}
        currentPlanCode={currentPlanCode}
        activeUsers={activeUsers}
        activeMembers={activeMembers}
        activeCongregados={activeCongregados}
        checkoutLoadingPlanCode={checkoutLoadingPlanCode}
        onSubscribe={(plan) => void handleSubscribe(plan)}
      />
      <CloseFooterBar onPress={() => router.replace(FAIL_CLOSED_REDIRECT_PATH)} />
    </View>
    </ScreenAccessGate>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
});

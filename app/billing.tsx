import { BillingClass } from '@/components/billing/BillingClass';
import {
  createStripeCheckoutSession,
  getTenantBillingStatus,
  listBillingPlans,
} from '@/lib/billing/billingApi';
import type { BillingPlan } from '@/lib/billing/types';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import { getStoredTenantId } from '@/lib/tenantSession';
import { checkSessionIsSuperAdmin } from '@/lib/maintenanceAccessControlApi';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

/**
 * Rota de assinaturas. Isolada do dashboard; hosta o BillingClass.
 * Ambiente: IBEP + Stripe Test Keys via /api/stripe-create-checkout.
 */
export default function BillingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [statusLabel, setStatusLabel] = useState<string | null>(null);
  const [currentPlanCode, setCurrentPlanCode] = useState<string | null>(null);
  const [memberCount, setMemberCount] = useState<number | null>(null);
  const [checkoutLoadingPlanCode, setCheckoutLoadingPlanCode] = useState<string | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [planRows, billing, sa] = await Promise.all([
        listBillingPlans(),
        getTenantBillingStatus(),
        checkSessionIsSuperAdmin().catch(() => false),
      ]);
      setPlans(planRows);
      setStatusLabel(billing.status);
      setCurrentPlanCode(billing.plan?.code ?? null);
      setMemberCount(billing.memberCount);
      setIsSuperAdmin(sa);
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
    <View style={[styles.root, { paddingTop: Math.max(insets.top, 12) }]}>
      <View style={styles.topRow}>
        <View style={styles.topLeft}>
          {isSuperAdmin ? (
            <Pressable
              onPress={() => router.replace('/(tabs)')}
              style={styles.backBtn}
              accessibilityRole="button"
              accessibilityLabel="Voltar ao início"
            >
              <Text style={styles.backLabel}>Voltar</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => router.replace('/igrejas')}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel="Trocar igreja"
          >
            <Text style={styles.backLabel}>Trocar igreja</Text>
          </Pressable>
        </View>
        <Pressable onPress={() => void refresh()} style={styles.backBtn}>
          <Text style={styles.backLabel}>Atualizar</Text>
        </Pressable>
      </View>

      <BillingClass
        plans={plans}
        loading={loading}
        currentPlanCode={currentPlanCode}
        subscriptionStatus={statusLabel}
        memberCount={memberCount}
        checkoutLoadingPlanCode={checkoutLoadingPlanCode}
        onSubscribe={(plan) => void handleSubscribe(plan)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  topLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backBtn: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  backLabel: {
    color: MINIMAL_UI.blue,
    fontWeight: '700',
    fontSize: 14,
  },
});

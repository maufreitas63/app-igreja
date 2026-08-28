import { BillingClass } from '@/components/billing/BillingClass';
import { CloseFooterBar } from '@/components/minimal/CloseFooterBar';
import { ScreenAccessGate } from '@/components/ScreenAccessGate';
import { planCoversActiveUsers } from '@/lib/billing/planCapacity';
import {
  createStripeCheckoutSession,
  getTenantBillingStatus,
  listBillingPlans,
  manageTenantSubscription,
} from '@/lib/billing/billingApi';
import type { BillingPlan } from '@/lib/billing/types';
import { confirmDialog } from '@/lib/confirmDialog';
import { MEMBER_HOME_PATH } from '@/lib/failClosedNavigation';
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
  const [currentPlanName, setCurrentPlanName] = useState<string | null>(null);
  const [hasSubscription, setHasSubscription] = useState(false);
  const [signedAt, setSignedAt] = useState<string | null>(null);
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState<string | null>(null);
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState(false);
  const [activeUsers, setActiveUsers] = useState<number | null>(null);
  const [activeMembers, setActiveMembers] = useState<number | null>(null);
  const [activeCongregados, setActiveCongregados] = useState<number | null>(null);
  const [checkoutLoadingPlanCode, setCheckoutLoadingPlanCode] = useState<string | null>(null);
  const [contractBusy, setContractBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [planRows, billing] = await Promise.all([
        listBillingPlans(),
        getTenantBillingStatus(),
      ]);
      setPlans(planRows);
      setCurrentPlanCode(billing.plan?.code ?? null);
      setCurrentPlanName(billing.plan?.name ?? null);
      setHasSubscription(billing.hasSubscription);
      setSignedAt(billing.signedAt ?? billing.currentPeriodStart ?? null);
      setCurrentPeriodEnd(billing.currentPeriodEnd ?? null);
      setCancelAtPeriodEnd(billing.cancelAtPeriodEnd === true);
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

      const activeCount = activeUsers ?? 0;
      if (!planCoversActiveUsers(plan.maxMembers, activeCount)) {
        Toast.show({
          type: 'error',
          text1: 'Assinaturas',
          text2: `Este plano comporta até ${plan.maxMembers} usuários ativos. A igreja tem ${activeCount} (membros + congregados).`,
          visibilityTime: 7000,
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

  const handleRenewContract = async () => {
    try {
      const tenantId = await getStoredTenantId();
      if (!tenantId) {
        Toast.show({
          type: 'error',
          text1: 'Assinaturas',
          text2: 'Selecione a igreja antes de renovar a contratação.',
        });
        return;
      }

      if (!hasSubscription) {
        Toast.show({
          type: 'info',
          text1: 'Assinaturas',
          text2: 'Escolha um pacote abaixo para assinar.',
        });
        return;
      }

      setContractBusy(true);

      if (cancelAtPeriodEnd) {
        const result = await manageTenantSubscription({ tenantId, action: 'resume' });
        Toast.show({
          type: 'success',
          text1: 'Contratação renovada',
          text2: result.message,
          visibilityTime: 6000,
        });
        await refresh();
        return;
      }

      Toast.show({
        type: 'success',
        text1: 'Contratação ativa',
        text2: currentPeriodEnd
          ? `A renovação segue automaticamente em ${new Date(currentPeriodEnd).toLocaleDateString('pt-BR')}.`
          : 'A contratação já está ativa e será renovada na próxima cobrança.',
        visibilityTime: 6000,
      });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Renovar Contratação',
        text2: error instanceof Error ? error.message : 'Falha ao renovar a contratação.',
        visibilityTime: 6000,
      });
    } finally {
      setContractBusy(false);
    }
  };

  const handleRescindContract = async () => {
    const tenantId = await getStoredTenantId();
    if (!tenantId || !hasSubscription) {
      Toast.show({
        type: 'error',
        text1: 'Assinaturas',
        text2: 'Não há contratação ativa para rescindir.',
      });
      return;
    }

    const renewalLabel = currentPeriodEnd
      ? new Date(currentPeriodEnd).toLocaleDateString('pt-BR')
      : 'a próxima renovação';
    const confirmed = await confirmDialog(
      'Rescindir Contratação',
      `A rescisão vale a partir de ${renewalLabel}. Até lá a instância permanece ativa. Naquela data o acesso dos usuários será encerrado (o super administrador continua podendo entrar).`,
      'Rescindir',
      'Cancelar',
      { destructive: true }
    );
    if (!confirmed) return;

    try {
      setContractBusy(true);
      const result = await manageTenantSubscription({ tenantId, action: 'cancel' });
      Toast.show({
        type: 'success',
        text1: 'Rescisão agendada',
        text2: result.message,
        visibilityTime: 7000,
      });
      await refresh();
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Rescindir Contratação',
        text2: error instanceof Error ? error.message : 'Falha ao agendar a rescisão.',
        visibilityTime: 6000,
      });
    } finally {
      setContractBusy(false);
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
        contractBusy={contractBusy}
        contract={{
          hasSubscription,
          planName: currentPlanName,
          signedAt,
          currentPeriodEnd,
          cancelAtPeriodEnd,
        }}
        onSubscribe={(plan) => void handleSubscribe(plan)}
        onRenewContract={() => void handleRenewContract()}
        onRescindContract={() => void handleRescindContract()}
      />
      <CloseFooterBar onPress={() => router.replace(MEMBER_HOME_PATH)} />
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

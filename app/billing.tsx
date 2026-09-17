import { BillingClass, type BillingCheckoutFeedback } from '@/components/billing/BillingClass';
import { CloseFooterBar } from '@/components/minimal/CloseFooterBar';
import { ScreenAccessGate } from '@/components/ScreenAccessGate';
import { planCoversActiveUsers } from '@/lib/billing/planCapacity';
import {
  createStripeCheckoutSession,
  getTenantBillingStatus,
  listBillingPlans,
  listBillingSaasContracts,
  manageTenantSubscription,
  syncTenantSubscriptionFromStripe,
} from '@/lib/billing/billingApi';
import type { BillingPlan, BillingSaasContract } from '@/lib/billing/types';
import { confirmDialog } from '@/lib/confirmDialog';
import { MEMBER_HOME_PATH } from '@/lib/failClosedNavigation';
import { getStoredActiveIgrejaBranding, getStoredTenantId } from '@/lib/tenantSession';
import { useLeadershipRouteGuard } from '@/hooks/useLeadershipRouteGuard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

function firstQueryParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return String(value[0] || '').trim();
  return String(value || '').trim();
}

/**
 * Rota de assinaturas. Isolada do dashboard; hosta o BillingClass.
 * Ambiente: IBEP + Stripe Test Keys via /api/stripe-create-checkout.
 */
export default function BillingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ checkout?: string; session_id?: string }>();
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
  const [contracts, setContracts] = useState<BillingSaasContract[]>([]);
  const [accessAllowed, setAccessAllowed] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string>('inactive');
  const [checkoutFeedback, setCheckoutFeedback] = useState<BillingCheckoutFeedback | null>(null);
  const checkoutHandledRef = useRef('');

  const fetchBilling = useCallback(async () => {
    const tenantId = await getStoredTenantId();
    const [planRows, billing, contractRows] = await Promise.all([
      listBillingPlans(),
      getTenantBillingStatus(tenantId),
      listBillingSaasContracts(tenantId),
    ]);
    setPlans(planRows);
    setCurrentPlanCode(billing.plan?.code ?? null);
    setCurrentPlanName(billing.plan?.name ?? null);
    setHasSubscription(billing.hasSubscription);
    setAccessAllowed(billing.accessAllowed === true);
    setSubscriptionStatus(billing.status || 'inactive');
    setSignedAt(billing.signedAt ?? billing.currentPeriodStart ?? null);
    setCurrentPeriodEnd(billing.currentPeriodEnd ?? null);
    setCancelAtPeriodEnd(billing.cancelAtPeriodEnd === true);
    setActiveUsers(billing.memberCount);
    setActiveMembers(billing.activeMembers);
    setActiveCongregados(billing.activeCongregados);
    setContracts(contractRows);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const checkoutState = firstQueryParam(params.checkout);
    const sessionId = firstQueryParam(params.session_id);
    const handleKey = `${checkoutState}:${sessionId}`;

    const showCheckoutFeedback = (feedback: BillingCheckoutFeedback) => {
      if (checkoutHandledRef.current === handleKey) return;
      checkoutHandledRef.current = handleKey;
      setCheckoutFeedback(feedback);
      Toast.show({
        type: feedback.type === 'success' ? 'success' : 'error',
        text1: feedback.title,
        text2: feedback.message,
        visibilityTime: 7000,
      });
    };

    void (async () => {
      setLoading(true);
      try {
        const tenantId = await getStoredTenantId();

        if (checkoutState === 'cancel') {
          showCheckoutFeedback({
            type: 'error',
            title: 'Pagamento não concluído',
            message:
              'O checkout foi cancelado ou o cartão foi recusado. Nenhum acesso foi liberado.',
          });
        } else if (checkoutState === 'success') {
          if (!sessionId.startsWith('cs_') || !tenantId) {
            showCheckoutFeedback({
              type: 'error',
              title: 'Pagamento não confirmado',
              message:
                'A volta do checkout não prova pagamento. Confirme a sessão no Stripe antes de liberar o plano.',
            });
          } else {
            try {
              const sync = await syncTenantSubscriptionFromStripe({
                tenantId,
                sessionId,
              });
              if (sync.paymentConfirmed && sync.accessAllowed) {
                showCheckoutFeedback({
                  type: 'success',
                  title: 'Contratação confirmada',
                  message: 'O Stripe confirmou o pagamento e o pacote foi atualizado.',
                });
              } else {
                showCheckoutFeedback({
                  type: 'error',
                  title: 'Pagamento não confirmado',
                  message:
                    sync.message
                    || 'O Stripe não confirmou o pagamento. O acesso não foi liberado.',
                });
              }
            } catch (error) {
              showCheckoutFeedback({
                type: 'error',
                title: 'Pagamento não confirmado',
                message:
                  error instanceof Error
                    ? error.message
                    : 'Não foi possível confirmar o pagamento no Stripe. O acesso não foi liberado.',
              });
            }
          }
        }

        if (!cancelled) {
          await fetchBilling();
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fetchBilling, params.checkout, params.session_id]);

  const handleSubscribe = async (plan: BillingPlan) => {
    try {
      const tenantId = await getStoredTenantId();
      if (!tenantId) {
        Toast.show({
          type: 'error',
          text1: 'Assinaturas',
          text2: 'Selecione a igreja (tenant) antes de assinar.',
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
      setCheckoutFeedback(null);
      const origin =
        Platform.OS === 'web' && typeof window !== 'undefined'
          ? window.location.origin
          : undefined;
      const branding = await getStoredActiveIgrejaBranding();
      const igreja = branding?.code?.trim().toUpperCase();
      const igrejaQuery = igreja ? `&igreja=${encodeURIComponent(igreja)}` : '';
      const successUrl = origin
        ? `${origin}/billing?checkout=success${igrejaQuery}`
        : undefined;
      const cancelUrl = origin
        ? `${origin}/billing?checkout=cancel${igrejaQuery}`
        : undefined;

      const { url, sessionId } = await createStripeCheckoutSession({
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
      const tenantIdAfter = await getStoredTenantId();
      if (tenantIdAfter && sessionId) {
        const sync = await syncTenantSubscriptionFromStripe({
          tenantId: tenantIdAfter,
          sessionId,
        });
        if (sync.paymentConfirmed && sync.accessAllowed) {
          setCheckoutFeedback({
            type: 'success',
            title: 'Contratação confirmada',
            message: 'O Stripe confirmou o pagamento e o pacote foi atualizado.',
          });
        } else {
          setCheckoutFeedback({
            type: 'error',
            title: 'Pagamento não confirmado',
            message:
              'O cartão pode ter sido recusado ou o checkout foi fechado. O acesso não foi liberado.',
          });
        }
      } else {
        setCheckoutFeedback({
          type: 'error',
          title: 'Pagamento não confirmado',
          message:
            'Não foi possível conferir a sessão no Stripe. O acesso não foi liberado.',
        });
      }
      await fetchBilling();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao iniciar assinatura.';
      setCheckoutFeedback({
        type: 'error',
        title: 'Checkout Stripe',
        message,
      });
      Toast.show({
        type: 'error',
        text1: 'Checkout Stripe',
        text2: message,
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

      if (!accessAllowed) {
        Toast.show({
          type: 'info',
          text1: 'Assinaturas',
          text2: 'Escolha um pacote abaixo para assinar. O plano só libera após o pagamento confirmado.',
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
        await fetchBilling();
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
    if (!tenantId || !accessAllowed) {
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
      await fetchBilling();
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
          accessAllowed,
          status: subscriptionStatus,
          planName: currentPlanName,
          signedAt,
          currentPeriodEnd,
          cancelAtPeriodEnd,
        }}
        onSubscribe={(plan) => void handleSubscribe(plan)}
        onRenewContract={() => void handleRenewContract()}
        onRescindContract={() => void handleRescindContract()}
        contracts={contracts}
        checkoutFeedback={checkoutFeedback}
      />
      <CloseFooterBar onPress={() => router.replace(MEMBER_HOME_PATH)} includeScreenPadding />
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

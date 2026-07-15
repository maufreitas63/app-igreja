import { getTenantBillingStatus } from '@/lib/billing/billingApi';
import type { TenantBillingStatus } from '@/lib/billing/types';
import { checkSessionIsSuperAdmin } from '@/lib/maintenanceAccessControlApi';
import {
  getStoredActiveIgrejaBranding,
  getStoredTenantId,
} from '@/lib/tenantSession';
import { usePathname, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

type Props = {
  children: React.ReactNode;
};

const normalizePathname = (pathname: string) => {
  const trimmed = pathname.replace(/\/+$/, '');
  return trimmed || '/';
};

/** Rotas liberadas sem assinatura ativa. */
const isBillingExemptRoute = (pathname: string) => {
  const normalized = normalizePathname(pathname);
  return (
    normalized === '/'
    || normalized === '/index'
    || normalized === '/billing'
    || normalized === '/register'
    || normalized === '/forgot-password'
    || normalized === '/selecionar-igreja'
    || normalized === '/igrejas'
    || normalized === '/totem-checkin'
    || normalized === '/sessao-encerrada'
    || normalized === '/lgpd'
    || normalized === '/cadastro-familia'
    || normalized.startsWith('/autorizacao-midia')
  );
};

const isBillingEnforceEnabled = () =>
  String(process.env.EXPO_PUBLIC_BILLING_ENFORCE ?? '').trim().toLowerCase() === 'true';

const isIbepTenantCode = (code: string | null | undefined) =>
  (code ?? '').trim().toUpperCase() === 'IBEP';

/**
 * Sem assinatura: só bloqueia IBEP quando ENFORCE=true.
 * Assinatura inativa/vencida: bloqueia aquele tenant (quando há registro).
 * Outras igrejas sem plano NÃO são derrubadas ao trocar de instância.
 */
const shouldBlockForBilling = (
  billing: TenantBillingStatus,
  tenantCode: string | null
) => {
  if (!billing.billingConfigured || !billing.success || billing.accessAllowed) {
    return false;
  }

  if (billing.hasSubscription) {
    return true;
  }

  return isBillingEnforceEnabled() && isIbepTenantCode(tenantCode);
};

/**
 * Middleware de assinatura por tenant.
 * Fail-open se SQL ausente, se checagem SA falhar, ou se não for IBEP sem plano.
 */
export function AppBillingGate({ children }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [checking, setChecking] = useState(false);
  const redirectingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    redirectingRef.current = false;

    const run = async () => {
      if (isBillingExemptRoute(pathname)) {
        if (!cancelled) setChecking(false);
        return;
      }

      setChecking(true);
      try {
        const tenantId = await getStoredTenantId();
        if (!tenantId) {
          return;
        }

        const branding = await getStoredActiveIgrejaBranding();
        const tenantCode = branding?.code ?? null;

        let isSa = false;
        try {
          isSa = await checkSessionIsSuperAdmin();
        } catch {
          // Fail-open: erro na checagem SA não pode pagar a app.
          return;
        }

        if (isSa) {
          return;
        }

        const billing = await getTenantBillingStatus(tenantId);
        if (cancelled) return;

        if (shouldBlockForBilling(billing, tenantCode)) {
          redirectingRef.current = true;
          router.replace('/billing');
        }
      } finally {
        if (!cancelled) setChecking(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  if (isBillingExemptRoute(pathname)) {
    return <>{children}</>;
  }

  // Spinner só durante a checagem breve — nunca “prende” a UI após redirect.
  if (checking && !redirectingRef.current) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#1E40AF" />
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
});

import { getTenantBillingStatus } from '@/lib/billing/billingApi';
import type { TenantBillingStatus } from '@/lib/billing/types';
import { checkSessionIsSuperAdmin } from '@/lib/maintenanceAccessControlApi';
import { getStoredTenantId } from '@/lib/tenantSession';
import { usePathname, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

type Props = {
  children: React.ReactNode;
};

const normalizePathname = (pathname: string) => {
  const trimmed = pathname.replace(/\/+$/, '');
  return trimmed || '/';
};

/** Rotas liberadas sem assinatura ativa (login, billing, público). */
const isBillingExemptRoute = (pathname: string) => {
  const normalized = normalizePathname(pathname);
  return (
    normalized === '/'
    || normalized === '/index'
    || normalized === '/billing'
    || normalized === '/register'
    || normalized === '/forgot-password'
    || normalized === '/selecionar-igreja'
    || normalized === '/totem-checkin'
    || normalized === '/sessao-encerrada'
    || normalized === '/lgpd'
    || normalized === '/cadastro-familia'
    || normalized.startsWith('/autorizacao-midia')
  );
};

const isBillingEnforceEnabled = () =>
  String(process.env.EXPO_PUBLIC_BILLING_ENFORCE ?? '').trim().toLowerCase() === 'true';

const shouldBlockForBilling = (billing: TenantBillingStatus) => {
  if (!billing.billingConfigured || !billing.success || billing.accessAllowed) {
    return false;
  }

  // Já existe assinatura inativa/vencida → sempre bloqueia.
  if (billing.hasSubscription) {
    return true;
  }

  // Sem assinatura: só força em ambiente com EXPO_PUBLIC_BILLING_ENFORCE=true (IBEP).
  return isBillingEnforceEnabled();
};

/**
 * Middleware de assinatura: redireciona para /billing (BillingClass)
 * quando o tenant não tem plano active/trialing.
 * Fail-open se o SQL de billing ainda não foi instalado.
 */
export function AppBillingGate({ children }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (isBillingExemptRoute(pathname)) {
        if (!cancelled) {
          setChecking(false);
          setBlocked(false);
        }
        return;
      }

      setChecking(true);
      try {
        const tenantId = await getStoredTenantId();
        if (!tenantId) {
          if (!cancelled) {
            setBlocked(false);
          }
          return;
        }

        const [billing, isSa] = await Promise.all([
          getTenantBillingStatus(tenantId),
          checkSessionIsSuperAdmin().catch(() => false),
        ]);

        if (cancelled) return;

        const enforce = !isSa && shouldBlockForBilling(billing);
        setBlocked(enforce);
        if (enforce) {
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

  if (checking || blocked) {
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

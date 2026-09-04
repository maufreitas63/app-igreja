import { getTenantBillingStatus } from '@/lib/billing/billingApi';
import type { TenantBillingStatus } from '@/lib/billing/types';
import { checkSessionIsSuperAdmin } from '@/lib/maintenanceAccessControlApi';
import {
  getStoredActiveIgrejaBranding,
  getStoredTenantId,
  subscribeActiveTenantChange,
} from '@/lib/tenantSession';
import { usePathname, useRouter, type Href } from 'expo-router';
import React, { useEffect, useRef } from 'react';

type Props = {
  children: React.ReactNode;
};

type CacheEntry = {
  tenantId: string;
  billingAllow: boolean;
  instanceActive: boolean;
  checkedAt: number;
};

const CACHE_TTL_MS = 60_000;
let statusCache: CacheEntry | null = null;

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
    || normalized === '/maintenance-dashboard'
    || normalized.startsWith('/autorizacao-midia')
  );
};

/** Instância inativa: usuários comuns saem; super-admin e telas de sessão ficam. */
const isInstanceInactiveExemptRoute = (pathname: string) => {
  const normalized = normalizePathname(pathname);
  return (
    normalized === '/'
    || normalized === '/index'
    || normalized === '/register'
    || normalized === '/forgot-password'
    || normalized === '/selecionar-igreja'
    || normalized === '/igrejas'
    || normalized === '/totem-checkin'
    || normalized === '/sessao-encerrada'
    || normalized === '/lgpd'
    || normalized === '/cadastro-familia'
  );
};

const isBillingEnforceEnabled = () =>
  String(process.env.EXPO_PUBLIC_BILLING_ENFORCE ?? '').trim().toLowerCase() === 'true';

const isIbepTenantCode = (code: string | null | undefined) =>
  (code ?? '').trim().toUpperCase() === 'IBEP';

const shouldBlockForBilling = (
  billing: TenantBillingStatus,
  tenantCode: string | null
) => {
  if (!billing.billingConfigured || !billing.success || billing.accessAllowed) {
    return false;
  }

  // Assinatura existente porém inativa: só bloqueia se ENFORCE estiver ligado.
  if (billing.hasSubscription) {
    return isBillingEnforceEnabled();
  }

  // Sem assinatura: só IBEP + ENFORCE.
  return isBillingEnforceEnabled() && isIbepTenantCode(tenantCode);
};

const applyGateRedirect = (
  pathname: string,
  cache: CacheEntry,
  router: { replace: (href: Href) => void }
) => {
  if (!cache.instanceActive && !isInstanceInactiveExemptRoute(pathname)) {
    router.replace('/selecionar-igreja');
    return;
  }
  if (!cache.billingAllow && !isBillingExemptRoute(pathname)) {
    router.replace('/billing');
  }
};

/**
 * Middleware de assinatura e instância — nunca desmonta a UI.
 * Instância inativa: usuários comuns vão para selecionar igreja.
 * Paywall de plano: redireciona em background para /billing.
 */
export function AppBillingGate({ children }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const inflightRef = useRef(false);

  useEffect(() => {
    return subscribeActiveTenantChange(() => {
      statusCache = null;
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (inflightRef.current) {
        return;
      }

      const tenantId = await getStoredTenantId();
      if (!tenantId || cancelled) return;

      const now = Date.now();
      if (
        statusCache
        && statusCache.tenantId === tenantId
        && now - statusCache.checkedAt < CACHE_TTL_MS
      ) {
        applyGateRedirect(pathname, statusCache, router);
        return;
      }

      inflightRef.current = true;
      try {
        let isSa = false;
        try {
          isSa = await checkSessionIsSuperAdmin();
        } catch {
          statusCache = {
            tenantId,
            billingAllow: true,
            instanceActive: true,
            checkedAt: Date.now(),
          };
          return;
        }

        if (isSa) {
          statusCache = {
            tenantId,
            billingAllow: true,
            instanceActive: true,
            checkedAt: Date.now(),
          };
          return;
        }

        const branding = await getStoredActiveIgrejaBranding();
        const billing = await getTenantBillingStatus(tenantId);
        if (cancelled) return;

        const cache: CacheEntry = {
          tenantId,
          billingAllow: !shouldBlockForBilling(billing, branding?.code ?? null),
          instanceActive: billing.success ? billing.instanceActive !== false : true,
          checkedAt: Date.now(),
        };
        statusCache = cache;
        applyGateRedirect(pathname, cache, router);
      } finally {
        inflightRef.current = false;
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  // Sempre renderiza o app — sem spinner fullscreen.
  return <>{children}</>;
}

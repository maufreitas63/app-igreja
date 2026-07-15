import { getTenantBillingStatus } from '@/lib/billing/billingApi';
import type { TenantBillingStatus } from '@/lib/billing/types';
import { checkSessionIsSuperAdmin } from '@/lib/maintenanceAccessControlApi';
import {
  getStoredActiveIgrejaBranding,
  getStoredTenantId,
  subscribeActiveTenantChange,
} from '@/lib/tenantSession';
import { usePathname, useRouter } from 'expo-router';
import React, { useEffect, useRef } from 'react';

type Props = {
  children: React.ReactNode;
};

type CacheEntry = {
  tenantId: string;
  allow: boolean;
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

/**
 * Middleware de assinatura — nunca desmonta a UI (evita “derrubar” o app no menu).
 * Se o paywall for necessário, redireciona em background para /billing.
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
      // Paywall desligado → não faz RPC (menu permanece fluido).
      if (!isBillingEnforceEnabled()) {
        return;
      }

      if (isBillingExemptRoute(pathname) || inflightRef.current) {
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
        if (!statusCache.allow && !isBillingExemptRoute(pathname)) {
          router.replace('/billing');
        }
        return;
      }

      inflightRef.current = true;
      try {
        let isSa = false;
        try {
          isSa = await checkSessionIsSuperAdmin();
        } catch {
          statusCache = { tenantId, allow: true, checkedAt: Date.now() };
          return;
        }

        if (isSa) {
          statusCache = { tenantId, allow: true, checkedAt: Date.now() };
          return;
        }

        const branding = await getStoredActiveIgrejaBranding();
        const billing = await getTenantBillingStatus(tenantId);
        if (cancelled) return;

        const allow = !shouldBlockForBilling(billing, branding?.code ?? null);
        statusCache = { tenantId, allow, checkedAt: Date.now() };

        if (!allow && !isBillingExemptRoute(pathname)) {
          router.replace('/billing');
        }
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

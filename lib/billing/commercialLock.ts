import type { TenantBillingStatus } from '@/lib/billing/types';
import type { AppDrawerModuleKey } from '@/lib/appDrawerMenu';

export const COMMERCIAL_LOCK_ALLOWED_MODULE: AppDrawerModuleKey = 'menu_billing';

const normalizePathname = (pathname: string) => {
  const trimmed = pathname.replace(/\/+$/, '');
  return trimmed || '/';
};

/** Rotas exclusivas da engrenagem — bloqueadas com gestão da instância fechada. */
const LOCKED_MANAGEMENT_PATHS = new Set([
  '/maintenance-dashboard',
  '/configuracao-salas',
  '/admin/orquestrador',
  '/igrejas',
  '/alianca-conecta-reino',
  '/alianca-indicados',
  '/conhecimento',
  '/livros-doados',
]);

export function hasValidPaidSaasContract(
  status: Pick<TenantBillingStatus, 'accessAllowed' | 'hasSignedContract'>
): boolean {
  return status.accessAllowed === true && status.hasSignedContract === true;
}

export function isTenantManagementOpen(
  status: Pick<TenantBillingStatus, 'managementUnlocked'>
): boolean {
  return status.managementUnlocked === true;
}

export function isCommercialLockedManagementPath(pathname: string): boolean {
  const normalized = normalizePathname(pathname);
  if (normalized === '/billing') {
    return false;
  }
  if (LOCKED_MANAGEMENT_PATHS.has(normalized)) {
    return true;
  }
  return normalized.startsWith('/maintenance-dashboard');
}

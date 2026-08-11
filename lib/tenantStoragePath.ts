import { getStoredTenantId } from '@/lib/tenantSession';

/**
 * Prefixa paths de Storage com o tenant ativo: `{tenant_id}/{relativePath}`.
 * Compatível com policies multi-tenant (legado sem prefixo continua legível via join).
 */
export async function withActiveTenantStoragePrefix(relativePath: string): Promise<string> {
  const cleaned = relativePath.replace(/^\/+/, '').trim();
  if (!cleaned) {
    throw new Error('Caminho de storage inválido.');
  }

  const tenantId = (await getStoredTenantId())?.trim() || null;
  if (!tenantId) {
    return cleaned;
  }

  if (cleaned.startsWith(`${tenantId}/`)) {
    return cleaned;
  }

  // Evita duplo prefixo se path legado/tenant já for um UUID de instância.
  const first = cleaned.split('/')[0] ?? '';
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(first)) {
    return cleaned;
  }

  return `${tenantId}/${cleaned}`;
}

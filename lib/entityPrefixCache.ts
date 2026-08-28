import { clearAppParameterCache } from '@/lib/appParameters';
import { PARM_ENTIDADE_PARAMETER } from '@/lib/entityPrefixCore';

type CachedPrefix = {
  tenantId: string | null;
  prefix: string;
};

let cachedEntityPrefix: CachedPrefix | null = null;
let inflightEntityPrefix: Promise<string> | null = null;
let entityPrefixGeneration = 0;

export function clearEntityPrefixCache(): void {
  cachedEntityPrefix = null;
  inflightEntityPrefix = null;
  entityPrefixGeneration += 1;
  clearAppParameterCache(PARM_ENTIDADE_PARAMETER);
  clearAppParameterCache('parm_entidade');
}

export function readCachedEntityPrefix(tenantId: string | null): string | null {
  if (cachedEntityPrefix && cachedEntityPrefix.tenantId === tenantId) {
    return cachedEntityPrefix.prefix;
  }

  return null;
}

export function getEntityPrefixInflight(): Promise<string> | null {
  return inflightEntityPrefix;
}

export function setEntityPrefixInflight(value: Promise<string> | null): void {
  inflightEntityPrefix = value;
}

export function getEntityPrefixGeneration(): number {
  return entityPrefixGeneration;
}

export function writeCachedEntityPrefix(tenantId: string | null, prefix: string): void {
  cachedEntityPrefix = { tenantId, prefix };
}

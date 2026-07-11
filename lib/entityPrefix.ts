import { clearAppParameterCache, getAppParameterValue } from '@/lib/appParameters';
import {
  buildFamilyId,
  buildKidsRoomBadgeLabel,
  buildKidsRoomLabel,
  buildNewFamilyRecordingHint,
  buildTeensRoomBadgeLabel,
  buildTeensRoomLabel,
  DEFAULT_ENTITY_PREFIX,
  DEFAULT_FAMILY_ID,
  FALLBACK_ENTITY_PREFIX,
  KIDS_ROOM_DISPLAY_LABEL,
  normalizeEntityPrefix,
  PARM_ENTIDADE_PARAMETER,
  resolveEntityPrefixOrFallback,
  TEENS_ROOM_DISPLAY_LABEL,
} from '@/lib/entityPrefixCore';
import { getStoredTenantId, resolveActiveIgrejaBranding } from '@/lib/tenantSession';

export {
  buildFamilyId,
  buildKidsRoomBadgeLabel,
  buildKidsRoomLabel,
  buildNewFamilyRecordingHint,
  buildTeensRoomBadgeLabel,
  buildTeensRoomLabel,
  DEFAULT_ENTITY_PREFIX,
  DEFAULT_FAMILY_ID,
  FALLBACK_ENTITY_PREFIX,
  KIDS_ROOM_DISPLAY_LABEL,
  normalizeEntityPrefix,
  PARM_ENTIDADE_PARAMETER,
  resolveEntityPrefixOrFallback,
  TEENS_ROOM_DISPLAY_LABEL,
};

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

export async function getEntityPrefix(): Promise<string> {
  const tenantId = await getStoredTenantId();

  if (cachedEntityPrefix && cachedEntityPrefix.tenantId === tenantId) {
    return cachedEntityPrefix.prefix;
  }

  if (inflightEntityPrefix) {
    return inflightEntityPrefix;
  }

  const generation = entityPrefixGeneration;

  inflightEntityPrefix = (async () => {
    try {
      // Prioriza o código da instância ativa (mesmo fonte do logo) para os selos.
      const branding = await resolveActiveIgrejaBranding();
      let prefix = '';
      if (branding && (!tenantId || branding.id === tenantId)) {
        prefix = normalizeEntityPrefix(branding.code);
      }

      if (!prefix) {
        let value = await getAppParameterValue(PARM_ENTIDADE_PARAMETER);
        if (!value?.trim()) {
          value = await getAppParameterValue('parm_entidade');
        }
        prefix = normalizeEntityPrefix(value);
      }

      const resolved = resolveEntityPrefixOrFallback(prefix);
      if (generation === entityPrefixGeneration) {
        cachedEntityPrefix = { tenantId, prefix: resolved };
      }
      return resolved;
    } catch (error) {
      console.error('Erro ao carregar prefixo da entidade:', error);
      try {
        const branding = await resolveActiveIgrejaBranding();
        const resolved = resolveEntityPrefixOrFallback(
          branding && (!tenantId || branding.id === tenantId) ? branding.code : null
        );
        if (generation === entityPrefixGeneration) {
          cachedEntityPrefix = { tenantId, prefix: resolved };
        }
        return resolved;
      } catch {
        const resolved = FALLBACK_ENTITY_PREFIX;
        if (generation === entityPrefixGeneration) {
          cachedEntityPrefix = { tenantId, prefix: resolved };
        }
        return resolved;
      }
    } finally {
      inflightEntityPrefix = null;
    }
  })();

  return inflightEntityPrefix;
}

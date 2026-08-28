import { getAppParameterValue } from '@/lib/appParameters';
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
import {
  getEntityPrefixGeneration,
  getEntityPrefixInflight,
  readCachedEntityPrefix,
  setEntityPrefixInflight,
  writeCachedEntityPrefix,
} from '@/lib/entityPrefixCache';
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

export { clearEntityPrefixCache } from '@/lib/entityPrefixCache';

export async function getEntityPrefix(): Promise<string> {
  const tenantId = await getStoredTenantId();
  const cached = readCachedEntityPrefix(tenantId);

  if (cached) {
    return cached;
  }

  const inflight = getEntityPrefixInflight();
  if (inflight) {
    return inflight;
  }

  const generation = getEntityPrefixGeneration();

  const nextInflight = (async () => {
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
      if (generation === getEntityPrefixGeneration()) {
        writeCachedEntityPrefix(tenantId, resolved);
      }
      return resolved;
    } catch (error) {
      console.error('Erro ao carregar prefixo da entidade:', error);
      try {
        const branding = await resolveActiveIgrejaBranding();
        const resolved = resolveEntityPrefixOrFallback(
          branding && (!tenantId || branding.id === tenantId) ? branding.code : null
        );
        if (generation === getEntityPrefixGeneration()) {
          writeCachedEntityPrefix(tenantId, resolved);
        }
        return resolved;
      } catch {
        const resolved = FALLBACK_ENTITY_PREFIX;
        if (generation === getEntityPrefixGeneration()) {
          writeCachedEntityPrefix(tenantId, resolved);
        }
        return resolved;
      }
    } finally {
      setEntityPrefixInflight(null);
    }
  })();

  setEntityPrefixInflight(nextInflight);
  return nextInflight;
}

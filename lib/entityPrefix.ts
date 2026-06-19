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
  KIDS_ROOM_DISPLAY_LABEL,
  normalizeEntityPrefix,
  PARM_ENTIDADE_PARAMETER,
  TEENS_ROOM_DISPLAY_LABEL,
} from '@/lib/entityPrefixCore';

export {
  buildFamilyId,
  buildKidsRoomBadgeLabel,
  buildKidsRoomLabel,
  buildNewFamilyRecordingHint,
  buildTeensRoomBadgeLabel,
  buildTeensRoomLabel,
  DEFAULT_ENTITY_PREFIX,
  DEFAULT_FAMILY_ID,
  KIDS_ROOM_DISPLAY_LABEL,
  normalizeEntityPrefix,
  PARM_ENTIDADE_PARAMETER,
  TEENS_ROOM_DISPLAY_LABEL,
};

let cachedEntityPrefix: string | null = null;
let inflightEntityPrefix: Promise<string> | null = null;

export function clearEntityPrefixCache(): void {
  cachedEntityPrefix = null;
  inflightEntityPrefix = null;
  clearAppParameterCache(PARM_ENTIDADE_PARAMETER);
  clearAppParameterCache('parm_entidade');
}

export async function getEntityPrefix(): Promise<string> {
  if (cachedEntityPrefix) {
    return cachedEntityPrefix;
  }

  if (inflightEntityPrefix) {
    return inflightEntityPrefix;
  }

  inflightEntityPrefix = (async () => {
    try {
      let value = await getAppParameterValue(PARM_ENTIDADE_PARAMETER);

      if (!value?.trim()) {
        value = await getAppParameterValue('parm_entidade');
      }

      cachedEntityPrefix = normalizeEntityPrefix(value);
      return cachedEntityPrefix;
    } catch (error) {
      console.error('Erro ao carregar Parm_entidade:', error);
      cachedEntityPrefix = DEFAULT_ENTITY_PREFIX;
      return cachedEntityPrefix;
    } finally {
      inflightEntityPrefix = null;
    }
  })();

  return inflightEntityPrefix;
}

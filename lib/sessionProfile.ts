import { invalidateAsyncCache } from '@/lib/asyncResultCache';
import { invalidateSessionProfileLoadCache } from '@/lib/loadSessionProfile';
import { resolveProfileIdByPhone } from '@/lib/resolveProfileByPhone';
import {
  getGhostEffectiveProfileId,
  isGhostModeActive,
} from '@/lib/ghostMode';
import {
  getStoredProfileId,
  getStoredUserPhone,
  persistProfileId,
  repairUserSessionReference,
} from '@/lib/userSession';

let cachedRealProfileId: string | null = null;
let cachedRealProfilePhone: string | null = null;

export function invalidateSessionProfileCache() {
  cachedRealProfileId = null;
  cachedRealProfilePhone = null;
  invalidateSessionProfileLoadCache();
  invalidateAsyncCache('maintenance:dashboard:access');
  invalidateAsyncCache('family_reception:pending');
  invalidateAsyncCache('session:super_admin');
  invalidateAsyncCache('operator:super_admin');
  invalidateAsyncCache('acl:');
  invalidateAsyncCache('dashboard:cards:');
  invalidateAsyncCache('dashboard:screens:');
  invalidateAsyncCache('profile:columns:');
}

/** Perfil autenticado real (ignora Modo Ghost). */
export async function resolveRealSessionProfileId(options?: { forceRefresh?: boolean }) {
  const phone = (await getStoredUserPhone())?.trim() || null;

  if (
    !options?.forceRefresh
    && cachedRealProfileId
    && cachedRealProfilePhone === phone
    && !isGhostModeActive()
  ) {
    return cachedRealProfileId;
  }

  if (phone) {
    const preferredProfileId = await resolveProfileIdByPhone(phone);

    if (preferredProfileId) {
      const storedProfileId = await getStoredProfileId();

      if (storedProfileId !== preferredProfileId) {
        await persistProfileId(preferredProfileId);
      }

      if (!isGhostModeActive()) {
        cachedRealProfileId = preferredProfileId;
        cachedRealProfilePhone = phone;
      }

      return preferredProfileId;
    }
  }

  let profileId = await getStoredProfileId();

  if (!profileId) {
    profileId = await repairUserSessionReference(phone);
  }

  if (!isGhostModeActive()) {
    cachedRealProfileId = profileId;
    cachedRealProfilePhone = phone;
  }

  return profileId;
}

/** Perfil efetivo para ACL/RLS (alvo do Modo Ghost, se ativo). */
export async function resolveEffectiveProfileId(options?: { forceRefresh?: boolean }) {
  const ghostProfileId = getGhostEffectiveProfileId();

  if (ghostProfileId) {
    return ghostProfileId;
  }

  return resolveRealSessionProfileId(options);
}

import {
  getStoredProfileId,
  getStoredSessionToken,
  getStoredUserPhone,
} from '@/lib/userSession';

/** Sessão autenticada: token emitido no login ou par telefone + profile_id (fallback legado). */
export async function hasStoredMemberSession(): Promise<boolean> {
  const token = (await getStoredSessionToken())?.trim();

  if (token) {
    return true;
  }

  const phone = (await getStoredUserPhone())?.trim();
  const profileId = (await getStoredProfileId())?.trim();

  return Boolean(phone && profileId);
}

/** @deprecated Use `hasStoredMemberSession` — mantido para compatibilidade. */
export async function hasStoredMemberSessionToken(): Promise<boolean> {
  return hasStoredMemberSession();
}

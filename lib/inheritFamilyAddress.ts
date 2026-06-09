import {
  hasAnyProfileAddress,
  pickProfileAddress,
  PROFILE_ADDRESS_FIELDS,
  PROFILE_ADDRESS_SELECT,
  type ProfileAddress,
} from '@/lib/profileAddress';
import { findProfileIdForMember, type MemberProfileInput } from '@/lib/memberProfiles';
import { buildPhoneDbQueryVariants } from '@/lib/phoneDbVariants';
import { supabase } from '@/lib/supabase';
import { getStoredProfileId } from '@/lib/userSession';

export type { ProfileAddress } from '@/lib/profileAddress';
export { PROFILE_ADDRESS_FIELDS, pickProfileAddress, hasAnyProfileAddress } from '@/lib/profileAddress';

/** Perfil (tabela `profiles`) de quem está aceitando o membro na família. */
export async function loadAcceptorProfileAddress(options: {
  profileId?: string | null;
  phone?: string | null;
  authUserId?: string | null;
}): Promise<ProfileAddress | null> {
  const profileId = options.profileId?.trim() || null;

  if (profileId) {
    const { data, error } = await supabase
      .from('profiles')
      .select(PROFILE_ADDRESS_SELECT)
      .eq('id', profileId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (data) {
      const address = pickProfileAddress(data as Record<string, unknown>);
      if (hasAnyProfileAddress(address)) {
        return address;
      }
    }
  }

  const phone = options.phone?.trim() || null;
  const phoneVariants = phone ? buildPhoneDbQueryVariants(phone) : [];

  if (phoneVariants.length) {
    const { data, error } = await supabase
      .from('profiles')
      .select(PROFILE_ADDRESS_SELECT)
      .in('phone', phoneVariants)
      .limit(1)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (data) {
      const address = pickProfileAddress(data as Record<string, unknown>);
      if (hasAnyProfileAddress(address)) {
        return address;
      }
    }
  }

  if (options.authUserId) {
    const { data, error } = await supabase
      .from('profiles')
      .select(PROFILE_ADDRESS_SELECT)
      .eq('auth_user_id', options.authUserId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (data) {
      const address = pickProfileAddress(data as Record<string, unknown>);
      if (hasAnyProfileAddress(address)) {
        return address;
      }
    }
  }

  const storedProfileId = (await getStoredProfileId())?.trim() || null;
  if (storedProfileId && storedProfileId !== profileId) {
    return loadAcceptorProfileAddress({ profileId: storedProfileId });
  }

  return null;
}

async function saveProfileAddressFieldViaRpc(
  profileId: string,
  field: (typeof PROFILE_ADDRESS_FIELDS)[number],
  value: string | null
) {
  const actorProfileId = (await getStoredProfileId()) ?? profileId;

  const rpcResult = await supabase.rpc('update_profile_field', {
    p_profile_id: profileId,
    p_field: field,
    p_value: value,
    p_actor_profile_id: actorProfileId,
  });

  if (rpcResult.error) {
    throw rpcResult.error;
  }

  if (!rpcResult.data) {
    throw new Error(`Não foi possível gravar ${field} em profiles.`);
  }
}

/** Persiste endereço herdado na tabela `profiles` (update direto ou RPC por campo). */
export async function saveInheritedAddressToProfile(profileId: string, address: ProfileAddress) {
  if (!hasAnyProfileAddress(address)) {
    return;
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(address)
    .eq('id', profileId)
    .select(PROFILE_ADDRESS_SELECT)
    .maybeSingle();

  if (!error && data) {
    return pickProfileAddress(data as Record<string, unknown>);
  }

  if (error) {
    const message = error.message?.toLowerCase() ?? '';

    if (
      !message.includes('permission')
      && !message.includes('policy')
      && !message.includes('42501')
      && !message.includes('row-level')
    ) {
      throw error;
    }
  }

  for (const field of PROFILE_ADDRESS_FIELDS) {
    await saveProfileAddressFieldViaRpc(profileId, field, address[field]);
  }

  const { data: refreshed, error: refreshError } = await supabase
    .from('profiles')
    .select(PROFILE_ADDRESS_SELECT)
    .eq('id', profileId)
    .maybeSingle();

  if (refreshError) {
    throw refreshError;
  }

  return refreshed ? pickProfileAddress(refreshed as Record<string, unknown>) : address;
}

/** Copia endereço do aceitador para o registro em `profiles` do membro aceito. */
export async function inheritFamilyAddressToAcceptedMember(
  acceptedMember: MemberProfileInput,
  options: {
    acceptorProfileId?: string | null;
    acceptorPhone?: string | null;
    acceptorAuthUserId?: string | null;
    acceptedProfileId?: string | null;
    inheritedAddress?: ProfileAddress | null;
  }
) {
  const acceptorAddress =
    options.inheritedAddress
    ?? (await loadAcceptorProfileAddress({
      profileId: options.acceptorProfileId,
      phone: options.acceptorPhone,
      authUserId: options.acceptorAuthUserId,
    }));

  if (!acceptorAddress || !hasAnyProfileAddress(acceptorAddress)) {
    return null;
  }

  const acceptedProfileId =
    options.acceptedProfileId ?? (await findProfileIdForMember(acceptedMember));

  if (!acceptedProfileId) {
    throw new Error(
      'Perfil do membro não encontrado em profiles. Confira se o membro possui telefone cadastrado.'
    );
  }

  return saveInheritedAddressToProfile(acceptedProfileId, acceptorAddress);
}

export async function resolveAcceptorAuthUserId() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user?.id ?? null;
}

export async function loadAcceptorAddressForFamilyScreen(options: {
  profileId?: string | null;
  phone?: string | null;
  authUserId?: string | null;
}) {
  return loadAcceptorProfileAddress(options);
}

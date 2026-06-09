import { formatCep, lookupViaCep, normalizeCepDigits } from '@/lib/geoMapGeocoding';
import { invalidateProfilesMapSnapshot } from '@/lib/profilesMapCache';
import { getStoredProfileId } from '@/lib/userSession';
import { supabase } from '@/lib/supabase';
import { isSupabaseRpcMissing } from '@/lib/supabaseRpc';

export type SyncProfileAddressInput = {
  cep: string;
  addressNumber?: string;
  addressComplement?: string;
};

const buildAddressRpcPayload = (
  profileId: string,
  actorProfileId: string,
  cepFormatted: string,
  viaCep: NonNullable<Awaited<ReturnType<typeof lookupViaCep>>>,
  input: SyncProfileAddressInput
) => ({
  p_profile_id: profileId,
  p_actor_profile_id: actorProfileId,
  p_cep: cepFormatted,
  p_address_street: viaCep.logradouro?.trim() || null,
  p_address_neighborhood: viaCep.bairro?.trim() || null,
  p_address_city: viaCep.localidade?.trim() || null,
  p_address_state: viaCep.uf?.trim() || null,
  p_address_number: input.addressNumber?.trim() || null,
  p_address_complement: input.addressComplement?.trim() || null,
});

export async function syncProfileAddressFromCep(profileId: string, input: SyncProfileAddressInput) {
  const actorProfileId = await getStoredProfileId();

  if (!actorProfileId) {
    throw new Error('Sessão inválida. Saia e entre novamente no aplicativo.');
  }

  const cepDigits = normalizeCepDigits(input.cep);

  if (!cepDigits) {
    throw new Error('Informe o CEP com 8 dígitos (ex.: 11677-042).');
  }

  const viaCep = await lookupViaCep(cepDigits);

  if (!viaCep) {
    throw new Error('CEP não encontrado na consulta ViaCEP.');
  }

  const rpcPayload = buildAddressRpcPayload(
    profileId,
    actorProfileId,
    formatCep(cepDigits),
    viaCep,
    input
  );

  let { data, error } = await supabase.rpc('sync_profile_address_from_cep', rpcPayload);

  if (error) {
    const message = (error.message ?? '').toLowerCase();

    if (isSupabaseRpcMissing(message, 'sync_profile_address_from_cep')) {
      ({ data, error } = await supabase.rpc('admin_sync_profile_address_from_cep', rpcPayload));
    }
  }

  if (error) {
    const message = (error.message ?? '').toLowerCase();

    if (
      isSupabaseRpcMissing(message, 'sync_profile_address_from_cep')
      || isSupabaseRpcMissing(message, 'admin_sync_profile_address_from_cep')
    ) {
      throw new Error(
        'Execute no Supabase: scripts/profiles-sync-address-from-cep-rpc.sql (ou profiles-admin-sync-address-from-cep.sql) e tente novamente.'
      );
    }

    throw new Error(error.message || 'Não foi possível gravar CEP e endereço no Supabase.');
  }

  if (!data) {
    throw new Error('Supabase não confirmou a gravação do endereço.');
  }

  await invalidateProfilesMapSnapshot();

  return data;
}

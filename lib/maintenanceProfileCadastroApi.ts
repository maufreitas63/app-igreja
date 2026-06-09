import { searchProfilesForScaleVolunteer } from '@/lib/maintenanceScaleVolunteersApi';
import {
  syncProfileAddressFromCep as syncProfileAddressFromCepRpc,
  type SyncProfileAddressInput,
} from '@/lib/syncProfileAddressFromCep';
import { supabase } from '@/lib/supabase';

export type ProfileCadastroPickerOption = {
  id: string;
  fullName: string;
  phone: string | null;
  memberCode: string | null;
};

export type ProfileCadastroRecord = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  cpf: string | null;
  birth_date: string | null;
  cep: string | null;
  address_street: string | null;
  address_number: string | null;
  address_complement: string | null;
  address_neighborhood: string | null;
  address_city: string | null;
  address_state: string | null;
};

export const PROFILE_CADASTRO_FIELD_META: Array<{
  key: keyof ProfileCadastroRecord;
  label: string;
  section: 'pessoal' | 'endereco';
}> = [
  { key: 'full_name', label: 'Nome completo', section: 'pessoal' },
  { key: 'phone', label: 'Telefone', section: 'pessoal' },
  { key: 'email', label: 'E-mail', section: 'pessoal' },
  { key: 'cpf', label: 'CPF', section: 'pessoal' },
  { key: 'birth_date', label: 'Nascimento', section: 'pessoal' },
  { key: 'cep', label: 'CEP', section: 'endereco' },
  { key: 'address_street', label: 'Rua', section: 'endereco' },
  { key: 'address_number', label: 'Número', section: 'endereco' },
  { key: 'address_complement', label: 'Complemento', section: 'endereco' },
  { key: 'address_neighborhood', label: 'Bairro', section: 'endereco' },
  { key: 'address_city', label: 'Cidade', section: 'endereco' },
  { key: 'address_state', label: 'Estado', section: 'endereco' },
];

const PROFILE_CADASTRO_SELECT =
  'id, full_name, phone, email, cpf, birth_date, cep, address_street, address_number, address_complement, address_neighborhood, address_city, address_state';

export async function searchProfilesForCadastroPicker(query: string) {
  return searchProfilesForScaleVolunteer(query);
}

export async function fetchProfileCadastro(profileId: string): Promise<ProfileCadastroRecord | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_CADASTRO_SELECT)
    .eq('id', profileId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data?.id) {
    return null;
  }

  return data as ProfileCadastroRecord;
}

export type { SyncProfileAddressInput } from '@/lib/syncProfileAddressFromCep';

export async function syncProfileAddressFromCep(
  profileId: string,
  input: SyncProfileAddressInput
) {
  const data = await syncProfileAddressFromCepRpc(profileId, input);

  const refreshed = await fetchProfileCadastro(profileId);

  if (refreshed) {
    return refreshed;
  }

  if (data && typeof data === 'object' && 'id' in (data as Record<string, unknown>)) {
    return data as ProfileCadastroRecord;
  }

  return null;
}

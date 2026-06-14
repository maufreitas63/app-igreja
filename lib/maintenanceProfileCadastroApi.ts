import {
  syncProfileAddressFromCep as syncProfileAddressFromCepRpc,
  type SyncProfileAddressInput,
} from '@/lib/syncProfileAddressFromCep';
import { supabase } from '@/lib/supabase';
import { isSupabaseRpcMissing } from '@/lib/supabaseRpc';
import { getStoredProfileId } from '@/lib/userSession';

export const DELETE_PROFILE_COMPLETE_SQL_HINT =
  'Execute no Supabase: scripts/delete-profile-complete-rpc.sql';

export const DELETE_PROFILE_COMPLETE_RPC_MISSING = 'DELETE_PROFILE_COMPLETE_RPC_MISSING';

export type ProfileCadastroPickerOption = {
  id: string;
  fullName: string;
  phone: string | null;
  memberCode: string | null;
  accessPin: string | null;
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

const mapProfileCadastroPickerRow = (row: Record<string, unknown>): ProfileCadastroPickerOption | null => {
  const id = String(row.id ?? '').trim();
  const fullName = String(row.full_name ?? '').trim();

  if (!id || !fullName) {
    return null;
  }

  const accessPinRaw = row.access_pin;

  return {
    id,
    fullName,
    phone: row.phone != null ? String(row.phone).trim() || null : null,
    memberCode:
      row.codigo_membro != null ? String(row.codigo_membro).trim() || null : null,
    accessPin:
      accessPinRaw != null && String(accessPinRaw).trim() !== ''
        ? String(accessPinRaw).trim()
        : null,
  };
};

export async function searchProfilesForCadastroPicker(query: string, limit = 25) {
  const normalized = query.trim();

  if (normalized.length < 2) {
    return [];
  }

  const pattern = `%${normalized.replace(/[%_]/g, '')}%`;

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, phone, codigo_membro, access_pin')
    .not('full_name', 'is', null)
    .neq('full_name', '')
    .ilike('full_name', pattern)
    .order('full_name', { ascending: true })
    .limit(limit);

  if (error) {
    throw error;
  }

  if (!Array.isArray(data)) {
    return [];
  }

  return data
    .map((row) => mapProfileCadastroPickerRow(row as Record<string, unknown>))
    .filter((row): row is ProfileCadastroPickerOption => row !== null);
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

export type DeleteProfileCompleteResult = {
  success: boolean;
  message: string;
};

export async function deleteProfileComplete(
  profileId: string
): Promise<DeleteProfileCompleteResult> {
  const actorProfileId = await getStoredProfileId();

  if (!actorProfileId) {
    return { success: false, message: 'Sessão inválida. Saia e entre novamente no aplicativo.' };
  }

  const { data, error } = await supabase.rpc('excluir_usuario_completo', {
    p_target_profile_id: profileId,
    p_actor_profile_id: actorProfileId,
  });

  if (error) {
    const message = (error.message ?? '').toLowerCase();

    if (isSupabaseRpcMissing(message, 'excluir_usuario_completo')) {
      return {
        success: false,
        message: DELETE_PROFILE_COMPLETE_SQL_HINT,
      };
    }

    throw error;
  }

  const parsed =
    data && typeof data === 'object' ? (data as Record<string, unknown>) : { success: false };

  return {
    success: parsed.success === true,
    message: String(parsed.message ?? 'Não foi possível excluir o usuário.'),
  };
}

import {
  syncProfileAddressFromCep as syncProfileAddressFromCepRpc,
  type SyncProfileAddressInput,
} from '@/lib/syncProfileAddressFromCep';
import { formatFullName } from '@/lib/fullName';
import { fetchProfileRowById } from '@/lib/profileRow';
import { checkSessionIsSuperAdmin } from '@/lib/maintenanceAccessControlApi';
import { supabase } from '@/lib/supabase';
import { coerceRpcBoolean, isSupabaseRpcMissing } from '@/lib/supabaseRpc';
import { resolveEffectiveProfileId } from '@/lib/sessionProfile';

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
  access_pin: string | null;
  /** Proteção aplicada: Gestor não tem visibilidade do Super Administrador */
  showAccessPin: boolean;
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

const PROFILE_CADASTRO_SELECT_BASE =
  'id, full_name, phone, email, cpf, birth_date, cep, address_street, address_number, address_complement, address_neighborhood, address_city, address_state';

const PROFILE_CADASTRO_SELECT_WITH_PIN = `${PROFILE_CADASTRO_SELECT_BASE}, access_pin`;

async function actorMayViewAccessPin() {
  return checkSessionIsSuperAdmin();
}

async function profileVisibleToActor(targetProfileId: string) {
  const actorProfileId = await resolveEffectiveProfileId();

  if (!actorProfileId) {
    return false;
  }

  const { data, error } = await supabase.rpc('profile_visible_to_access_actor', {
    p_actor_profile_id: actorProfileId,
    p_target_profile_id: targetProfileId,
  });

  if (error) {
    console.error('profile_visible_to_access_actor:', error);
    return false;
  }

  return coerceRpcBoolean(data);
}

const mapProfileCadastroPickerRow = (row: Record<string, unknown>): ProfileCadastroPickerOption | null => {
  const id = String(row.id ?? '').trim();
  const fullName = formatFullName(String(row.full_name ?? ''));

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

  const showAccessPin = await actorMayViewAccessPin();
  const { data, error } = await supabase
    .from('profiles')
    .select(showAccessPin ? 'id, full_name, phone, codigo_membro, access_pin' : 'id, full_name, phone, codigo_membro')
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

  const mapped = data
    .map((row) => mapProfileCadastroPickerRow(row as Record<string, unknown>))
    .filter((row): row is ProfileCadastroPickerOption => row !== null);

  if (showAccessPin) {
    return mapped;
  }

  // Proteção aplicada: Gestor não tem visibilidade do Super Administrador
  const visible = await Promise.all(
    mapped.map(async (row) => ((await profileVisibleToActor(row.id)) ? row : null))
  );

  return visible
    .filter((row): row is ProfileCadastroPickerOption => row !== null)
    .map((row) => ({ ...row, accessPin: null }));
}

export async function fetchProfileCadastro(profileId: string): Promise<ProfileCadastroRecord | null> {
  const visible = await profileVisibleToActor(profileId);

  if (!visible) {
    return null;
  }

  const showAccessPin = await actorMayViewAccessPin();
  const { data, error } = await fetchProfileRowById(
    profileId,
    showAccessPin ? PROFILE_CADASTRO_SELECT_WITH_PIN : PROFILE_CADASTRO_SELECT_BASE
  );

  if (error) {
    throw error;
  }

  if (!data?.id) {
    return null;
  }

  return {
    ...(data as ProfileCadastroRecord),
    full_name: formatFullName(data.full_name),
    access_pin: showAccessPin ? (data.access_pin ?? null) : null,
    showAccessPin,
  };
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
    const showAccessPin = await actorMayViewAccessPin();
    const record = data as ProfileCadastroRecord;

    return {
      ...record,
      access_pin: showAccessPin ? record.access_pin ?? null : null,
      showAccessPin,
    };
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
  const actorProfileId = await resolveEffectiveProfileId();

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

import { initialsFromFullName } from '@/lib/digitalIdCard';
import { supabase } from '@/lib/supabase';
import { isSupabaseRpcMissingError } from '@/lib/supabaseRpc';
import { formatBrazilPhoneInput } from '@/lib/inputMasks';

export const PROFILE_SERVICES_SQL_HINT =
  'O cartão de serviço ainda não está disponível neste ambiente.';

export const SERVICE_CATEGORIES = [
  { value: 'beleza', label: 'Beleza e estética' },
  { value: 'saude', label: 'Saúde e bem-estar' },
  { value: 'educacao', label: 'Aulas e educação' },
  { value: 'manutencao', label: 'Reformas e manutenção' },
  { value: 'alimentacao', label: 'Alimentação' },
  { value: 'tecnologia', label: 'Tecnologia' },
  { value: 'juridico', label: 'Jurídico e contábil' },
  { value: 'artes', label: 'Artes e eventos' },
  { value: 'transporte', label: 'Transporte' },
  { value: 'outros', label: 'Outros' },
] as const;

export type ServiceCategoria = (typeof SERVICE_CATEGORIES)[number]['value'];

export const SERVICE_CATEGORIA_LABEL: Record<ServiceCategoria, string> = Object.fromEntries(
  SERVICE_CATEGORIES.map((item) => [item.value, item.label])
) as Record<ServiceCategoria, string>;

export type ProfileServiceCard = {
  id: string;
  profileId: string;
  fullName: string;
  email: string | null;
  tituloServico: string;
  descricaoServico: string;
  categoria: ServiceCategoria;
  telefoneContato: string | null;
  selfieUrl: string | null;
};

export type MyProfileService = {
  id: string | null;
  profileId: string;
  fullName: string;
  email: string | null;
  tituloServico: string;
  descricaoServico: string;
  categoria: ServiceCategoria;
  statusAtivo: boolean;
  telefoneContato: string;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

const readString = (value: unknown): string => String(value ?? '').trim();

const parseCategoria = (value: unknown): ServiceCategoria => {
  const raw = readString(value).toLowerCase();
  return SERVICE_CATEGORIES.some((item) => item.value === raw)
    ? (raw as ServiceCategoria)
    : 'outros';
};

const throwIfMissing = (error: { message?: string }, name: string) => {
  if (isSupabaseRpcMissingError(error, name)) {
    throw new Error(PROFILE_SERVICES_SQL_HINT);
  }
};

const mapCard = (item: unknown): ProfileServiceCard | null => {
  const row = asRecord(item);
  const id = readString(row.id);
  const profileId = readString(row.profile_id);
  const tituloServico = readString(row.titulo_servico);

  if (!id || !profileId || !tituloServico) {
    return null;
  }

  const email = readString(row.email);
  const phone = readString(row.telefone_contato);
  const selfie = readString(row.selfie_url);

  return {
    id,
    profileId,
    fullName: readString(row.full_name) || 'Membro',
    email: email || null,
    tituloServico,
    descricaoServico: readString(row.descricao_servico),
    categoria: parseCategoria(row.categoria),
    telefoneContato: phone || null,
    selfieUrl: selfie || null,
  };
};

export function serviceCardInitials(fullName: string) {
  return initialsFromFullName(fullName);
}

export function formatServicePhoneDisplay(phone: string | null | undefined) {
  const raw = readString(phone);
  return raw ? formatBrazilPhoneInput(raw) : '';
}

export async function fetchMyProfileService(): Promise<MyProfileService | null> {
  const { data, error } = await supabase.rpc('get_my_profile_service');

  if (error) {
    throwIfMissing(error, 'get_my_profile_service');
    throw new Error(error.message || 'Não foi possível carregar o serviço.');
  }

  const payload = asRecord(data);

  if (payload.success === false) {
    throw new Error(readString(payload.message) || 'Não foi possível carregar o serviço.');
  }

  const service = asRecord(payload.service);
  const profileId = readString(service.profile_id);

  if (!profileId) {
    return null;
  }

  return {
    id: readString(service.id) || null,
    profileId,
    fullName: readString(service.full_name),
    email: readString(service.email) || null,
    tituloServico: readString(service.titulo_servico),
    descricaoServico: readString(service.descricao_servico),
    categoria: parseCategoria(service.categoria),
    statusAtivo: service.status_ativo === true,
    telefoneContato: readString(service.telefone_contato),
  };
}

export async function saveMyProfileService(input: {
  tituloServico: string;
  descricaoServico: string;
  categoria: ServiceCategoria;
  statusAtivo: boolean;
  telefoneContato: string;
}) {
  const { data, error } = await supabase.rpc('upsert_my_profile_service', {
    p_titulo_servico: input.tituloServico,
    p_descricao_servico: input.descricaoServico,
    p_categoria: input.categoria,
    p_status_ativo: input.statusAtivo,
    p_telefone_contato: input.telefoneContato,
  });

  if (error) {
    throwIfMissing(error, 'upsert_my_profile_service');
    throw new Error(error.message || 'Não foi possível salvar o serviço.');
  }

  const payload = asRecord(data);

  return {
    success: payload.success === true,
    message: readString(payload.message) || (payload.success === true ? 'Serviço salvo.' : 'Falha ao salvar.'),
    id: readString(payload.id) || null,
  };
}

export async function fetchProfileServicesMural(): Promise<ProfileServiceCard[]> {
  const { data, error } = await supabase.rpc('list_profile_services_mural');

  if (error) {
    throwIfMissing(error, 'list_profile_services_mural');
    throw new Error(error.message || 'Não foi possível carregar os serviços do mural.');
  }

  const rows = Array.isArray(data) ? data : [];
  return rows.map(mapCard).filter((row): row is ProfileServiceCard => row !== null);
}

export async function fetchProfileServiceMuralDetail(id: string): Promise<ProfileServiceCard> {
  const { data, error } = await supabase.rpc('get_profile_service_mural', { p_id: id });

  if (error) {
    throwIfMissing(error, 'get_profile_service_mural');
    throw new Error(error.message || 'Não foi possível abrir o cartão.');
  }

  const payload = asRecord(data);

  if (payload.success !== true) {
    throw new Error(readString(payload.message) || 'Serviço não encontrado nesta igreja.');
  }

  const card = mapCard(payload.service);

  if (!card) {
    throw new Error('Serviço não encontrado nesta igreja.');
  }

  return card;
}

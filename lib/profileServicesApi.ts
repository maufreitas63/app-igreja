import { initialsFromFullName } from '@/lib/digitalIdCard';
import { supabase } from '@/lib/supabase';
import { isSupabaseRpcMissingError } from '@/lib/supabaseRpc';
import { formatBrazilPhoneInput } from '@/lib/inputMasks';

export const PROFILE_SERVICES_SQL_HINT =
  'O Apoio Mútuo ainda não está disponível neste ambiente.';

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
  paginaWeb: string | null;
  instagram: string | null;
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
  paginaWeb: string;
  instagram: string;
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
  const website = normalizeServiceWebsite(readString(row.pagina_web));
  const instagram = normalizeServiceInstagram(readString(row.instagram));
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
    paginaWeb: website || null,
    instagram: instagram || null,
    selfieUrl: selfie || null,
  };
};

export function normalizeServiceWebsite(value: string | null | undefined) {
  const raw = readString(value);

  if (!raw) {
    return '';
  }

  if (/^(javascript|data|vbscript):/i.test(raw)) {
    return '';
  }

  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }

  if (raw.startsWith('//')) {
    return `https:${raw}`;
  }

  return `https://${raw.replace(/^\/+/, '')}`;
}

export function normalizeServiceInstagram(value: string | null | undefined) {
  let raw = readString(value);

  if (!raw) {
    return '';
  }

  raw = raw.replace(/^https?:\/\/(www\.)?instagram\.com\//i, '');
  raw = raw.replace(/^@+/, '');
  raw = raw.split(/[/?#]/)[0]?.trim() ?? '';
  raw = raw.replace(/[^A-Za-z0-9._]/g, '');
  return raw.slice(0, 30);
}

export function formatServiceWebsiteDisplay(url: string | null | undefined) {
  return normalizeServiceWebsite(url);
}

export function formatServiceInstagramHandle(value: string | null | undefined) {
  return normalizeServiceInstagram(value);
}

export function instagramProfileUrl(value: string | null | undefined) {
  const handle = normalizeServiceInstagram(value);
  return handle ? `https://www.instagram.com/${handle}` : '';
}

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
    paginaWeb: normalizeServiceWebsite(readString(service.pagina_web)),
    instagram: normalizeServiceInstagram(readString(service.instagram)),
  };
}

export async function saveMyProfileService(input: {
  tituloServico: string;
  descricaoServico: string;
  categoria: ServiceCategoria;
  statusAtivo: boolean;
  telefoneContato: string;
  paginaWeb: string;
  instagram: string;
}) {
  const { data, error } = await supabase.rpc('upsert_my_profile_service', {
    p_titulo_servico: input.tituloServico,
    p_descricao_servico: input.descricaoServico,
    p_categoria: input.categoria,
    p_status_ativo: input.statusAtivo,
    p_telefone_contato: input.telefoneContato,
    p_pagina_web: normalizeServiceWebsite(input.paginaWeb),
    p_instagram: normalizeServiceInstagram(input.instagram),
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

export async function deleteMyProfileService() {
  const { data, error } = await supabase.rpc('delete_my_profile_service');

  if (error) {
    throwIfMissing(error, 'delete_my_profile_service');
    throw new Error(error.message || 'Não foi possível excluir a oferta.');
  }

  const payload = asRecord(data);

  return {
    success: payload.success === true,
    message: readString(payload.message) || (payload.success === true ? 'Oferta excluída.' : 'Falha ao excluir.'),
  };
}

const asRpcList = (value: unknown): unknown[] => {
  if (Array.isArray(value)) {
    return value;
  }

  if (value && typeof value === 'object') {
    return [value];
  }

  return [];
};

export async function fetchProfileServicesMural(): Promise<ProfileServiceCard[]> {
  const { data, error } = await supabase.rpc('list_profile_services_mural');

  if (error) {
    throwIfMissing(error, 'list_profile_services_mural');
    throw new Error(error.message || 'Não foi possível carregar os serviços do Apoio Mútuo.');
  }

  return asRpcList(data).map(mapCard).filter((row): row is ProfileServiceCard => row !== null);
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

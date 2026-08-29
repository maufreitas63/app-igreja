/**
 * Mural de Generosidade Coletiva.
 * SQL: scripts/generosity-mural-schema.sql
 */

import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import { isSupabaseRpcMissingError } from '@/lib/supabaseRpc';
import { withActiveTenantStoragePrefix } from '@/lib/tenantStoragePath';

export const GENEROSITY_SQL_HINT =
  'O Mural de Generosidade ainda não está disponível neste ambiente.';

export const GENEROSITY_MEDIA_BUCKET = 'generosity-media';

export const GENEROSITY_TIPOS = ['doacao', 'pedido'] as const;
export type GenerosityTipo = (typeof GENEROSITY_TIPOS)[number];

export const GENEROSITY_CATEGORIAS = [
  'moveis',
  'saude_equipamentos',
  'vestuario',
  'livros',
  'outros',
] as const;
export type GenerosityCategoria = (typeof GENEROSITY_CATEGORIAS)[number];

export const GENEROSITY_STATUS = ['pendente', 'ativo', 'concluido', 'rejeitado'] as const;
export type GenerosityStatus = (typeof GENEROSITY_STATUS)[number];

export const GENEROSITY_TIPO_LABEL: Record<GenerosityTipo, string> = {
  doacao: 'Doação',
  pedido: 'Pedido de apoio',
};

export const GENEROSITY_CATEGORIA_LABEL: Record<GenerosityCategoria, string> = {
  moveis: 'Móveis',
  saude_equipamentos: 'Equipamentos de saúde',
  vestuario: 'Vestuário',
  livros: 'Livros',
  outros: 'Outros',
};

export const GENEROSITY_STATUS_LABEL: Record<GenerosityStatus, string> = {
  pendente: 'Em moderação',
  ativo: 'Publicado',
  concluido: 'Resolvido',
  rejeitado: 'Não publicado',
};

export type GenerosityPost = {
  id: string;
  tipo: GenerosityTipo;
  categoria: GenerosityCategoria;
  titulo: string;
  descricao: string;
  fotoUrl: string | null;
  fotoSignedUrl: string | null;
  status: GenerosityStatus;
  createdAt: string;
  isMine: boolean;
  myInterest: string | null;
  interestsCount?: number;
  authorName?: string | null;
  authorPhone?: string | null;
};

export type GenerosityInterestAdmin = {
  id: string;
  postId: string;
  postTitulo: string;
  postTipo: GenerosityTipo;
  status: string;
  createdAt: string;
  authorName: string;
  authorPhone: string | null;
  interestedName: string;
  interestedPhone: string | null;
};

export type GenerosityNotice = {
  id: string;
  postId: string | null;
  title: string;
  body: string;
  createdAt: string;
};

const throwIfMissing = (error: { message?: string; code?: string }, fn: string) => {
  if (isSupabaseRpcMissingError(error, fn)) {
    throw new Error(GENEROSITY_SQL_HINT);
  }
  throw error;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const parseTipo = (value: unknown): GenerosityTipo | null => {
  const tipo = String(value ?? '').trim();
  return GENEROSITY_TIPOS.includes(tipo as GenerosityTipo) ? (tipo as GenerosityTipo) : null;
};

const parseCategoria = (value: unknown): GenerosityCategoria | null => {
  const categoria = String(value ?? '').trim();
  return GENEROSITY_CATEGORIAS.includes(categoria as GenerosityCategoria)
    ? (categoria as GenerosityCategoria)
    : null;
};

const parseStatus = (value: unknown): GenerosityStatus | null => {
  const status = String(value ?? '').trim();
  return GENEROSITY_STATUS.includes(status as GenerosityStatus)
    ? (status as GenerosityStatus)
    : null;
};

async function signPhoto(path: string | null): Promise<string | null> {
  if (!path) {
    return null;
  }

  const { data, error } = await supabase.storage
    .from(GENEROSITY_MEDIA_BUCKET)
    .createSignedUrl(path, 60 * 60);

  if (error || !data?.signedUrl) {
    return null;
  }

  return data.signedUrl;
}

const parsePost = async (row: Record<string, unknown>): Promise<GenerosityPost | null> => {
  const id = String(row.id ?? '').trim();
  const tipo = parseTipo(row.tipo);
  const categoria = parseCategoria(row.categoria);
  const status = parseStatus(row.status);
  const titulo = String(row.titulo ?? '').trim();

  if (!id || !tipo || !categoria || !status || !titulo) {
    return null;
  }

  const fotoUrl = row.foto_url ? String(row.foto_url) : null;

  return {
    id,
    tipo,
    categoria,
    titulo,
    descricao: String(row.descricao ?? ''),
    fotoUrl,
    fotoSignedUrl: await signPhoto(fotoUrl),
    status,
    createdAt: String(row.created_at ?? ''),
    isMine: row.is_mine === true,
    myInterest: row.my_interest ? String(row.my_interest) : null,
    interestsCount:
      row.interests_count != null && Number.isFinite(Number(row.interests_count))
        ? Number(row.interests_count)
        : undefined,
    authorName: row.author_name ? String(row.author_name) : null,
    authorPhone: row.author_phone ? String(row.author_phone) : null,
  };
};

async function rpcPayload(fn: string, args?: Record<string, unknown>) {
  const { data, error } = await supabase.rpc(fn, args ?? {});

  if (error) {
    throwIfMissing(error, fn);
  }

  return asRecord(data);
}

export async function listGenerosityPosts(tipo?: GenerosityTipo | null) {
  const payload = await rpcPayload('list_generosity_posts', {
    p_tipo: tipo ?? null,
  });

  if (payload.success !== true) {
    throw new Error(String(payload.message ?? 'Não foi possível carregar o mural.'));
  }

  const rows = Array.isArray(payload.posts) ? payload.posts : [];
  const parsed = await Promise.all(
    rows.map((entry) => parsePost(asRecord(entry)))
  );

  return parsed.filter((entry): entry is GenerosityPost => entry !== null);
}

export async function listMyGenerosityPosts() {
  const payload = await rpcPayload('list_my_generosity_posts');

  if (payload.success !== true) {
    throw new Error(String(payload.message ?? 'Não foi possível carregar seus anúncios.'));
  }

  const rows = Array.isArray(payload.posts) ? payload.posts : [];
  const parsed = await Promise.all(rows.map((entry) => parsePost(asRecord(entry))));

  return parsed.filter((entry): entry is GenerosityPost => entry !== null);
}

export async function createGenerosityPost(input: {
  tipo: GenerosityTipo;
  categoria: GenerosityCategoria;
  titulo: string;
  descricao: string;
  imageInput?: string | null;
}) {
  const payload = await rpcPayload('create_generosity_post', {
    p_tipo: input.tipo,
    p_categoria: input.categoria,
    p_titulo: input.titulo,
    p_descricao: input.descricao,
  });

  if (payload.success !== true) {
    throw new Error(String(payload.message ?? 'Não foi possível enviar o anúncio.'));
  }

  const id = String(payload.id ?? '').trim();

  if (id && input.imageInput) {
    await uploadGenerosityPostPhoto(id, input.imageInput);
  }

  return {
    id,
    message: String(payload.message ?? 'Enviado para moderação.'),
  };
}

export async function expressGenerosityInterest(postId: string) {
  const payload = await rpcPayload('express_generosity_interest', {
    p_post_id: postId,
  });

  return {
    success: payload.success === true,
    message: String(payload.message ?? 'Não foi possível registrar o interesse.'),
  };
}

export async function completeGenerosityPost(postId: string) {
  const payload = await rpcPayload('complete_generosity_post', {
    p_post_id: postId,
  });

  return {
    success: payload.success === true,
    message: String(payload.message ?? 'Não foi possível encerrar o anúncio.'),
  };
}

export async function listGenerosityModerationQueue(
  status: GenerosityStatus | 'todos' = 'pendente'
) {
  const payload = await rpcPayload('list_generosity_moderation_queue', {
    p_status: status,
  });

  if (payload.success !== true) {
    throw new Error(String(payload.message ?? 'Não foi possível carregar a fila.'));
  }

  const rows = Array.isArray(payload.posts) ? payload.posts : [];
  const parsed = await Promise.all(rows.map((entry) => parsePost(asRecord(entry))));

  return parsed.filter((entry): entry is GenerosityPost => entry !== null);
}

export async function moderateGenerosityPost(
  postId: string,
  action: 'aprovar' | 'rejeitar' | 'concluir'
) {
  const payload = await rpcPayload('moderate_generosity_post', {
    p_post_id: postId,
    p_action: action,
  });

  return {
    success: payload.success === true,
    message: String(payload.message ?? 'Não foi possível atualizar o anúncio.'),
  };
}

export async function listGenerosityInterestsAdmin() {
  const payload = await rpcPayload('list_generosity_interests_admin');

  if (payload.success !== true) {
    throw new Error(String(payload.message ?? 'Não foi possível carregar os interesses.'));
  }

  const rows = Array.isArray(payload.interests) ? payload.interests : [];

  return rows
    .map((entry) => {
      const row = asRecord(entry);
      const id = String(row.id ?? '').trim();
      const postId = String(row.post_id ?? '').trim();
      const tipo = parseTipo(row.post_tipo);

      if (!id || !postId || !tipo) {
        return null;
      }

      return {
        id,
        postId,
        postTitulo: String(row.post_titulo ?? ''),
        postTipo: tipo,
        status: String(row.status ?? ''),
        createdAt: String(row.created_at ?? ''),
        authorName: String(row.author_name ?? 'Autor'),
        authorPhone: row.author_phone ? String(row.author_phone) : null,
        interestedName: String(row.interested_name ?? 'Membro'),
        interestedPhone: row.interested_phone ? String(row.interested_phone) : null,
      } satisfies GenerosityInterestAdmin;
    })
    .filter((entry): entry is GenerosityInterestAdmin => entry !== null);
}

export async function acceptGenerosityInterest(interestId: string) {
  const payload = await rpcPayload('accept_generosity_interest', {
    p_interest_id: interestId,
  });

  return {
    success: payload.success === true,
    message: String(payload.message ?? 'Não foi possível aceitar o interesse.'),
  };
}

export async function fetchUnreadGenerosityNotices(): Promise<GenerosityNotice[]> {
  try {
    const { data, error } = await supabase.rpc('list_unread_generosity_notices');

    if (error) {
      if (isSupabaseRpcMissingError(error, 'list_unread_generosity_notices')) {
        return [];
      }
      throw error;
    }

    const rows = Array.isArray(data) ? data : [];

    return rows
      .map((entry) => {
        const row = asRecord(entry);
        const id = String(row.id ?? '').trim();

        if (!id) {
          return null;
        }

        return {
          id,
          postId: row.post_id ? String(row.post_id) : null,
          title: String(row.title ?? 'Mural de Generosidade'),
          body: String(row.body ?? ''),
          createdAt: String(row.created_at ?? ''),
        } satisfies GenerosityNotice;
      })
      .filter((entry): entry is GenerosityNotice => entry !== null);
  } catch {
    return [];
  }
}

export async function markGenerosityNoticesRead() {
  try {
    await supabase.rpc('mark_generosity_notices_read');
  } catch {
    // Aviso da home não deve quebrar o mural.
  }
}

const parseImageInput = async (imageInput: string) => {
  let base64: string | null = null;
  let contentType = 'image/jpeg';
  let fileExtension = 'jpg';

  if (imageInput.startsWith('data:')) {
    const base64SeparatorIndex = imageInput.indexOf('base64,');
    const mimeMatch = imageInput.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,/);

    if (mimeMatch?.[1]) {
      contentType = mimeMatch[1];
      if (contentType.includes('png')) {
        fileExtension = 'png';
      } else if (contentType.includes('webp')) {
        fileExtension = 'webp';
      }
    }

    if (base64SeparatorIndex >= 0) {
      base64 = imageInput.slice(base64SeparatorIndex + 'base64,'.length);
    }
  } else {
    base64 = await FileSystem.readAsStringAsync(imageInput, { encoding: 'base64' });
  }

  if (!base64) {
    throw new Error('Não foi possível processar a imagem.');
  }

  return { base64, contentType, fileExtension };
};

export async function pickGenerosityImage(): Promise<string | null> {
  if (Platform.OS === 'web') {
    if (typeof document === 'undefined' || typeof FileReader === 'undefined') {
      throw new Error('A seleção de imagem não está disponível neste navegador.');
    }

    return new Promise<string | null>((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/jpeg,image/png,image/webp';

      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) {
          resolve(null);
          return;
        }

        if (file.size > 3 * 1024 * 1024) {
          reject(new Error('A foto deve ter no máximo 3 MB.'));
          return;
        }

        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result !== 'string') {
            reject(new Error('Não foi possível processar a imagem.'));
            return;
          }
          resolve(reader.result);
        };
        reader.onerror = () => reject(new Error('Não foi possível carregar a imagem.'));
        reader.readAsDataURL(file);
      };

      input.click();
    });
  }

  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Permita o acesso à galeria para anexar a foto.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.55,
    allowsEditing: false,
    exif: false,
  });

  if (result.canceled || !result.assets?.[0]?.uri) {
    return null;
  }

  return result.assets[0].uri;
}

async function uploadGenerosityPostPhoto(postId: string, imageInput: string) {
  const parsed = await parseImageInput(imageInput);
  const storagePath = await withActiveTenantStoragePrefix(
    `${postId}/${Date.now()}.${parsed.fileExtension}`
  );

  const { error: uploadError } = await supabase.storage
    .from(GENEROSITY_MEDIA_BUCKET)
    .upload(storagePath, decode(parsed.base64), {
      contentType: parsed.contentType,
      upsert: false,
    });

  if (uploadError) {
    throw uploadError;
  }

  const payload = await rpcPayload('set_generosity_post_photo', {
    p_post_id: postId,
    p_path: storagePath,
  });

  if (payload.success !== true) {
    throw new Error(String(payload.message ?? 'Não foi possível anexar a foto.'));
  }
}

import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import { isSupabaseRpcMissingError } from '@/lib/supabaseRpc';
import { supabase } from '@/lib/supabase';

export const CHURCH_LOGOS_BUCKET = 'church-logos';

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
      } else if (contentType.includes('gif')) {
        fileExtension = 'gif';
      }
    }

    if (base64SeparatorIndex >= 0) {
      base64 = imageInput.slice(base64SeparatorIndex + 'base64,'.length);
    }
  } else {
    base64 = await FileSystem.readAsStringAsync(imageInput, { encoding: 'base64' });
  }

  if (!base64) {
    throw new Error('Não foi possível processar a imagem do logo.');
  }

  return { base64, contentType, fileExtension };
};

/** Seleciona imagem da galeria (web: file input; nativo: ImagePicker). */
export async function pickChurchLogoFromGallery(): Promise<string | null> {
  if (Platform.OS === 'web') {
    if (typeof document === 'undefined' || typeof FileReader === 'undefined') {
      throw new Error('A seleção de imagem não está disponível neste navegador.');
    }

    return new Promise<string | null>((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/png,image/jpeg,image/webp,image/gif';

      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) {
          resolve(null);
          return;
        }

        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result !== 'string') {
            reject(new Error('Não foi possível processar a imagem selecionada.'));
            return;
          }
          resolve(reader.result);
        };
        reader.onerror = () => {
          reject(new Error('Não foi possível carregar a imagem selecionada.'));
        };
        reader.readAsDataURL(file);
      };

      input.click();
    });
  }

  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Permita o acesso à galeria para escolher o logo.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.9,
    allowsEditing: false,
  });

  if (result.canceled || !result.assets?.[0]?.uri) {
    return null;
  }

  return result.assets[0].uri;
}

export function buildChurchLogoStoragePath(tenantId: string, fileExtension: string) {
  return `${tenantId.trim()}/logo.${fileExtension}`;
}

/** Envia o logo para o bucket público e devolve a URL pública. */
export async function uploadChurchLogoImage(tenantId: string, imageInput: string): Promise<string> {
  const id = tenantId.trim();
  if (!id) {
    throw new Error('Igreja inválida para upload do logo.');
  }

  const { base64, contentType, fileExtension } = await parseImageInput(imageInput);
  const storagePath = buildChurchLogoStoragePath(id, fileExtension);

  const { error } = await supabase.storage.from(CHURCH_LOGOS_BUCKET).upload(storagePath, decode(base64), {
    contentType,
    upsert: true,
  });

  if (error) {
    const message = (error.message ?? '').toLowerCase();
    if (message.includes('bucket') && message.includes('not found')) {
      throw new Error(
        'Bucket church-logos ausente. Execute scripts/multi-tenant-13-igreja-logo-storage.sql.'
      );
    }
    throw error;
  }

  const { data } = supabase.storage.from(CHURCH_LOGOS_BUCKET).getPublicUrl(storagePath);
  const publicUrl = data?.publicUrl?.trim();
  if (!publicUrl) {
    throw new Error('Upload ok, mas a URL pública do logo não foi gerada.');
  }

  // Cache-bust para o chrome atualizar após upsert
  return `${publicUrl}${publicUrl.includes('?') ? '&' : '?'}v=${Date.now()}`;
}

export async function setIgrejaLogoAdmin(tenantId: string, logoUrl: string | null) {
  const { data, error } = await supabase.rpc('set_igreja_logo_admin', {
    p_tenant_id: tenantId.trim(),
    p_logo_url: logoUrl,
  });

  if (error) {
    if (isSupabaseRpcMissingError(error, 'set_igreja_logo_admin')) {
      return {
        success: false as const,
        message:
          'RPC ausente. Execute scripts/multi-tenant-13-igreja-logo-storage.sql no Supabase.',
      };
    }
    return {
      success: false as const,
      message: error.message?.trim() || 'Não foi possível salvar o logo.',
    };
  }

  return data as {
    success?: boolean;
    message?: string;
    logo_url?: string | null;
  };
}

/** Upload + grava logo_url na igreja. */
export async function saveChurchLogoForTenant(tenantId: string, imageInput: string) {
  const publicUrl = await uploadChurchLogoImage(tenantId, imageInput);
  const result = await setIgrejaLogoAdmin(tenantId, publicUrl);
  if (!result?.success) {
    throw new Error(result?.message || 'Não foi possível gravar o logo da igreja.');
  }
  return typeof result.logo_url === 'string' ? result.logo_url : publicUrl;
}

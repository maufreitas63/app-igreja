import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '@/lib/supabase';

const SELFIE_BUCKET = 'Selfies';

const appendCacheBuster = (url: string) => {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}t=${Date.now()}`;
};

export async function pickSelfieFromWeb() {
  if (typeof document === 'undefined' || typeof FileReader === 'undefined') {
    throw new Error('A captura de selfie nao esta disponivel neste navegador.');
  }

  return new Promise<string | null>((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.setAttribute('capture', 'user');

    input.onchange = () => {
      const file = input.files?.[0];

      if (!file) {
        resolve(null);
        return;
      }

      const reader = new FileReader();

      reader.onload = () => {
        if (typeof reader.result !== 'string') {
          reject(new Error('Nao foi possivel processar a selfie selecionada.'));
          return;
        }

        resolve(reader.result);
      };

      reader.onerror = () => {
        reject(new Error('Nao foi possivel carregar a selfie selecionada.'));
      };

      reader.readAsDataURL(file);
    };

    input.click();
  });
}

export async function uploadSelfieInput(photo: string) {
  let base64: string | null = null;
  let contentType = 'image/jpeg';
  let fileExtension = 'jpg';

  if (photo.startsWith('data:')) {
    const base64SeparatorIndex = photo.indexOf('base64,');
    const mimeMatch = photo.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,/);

    if (mimeMatch?.[1]) {
      contentType = mimeMatch[1];
      if (contentType.includes('png')) {
        fileExtension = 'png';
      } else if (contentType.includes('webp')) {
        fileExtension = 'webp';
      }
    }

    if (base64SeparatorIndex >= 0) {
      base64 = photo.slice(base64SeparatorIndex + 'base64,'.length);
    }
  } else {
    base64 = await FileSystem.readAsStringAsync(photo, { encoding: 'base64' });
  }

  if (!base64) {
    throw new Error('Nao foi possivel processar a selfie informada.');
  }

  const fileName = `selfie_${Date.now()}.${fileExtension}`;
  const { error } = await supabase.storage.from(SELFIE_BUCKET).upload(fileName, decode(base64), { contentType });

  if (error) {
    throw error;
  }

  return fileName;
}

const parsePictureSize = (size: string) => {
  const match = size.match(/^(\d+)x(\d+)$/i);
  if (!match) {
    return null;
  }

  const width = Number.parseInt(match[1], 10);
  const height = Number.parseInt(match[2], 10);

  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }

  return { width, height };
};

export function selectSelfiePictureSize(availableSizes: string[]) {
  const sizes = availableSizes
    .map((size) => ({ raw: size, parsed: parsePictureSize(size) }))
    .filter((entry) => entry.parsed !== null)
    .map((entry) => ({ raw: entry.raw, width: entry.parsed!.width, height: entry.parsed!.height }));

  if (!sizes.length) {
    return null;
  }

  const fourByThreeSizes = sizes
    .filter((size) => {
      const longer = Math.max(size.width, size.height);
      const shorter = Math.min(size.width, size.height);
      return Math.abs(longer / shorter - 4 / 3) < 0.02;
    })
    .sort((left, right) => (right.width * right.height) - (left.width * left.height));

  return fourByThreeSizes[0]?.raw ?? sizes[0].raw;
}

export function resolveSelfieStorageFileName(selfieValue: string | null | undefined) {
  const normalized = selfieValue?.trim();

  if (!normalized || /^data:/i.test(normalized)) {
    return null;
  }

  if (/^https?:/i.test(normalized)) {
    try {
      const url = new URL(normalized);
      const pathParts = url.pathname.split('/').filter(Boolean);
      const bucketIndex = pathParts.findIndex((part) => part.toLowerCase() === SELFIE_BUCKET.toLowerCase());

      if (bucketIndex >= 0 && pathParts[bucketIndex + 1]) {
        return decodeURIComponent(pathParts.slice(bucketIndex + 1).join('/'));
      }

      const lastPart = pathParts[pathParts.length - 1];
      return lastPart ? decodeURIComponent(lastPart) : null;
    } catch {
      return null;
    }
  }

  return normalized.replace(new RegExp(`^${SELFIE_BUCKET}/`, 'i'), '');
}

export function hasExistingSelfieRecord(
  selfieValue: string | null | undefined,
  previewUrl?: string | null
) {
  if (previewUrl?.trim()) {
    return true;
  }

  return Boolean(resolveSelfieStorageFileName(selfieValue) || selfieValue?.trim());
}

export function isStoredSelfieFileName(selfieValue: string | null | undefined) {
  return Boolean(resolveSelfieStorageFileName(selfieValue));
}

export async function deleteSelfieFile(selfieValue: string | null | undefined) {
  const fileName = resolveSelfieStorageFileName(selfieValue);

  if (!fileName) {
    return;
  }

  const { error } = await supabase.storage.from(SELFIE_BUCKET).remove([fileName]);

  if (error) {
    throw error;
  }
}

export async function resolveSelfiePreviewUrl(selfieValue: string | null | undefined) {
  if (!selfieValue) {
    return null;
  }

  if (/^data:/i.test(selfieValue)) {
    return selfieValue;
  }

  if (/^https?:/i.test(selfieValue)) {
    return appendCacheBuster(selfieValue);
  }

  const signedUrlResult = await supabase.storage.from(SELFIE_BUCKET).createSignedUrl(selfieValue, 3600);
  if (!signedUrlResult.error && signedUrlResult.data?.signedUrl) {
    return appendCacheBuster(signedUrlResult.data.signedUrl);
  }

  const publicUrlResult = supabase.storage.from(SELFIE_BUCKET).getPublicUrl(selfieValue);
  return publicUrlResult.data.publicUrl ? appendCacheBuster(publicUrlResult.data.publicUrl) : null;
}

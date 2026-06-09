import { decode } from 'base64-arraybuffer';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

export const FINANCIAL_DOCS_BUCKET = 'financial-docs';
export const FINANCIAL_RECEIPT_SIGNED_URL_TTL_SECONDS = 60;

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
    throw new Error('Não foi possível processar a imagem do comprovante.');
  }

  return { base64, contentType, fileExtension };
};

export const buildFinancialReceiptStoragePath = (financialId: string, fileExtension = 'jpg') =>
  `receipts/${financialId}/${Date.now()}.${fileExtension}`;

export const buildExpenseReportReceiptStoragePath = (
  reportId: string,
  itemId: string,
  fileExtension = 'jpg'
) => `receipts/rd/${reportId}/${itemId}/${Date.now()}.${fileExtension}`;

export const resolveFinancialReceiptStoragePath = (receiptUrl: string | null | undefined) => {
  const normalized = receiptUrl?.trim();

  if (!normalized) {
    return null;
  }

  if (/^https?:/i.test(normalized)) {
    try {
      const url = new URL(normalized);
      const pathParts = url.pathname.split('/').filter(Boolean);
      const bucketIndex = pathParts.findIndex(
        (part) => part.toLowerCase() === FINANCIAL_DOCS_BUCKET.toLowerCase()
      );

      if (bucketIndex >= 0 && pathParts[bucketIndex + 1]) {
        return decodeURIComponent(pathParts.slice(bucketIndex + 1).join('/'));
      }
    } catch {
      return null;
    }
  }

  return normalized.replace(new RegExp(`^${FINANCIAL_DOCS_BUCKET}/`, 'i'), '');
};

export async function pickFinancialReceiptFromGallery(): Promise<string | null> {
  if (Platform.OS === 'web') {
    if (typeof document === 'undefined' || typeof FileReader === 'undefined') {
      throw new Error('A seleção de imagem não está disponível neste navegador.');
    }

    return new Promise<string | null>((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';

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
    throw new Error('Permita o acesso à galeria para anexar o comprovante.');
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

export async function pasteFinancialReceiptFromClipboard(): Promise<string | null> {
  const clipboardImage = await Clipboard.getImageAsync({
    format: 'jpeg',
    jpegQuality: 0.9,
  });

  return clipboardImage?.data ?? null;
}

export async function uploadExpenseReportReceiptImage(
  reportId: string,
  itemId: string,
  imageInput: string
) {
  const { base64, contentType, fileExtension } = await parseImageInput(imageInput);
  const storagePath = buildExpenseReportReceiptStoragePath(reportId, itemId, fileExtension);

  const { error } = await supabase.storage
    .from(FINANCIAL_DOCS_BUCKET)
    .upload(storagePath, decode(base64), {
      contentType,
      upsert: false,
    });

  if (error) {
    throw error;
  }

  return storagePath;
}

export async function uploadFinancialReceiptImage(financialId: string, imageInput: string) {
  const { base64, contentType, fileExtension } = await parseImageInput(imageInput);
  const storagePath = buildFinancialReceiptStoragePath(financialId, fileExtension);

  const { error } = await supabase.storage
    .from(FINANCIAL_DOCS_BUCKET)
    .upload(storagePath, decode(base64), {
      contentType,
      upsert: false,
    });

  if (error) {
    throw error;
  }

  return storagePath;
}

export async function deleteFinancialReceiptFile(receiptUrl: string | null | undefined) {
  const storagePath = resolveFinancialReceiptStoragePath(receiptUrl);

  if (!storagePath) {
    return;
  }

  const { error } = await supabase.storage.from(FINANCIAL_DOCS_BUCKET).remove([storagePath]);

  if (error) {
    throw error;
  }
}

export async function createFinancialReceiptSignedUrl(receiptUrl: string | null | undefined) {
  const storagePath = resolveFinancialReceiptStoragePath(receiptUrl);

  if (!storagePath) {
    return null;
  }

  const { data, error } = await supabase.storage
    .from(FINANCIAL_DOCS_BUCKET)
    .createSignedUrl(storagePath, FINANCIAL_RECEIPT_SIGNED_URL_TTL_SECONDS);

  if (error) {
    throw error;
  }

  return data?.signedUrl ?? null;
}

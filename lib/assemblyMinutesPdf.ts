import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

export type AssemblyMinutePdfInput = {
  base64: string;
  fileName: string;
  contentType: string;
};

const sanitizeFileName = (value: string) =>
  value.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_') || 'ata.pdf';

export const parseAssemblyMinutePdfInput = async (
  input: string,
  fileName?: string | null
): Promise<AssemblyMinutePdfInput> => {
  if (input.startsWith('data:')) {
    const base64SeparatorIndex = input.indexOf('base64,');
    const mimeMatch = input.match(/^data:([^;]+);base64,/);
    const contentType = mimeMatch?.[1]?.trim() || 'application/pdf';

    if (base64SeparatorIndex < 0) {
      throw new Error('Não foi possível processar o PDF selecionado.');
    }

    return {
      base64: input.slice(base64SeparatorIndex + 'base64,'.length),
      fileName: sanitizeFileName(fileName?.trim() || 'ata.pdf'),
      contentType,
    };
  }

  const base64 = await FileSystem.readAsStringAsync(input, { encoding: 'base64' });

  return {
    base64,
    fileName: sanitizeFileName(fileName?.trim() || 'ata.pdf'),
    contentType: 'application/pdf',
  };
};

export async function pickAssemblyMinutePdf(): Promise<AssemblyMinutePdfInput | null> {
  if (Platform.OS === 'web') {
    if (typeof document === 'undefined' || typeof FileReader === 'undefined') {
      throw new Error('A seleção de PDF não está disponível neste navegador.');
    }

    return new Promise<AssemblyMinutePdfInput | null>((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/pdf,.pdf';

      input.onchange = () => {
        const file = input.files?.[0];

        if (!file) {
          resolve(null);
          return;
        }

        if (file.type && file.type !== 'application/pdf') {
          reject(new Error('Selecione um arquivo PDF.'));
          return;
        }

        const reader = new FileReader();

        reader.onload = () => {
          if (typeof reader.result !== 'string') {
            reject(new Error('Não foi possível processar o PDF selecionado.'));
            return;
          }

          const base64SeparatorIndex = reader.result.indexOf('base64,');

          resolve({
            base64:
              base64SeparatorIndex >= 0
                ? reader.result.slice(base64SeparatorIndex + 'base64,'.length)
                : reader.result,
            fileName: sanitizeFileName(file.name || 'ata.pdf'),
            contentType: file.type || 'application/pdf',
          });
        };

        reader.onerror = () => {
          reject(new Error('Não foi possível carregar o PDF selecionado.'));
        };

        reader.readAsDataURL(file);
      };

      input.click();
    });
  }

  throw new Error('Envio de PDF de atas disponível na versão web (PWA).');
};

export const uploadAssemblyMinutePdfBytes = (base64: string, contentType: string) =>
  decode(base64);

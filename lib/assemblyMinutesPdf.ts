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

/** Título da ata = nome do arquivo sem extensão `.pdf`. */
export const titleFromAssemblyMinuteFileName = (fileName: string) => {
  const base = fileName.replace(/\\/g, '/').split('/').pop()?.trim() || fileName.trim();
  const withoutExtension = base.replace(/\.pdf$/i, '').trim();
  return withoutExtension || base || 'Ata';
};

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

const readPdfFileAsInput = (file: File): Promise<AssemblyMinutePdfInput> =>
  new Promise((resolve, reject) => {
    if (file.type && file.type !== 'application/pdf') {
      reject(new Error(`Arquivo inválido (não é PDF): ${file.name || 'sem nome'}`));
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error(`Não foi possível processar o PDF: ${file.name || 'sem nome'}`));
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
      reject(new Error(`Não foi possível carregar o PDF: ${file.name || 'sem nome'}`));
    };

    reader.readAsDataURL(file);
  });

/** Seleciona um ou mais PDFs (web). */
export async function pickAssemblyMinutePdfs(): Promise<AssemblyMinutePdfInput[] | null> {
  if (Platform.OS === 'web') {
    if (typeof document === 'undefined' || typeof FileReader === 'undefined') {
      throw new Error('A seleção de PDF não está disponível neste navegador.');
    }

    return new Promise<AssemblyMinutePdfInput[] | null>((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/pdf,.pdf';
      input.multiple = true;

      input.onchange = () => {
        const files = Array.from(input.files ?? []);

        if (!files.length) {
          resolve(null);
          return;
        }

        void (async () => {
          try {
            const pdfs = await Promise.all(files.map((file) => readPdfFileAsInput(file)));
            resolve(pdfs);
          } catch (error) {
            reject(error);
          }
        })();
      };

      input.click();
    });
  }

  throw new Error('Envio de PDF de atas disponível na versão web (PWA).');
}

export async function pickAssemblyMinutePdf(): Promise<AssemblyMinutePdfInput | null> {
  const pdfs = await pickAssemblyMinutePdfs();
  return pdfs?.[0] ?? null;
}

export const uploadAssemblyMinutePdfBytes = (base64: string, contentType: string) =>
  decode(base64);

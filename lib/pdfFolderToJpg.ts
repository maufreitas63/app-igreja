import { Platform } from 'react-native';

export type PdfFolderToJpgResult = {
  converted: string[];
  skippedExisting: string[];
  skippedEmpty: string[];
  errors: Array<{ fileName: string; error: string }>;
  pdfCount: number;
  pageCount: number;
};

export type PdfConversionFolderHandle = unknown;

export const isPdfFolderToJpgSupported = () =>
  Platform.OS === 'web' && typeof window !== 'undefined';

export async function pickPdfConversionFolder(): Promise<PdfConversionFolderHandle | null> {
  throw new Error(
    'Conversão PDF → JPG disponível apenas na versão web (Chrome ou Edge no desktop).'
  );
}

export async function convertPdfsInDirectory(
  _dirHandle: PdfConversionFolderHandle
): Promise<PdfFolderToJpgResult> {
  throw new Error(
    'Conversão PDF → JPG disponível apenas na versão web (Chrome ou Edge no desktop).'
  );
}

export async function convertPdfFolderToJpg(): Promise<PdfFolderToJpgResult | null> {
  throw new Error(
    'Conversão PDF → JPG disponível apenas na versão web (Chrome ou Edge no desktop).'
  );
}

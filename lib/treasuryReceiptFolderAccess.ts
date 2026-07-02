import { Platform } from 'react-native';

export type TreasuryReceiptFolderFile = {
  fileName: string;
  /** Chave referencia para localizar o lançamento: aaaammdd nnnn,nn.jpg */
  referencia: string;
  /** Posição 1–3 do anexo (padrão único = 1). */
  position: number;
  originalFileName?: string;
  readDataUrl: () => Promise<string>;
  markProcessed: () => Promise<void>;
};

export type TreasuryReceiptFolderAccess = {
  files: TreasuryReceiptFolderFile[];
  canRenameAfterUpload: boolean;
};

export const isTreasuryReceiptFolderAccessSupported = () =>
  Platform.OS === 'web' &&
  typeof window !== 'undefined' &&
  typeof window.showDirectoryPicker === 'function';

export async function pickTreasuryReceiptFolderFiles(): Promise<TreasuryReceiptFolderAccess | null> {
  throw new Error(
    'Processamento de pasta local disponível apenas na versão web (Chrome ou Edge no desktop).'
  );
}

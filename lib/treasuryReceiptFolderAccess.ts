import { Platform } from 'react-native';

export type TreasuryReceiptFolderFile = {
  fileName: string;
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

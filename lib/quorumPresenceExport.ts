import {
  buildQuorumPresenceDocxBase64,
  buildQuorumPresenceDocxFileName,
  type QuorumPresenceDocxInput,
} from '@/lib/quorumPresenceDocx';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const DOCX_BUILD_TIMEOUT_MS = 25000;

const withTimeout = <T>(promise: Promise<T>, timeoutMs: number, message: string) =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });

const writeQuorumPresenceDocxFile = async (input: QuorumPresenceDocxInput) => {
  const base64 = await withTimeout(
    buildQuorumPresenceDocxBase64(input),
    DOCX_BUILD_TIMEOUT_MS,
    'A geração do documento demorou demais. Tente novamente.'
  );

  const fileName = buildQuorumPresenceDocxFileName(input.eventName);
  const cacheDir = FileSystem.cacheDirectory;

  if (!cacheDir) {
    throw new Error('Armazenamento temporário indisponível neste dispositivo.');
  }

  const fileUri = `${cacheDir}${fileName}`;

  await FileSystem.writeAsStringAsync(fileUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return { fileUri, fileName };
};

/** Gera o .docx e abre o seletor de compartilhamento (escolha WhatsApp para anexar o arquivo). */
export async function exportQuorumPresenceDocxViaWhatsApp(input: QuorumPresenceDocxInput) {
  const { fileUri } = await writeQuorumPresenceDocxFile(input);

  const canShare = await Sharing.isAvailableAsync();

  if (!canShare) {
    if (Platform.OS === 'web') {
      throw new Error(
        'No navegador, use o aplicativo no celular para compartilhar o .docx pelo WhatsApp.'
      );
    }

    throw new Error('Compartilhamento de arquivos não está disponível neste dispositivo.');
  }

  await Sharing.shareAsync(fileUri, {
    mimeType: DOCX_MIME,
    dialogTitle: 'Enviar lista de presença pelo WhatsApp',
    UTI: 'com.microsoft.word.doc',
  });
}

import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

const JPG_MIME = 'image/jpeg';

export const buildQuorumPresenceImageFileName = (eventName: string) => {
  const slug = eventName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 48);

  const stamp = new Date().toISOString().slice(0, 10);
  return `lista-presenca-${slug || 'evento'}-${stamp}.jpg`;
};

/** Compartilha a imagem capturada (escolha WhatsApp no seletor do sistema). */
export async function shareQuorumPresenceImage(fileUri: string) {
  const canShare = await Sharing.isAvailableAsync();

  if (!canShare) {
    if (Platform.OS === 'web') {
      throw new Error(
        'No navegador, use o aplicativo no celular para compartilhar a imagem pelo WhatsApp.'
      );
    }

    throw new Error('Compartilhamento de imagens não está disponível neste dispositivo.');
  }

  await Sharing.shareAsync(fileUri, {
    mimeType: JPG_MIME,
    dialogTitle: 'Enviar lista de presença pelo WhatsApp',
    UTI: 'public.jpeg',
  });
}

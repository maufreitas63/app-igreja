import { normalizePhoneForWhatsApp } from '@/lib/whatsapp';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

export type ServiceVCardInput = {
  fullName: string;
  title: string;
  organization?: string | null;
  note?: string | null;
  phone: string | null;
  email: string | null;
  website?: string | null;
  instagram?: string | null;
};

const escapeVCard = (value: string) =>
  value
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\n|\r/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');

const splitName = (fullName: string) => {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return { family: '', given: '' };
  }

  if (parts.length === 1) {
    return { family: parts[0], given: '' };
  }

  return {
    given: parts[0],
    family: parts.slice(1).join(' '),
  };
};

const instagramContactUrl = (handle: string) => {
  const trimmed = handle.replace(/^@+/, '').trim();
  return trimmed ? `https://www.instagram.com/${trimmed}` : '';
};

/** vCard 3.0 — nome, profissão, telefone e redes sociais para a agenda. */
export function buildServiceVCard(input: ServiceVCardInput): string {
  const fullName = input.fullName.trim() || 'Contato';
  const { family, given } = splitName(fullName);
  const tel = normalizePhoneForWhatsApp(input.phone);
  const email = (input.email ?? '').trim();
  const title = input.title.trim();
  const organization = (input.organization ?? '').trim();
  const note = (input.note ?? '').trim();
  const website = (input.website ?? '').trim();
  const instagramUrl = instagramContactUrl(input.instagram ?? '');
  const whatsappUrl = tel ? `https://wa.me/${tel}` : '';

  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${escapeVCard(family)};${escapeVCard(given)};;;`,
    `FN:${escapeVCard(fullName)}`,
    organization ? `ORG:${escapeVCard(organization)}` : null,
    title ? `TITLE:${escapeVCard(title)}` : null,
    title ? `ROLE:${escapeVCard(title)}` : null,
    tel ? `TEL;TYPE=CELL,VOICE:+${tel}` : null,
    email ? `EMAIL;TYPE=INTERNET:${escapeVCard(email)}` : null,
    website ? `URL;TYPE=WORK:${escapeVCard(website)}` : null,
    whatsappUrl ? `item1.URL:${escapeVCard(whatsappUrl)}` : null,
    whatsappUrl ? 'item1.X-ABLabel:WhatsApp' : null,
    instagramUrl ? `X-SOCIALPROFILE;TYPE=instagram:${escapeVCard(instagramUrl)}` : null,
    instagramUrl ? `item2.URL:${escapeVCard(instagramUrl)}` : null,
    instagramUrl ? 'item2.X-ABLabel:Instagram' : null,
    note ? `NOTE:${escapeVCard(note)}` : null,
    'END:VCARD',
  ].filter((line): line is string => Boolean(line));

  return lines.join('\r\n');
}

export function serviceVCardFileName(fullName: string, title: string) {
  const raw = `${fullName}-${title}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `${raw || 'contato'}.vcf`;
}

function downloadVcfInBrowser(vcard: string, fileName: string): void {
  if (typeof document === 'undefined') {
    throw new Error('Download do contato indisponível neste ambiente.');
  }

  const blob = new Blob([vcard], { type: 'text/vcard;charset=utf-8' });
  const objectUrl = URL.createObjectURL(blob);
  const isiOS = /iPad|iPhone|iPod/.test(navigator.userAgent || '');

  if (isiOS) {
    window.open(objectUrl, '_blank', 'noopener,noreferrer');
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    return;
  }

  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000);
}

async function shareVcfNative(vcard: string, fileName: string): Promise<void> {
  const cacheDir = FileSystem.cacheDirectory;
  if (!cacheDir) {
    throw new Error('Armazenamento temporário indisponível neste dispositivo.');
  }

  const fileUri = `${cacheDir}${fileName}`;
  await FileSystem.writeAsStringAsync(fileUri, vcard, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('Compartilhamento de arquivos não está disponível neste dispositivo.');
  }

  await Sharing.shareAsync(fileUri, {
    mimeType: 'text/vcard',
    UTI: 'public.vcard',
    dialogTitle: 'Salvar contato',
  });
}

export async function downloadServiceVCard(input: ServiceVCardInput): Promise<void> {
  const vcard = buildServiceVCard(input);
  const fileName = serviceVCardFileName(input.fullName, input.title);

  if (Platform.OS === 'web') {
    downloadVcfInBrowser(vcard, fileName);
    return;
  }

  await shareVcfNative(vcard, fileName);
}

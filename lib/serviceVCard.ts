import { normalizePhoneForWhatsApp } from '@/lib/whatsapp';

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

/** vCard 3.0 — a câmera do celular oferece salvar o contato na agenda. */
export function buildServiceVCard(input: {
  fullName: string;
  title: string;
  phone: string | null;
  email: string | null;
}): string {
  const fullName = input.fullName.trim() || 'Contato';
  const { family, given } = splitName(fullName);
  const tel = normalizePhoneForWhatsApp(input.phone);
  const email = (input.email ?? '').trim();
  const title = input.title.trim();

  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${escapeVCard(family)};${escapeVCard(given)};;;`,
    `FN:${escapeVCard(fullName)}`,
    title ? `TITLE:${escapeVCard(title)}` : null,
    tel ? `TEL;TYPE=CELL,VOICE:+${tel}` : null,
    email ? `EMAIL;TYPE=INTERNET:${escapeVCard(email)}` : null,
    'END:VCARD',
  ].filter((line): line is string => Boolean(line));

  return lines.join('\r\n');
}

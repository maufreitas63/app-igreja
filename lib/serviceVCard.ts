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

const instagramContactUrl = (handle: string) => {
  const trimmed = handle.replace(/^@+/, '').trim();
  return trimmed ? `https://www.instagram.com/${trimmed}` : '';
};

/** vCard 3.0 — a câmera do celular oferece salvar o contato na agenda. */
export function buildServiceVCard(input: {
  fullName: string;
  title: string;
  organization?: string | null;
  note?: string | null;
  phone: string | null;
  email: string | null;
  website?: string | null;
  instagram?: string | null;
}): string {
  const fullName = input.fullName.trim() || 'Contato';
  const { family, given } = splitName(fullName);
  const tel = normalizePhoneForWhatsApp(input.phone);
  const email = (input.email ?? '').trim();
  const title = input.title.trim();
  const organization = (input.organization ?? '').trim();
  const note = (input.note ?? '').trim();
  const website = (input.website ?? '').trim();
  const instagramUrl = instagramContactUrl(input.instagram ?? '');

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
    instagramUrl ? `X-SOCIALPROFILE;TYPE=instagram:${escapeVCard(instagramUrl)}` : null,
    instagramUrl ? `item1.URL:${escapeVCard(instagramUrl)}` : null,
    instagramUrl ? 'item1.X-ABLabel:Instagram' : null,
    note ? `NOTE:${escapeVCard(note)}` : null,
    'END:VCARD',
  ].filter((line): line is string => Boolean(line));

  return lines.join('\r\n');
}

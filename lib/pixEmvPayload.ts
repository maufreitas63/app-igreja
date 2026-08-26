/**
 * Payload EMV do Pix Copia e Cola (BR Code) com CRC-16/CCITT.
 * Identificação de campanha continua pelos centavos; o txid fica estático (***).
 */

const PIX_GUI = 'br.gov.bcb.pix';
const DEFAULT_CITY = 'SAO PAULO';

function tlv(id: string, value: string): string {
  const len = String(value.length).padStart(2, '0');
  return `${id}${len}${value}`;
}

/** CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF) — vetor "123456789" = 29B1. */
export function crc16Ccitt(payload: string): string {
  let crc = 0xffff;

  for (let index = 0; index < payload.length; index += 1) {
    crc ^= payload.charCodeAt(index) << 8;

    for (let bit = 0; bit < 8; bit += 1) {
      if (crc & 0x8000) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc <<= 1;
      }

      crc &= 0xffff;
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function sanitizePixText(value: string, maxLength: number, fallback: string): string {
  const cleaned = value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^A-Za-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
    .slice(0, maxLength);

  return cleaned || fallback;
}

export function formatPixAmount(amount: number): string {
  return amount.toFixed(2);
}

export function campaignCentsDigits(centavosReferencia: number): number {
  const cents = Math.round((Number.isFinite(centavosReferencia) ? centavosReferencia : 0) * 100);
  return Math.max(1, Math.min(99, cents));
}

/** Inteiro em reais + sufixo simbólico (ex.: 100 + 0.60 = 100.60). */
export function composeCampaignDonationAmount(
  integerReais: number,
  centavosReferencia: number
): number {
  const whole = Math.max(0, Math.floor(Math.abs(Number.isFinite(integerReais) ? integerReais : 0)));
  return whole + campaignCentsDigits(centavosReferencia) / 100;
}

export function parseIntegerReaisInput(raw: string): string {
  const withoutFraction = raw.replace(/[.,].*$/, '');
  const digits = withoutFraction.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  return digits.slice(0, 7);
}

export type PixCopiaEColaInput = {
  pixKey: string;
  amount: number;
  merchantName: string;
  merchantCity?: string | null;
  description?: string | null;
};

export function buildPixCopiaECola(input: PixCopiaEColaInput): string | null {
  const pixKey = input.pixKey.trim();

  if (!pixKey || !Number.isFinite(input.amount) || input.amount <= 0) {
    return null;
  }

  const merchantAccount =
    tlv('00', PIX_GUI) +
    tlv('01', pixKey) +
    (input.description?.trim()
      ? tlv('02', sanitizePixText(input.description, 40, 'CAMPANHA'))
      : '');

  const payloadWithoutCrc =
    tlv('00', '01') +
    tlv('26', merchantAccount) +
    tlv('52', '0000') +
    tlv('53', '986') +
    tlv('54', formatPixAmount(input.amount)) +
    tlv('58', 'BR') +
    tlv('59', sanitizePixText(input.merchantName, 25, 'IGREJA')) +
    tlv('60', sanitizePixText(input.merchantCity ?? '', 15, DEFAULT_CITY)) +
    tlv('62', tlv('05', '***')) +
    '6304';

  return payloadWithoutCrc + crc16Ccitt(payloadWithoutCrc);
}

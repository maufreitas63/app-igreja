/**
 * Payload EMV do Pix Copia e Cola (BR Code estático) com CRC-16/CCITT.
 * Identificação de campanha continua pelos centavos; o txid fica estático (***).
 *
 * Campo 26 (Merchant Account) tem no máximo 99 caracteres (EMV). Descrição extra
 * só entra se couber — estouro gera length de 3 dígitos e o banco recusa o QR.
 */

const PIX_GUI = 'br.gov.bcb.pix';
const DEFAULT_CITY = 'SAO PAULO';
const MAX_EMV_VALUE_LEN = 99;

function tlv(id: string, value: string): string {
  if (value.length > MAX_EMV_VALUE_LEN) {
    throw new Error(`Campo EMV ${id} excede ${MAX_EMV_VALUE_LEN} caracteres.`);
  }

  return `${id}${String(value.length).padStart(2, '0')}${value}`;
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

/** Dígitos de centavos da direita para a esquerda: 1 → 0,01; 11 → 0,11; 111 → 1,11. */
export function parseBrlCentsDigits(raw: string, maxDigits = 9): string {
  return raw.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, maxDigits);
}

export function formatBrlCentsDigits(digits: string): string {
  if (!digits) {
    return '';
  }

  const padded = digits.padStart(3, '0');
  const cents = padded.slice(-2);
  const whole = padded.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${whole},${cents}`;
}

export function brlCentsDigitsToAmount(digits: string): number | null {
  if (!digits) {
    return null;
  }

  const value = Number.parseInt(digits, 10) / 100;
  return Number.isFinite(value) && value > 0 ? value : null;
}

const EVP_KEY_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Normaliza chave Pix (CPF/CNPJ sem máscara, e-mail, telefone +55, EVP). */
export function normalizePixKey(raw: string): string {
  const key = raw.replace(/\s+/g, ' ').trim();

  if (!key) {
    return '';
  }

  if (key.includes('@')) {
    return key.toLowerCase();
  }

  if (EVP_KEY_RE.test(key)) {
    return key.toLowerCase();
  }

  const digits = key.replace(/\D/g, '');

  if (key.startsWith('+') && digits.length >= 12) {
    return `+${digits}`;
  }

  if (digits.length === 14) {
    return digits;
  }

  if (digits.length === 11 && /[./-]/.test(key)) {
    return digits;
  }

  if (digits.length === 12 || digits.length === 13) {
    return digits.startsWith('55') ? `+${digits}` : `+55${digits}`;
  }

  return key;
}

function buildMerchantAccount(pixKey: string): string {
  return tlv('00', PIX_GUI) + tlv('01', pixKey);
}

export type PixCopiaEColaInput = {
  pixKey: string;
  amount: number;
  merchantName: string;
  merchantCity?: string | null;
  description?: string | null;
};

export function buildPixCopiaECola(input: PixCopiaEColaInput): string | null {
  const pixKey = normalizePixKey(input.pixKey);

  if (!pixKey || !Number.isFinite(input.amount) || input.amount <= 0) {
    return null;
  }

  try {
    const payloadWithoutCrc =
      tlv('00', '01') +
      tlv('01', '11') +
      tlv('26', buildMerchantAccount(pixKey)) +
      tlv('52', '0000') +
      tlv('53', '986') +
      tlv('54', formatPixAmount(input.amount)) +
      tlv('58', 'BR') +
      tlv('59', sanitizePixText(input.merchantName, 25, 'IGREJA')) +
      tlv('60', sanitizePixText(input.merchantCity ?? '', 15, DEFAULT_CITY)) +
      tlv('62', tlv('05', '***')) +
      '6304';

    const payload = payloadWithoutCrc + crc16Ccitt(payloadWithoutCrc);
    return isValidPixCopiaECola(payload) ? payload : null;
  } catch {
    return null;
  }
}

/** Confere TLV de 2 dígitos e CRC do payload gerado. */
export function isValidPixCopiaECola(payload: string): boolean {
  if (!payload.startsWith('000201') || !payload.includes('6304') || payload.length < 20) {
    return false;
  }

  const crcIndex = payload.lastIndexOf('6304');

  if (crcIndex < 0 || crcIndex + 8 !== payload.length) {
    return false;
  }

  const withoutCrc = payload.slice(0, crcIndex + 4);
  const crc = payload.slice(crcIndex + 4);

  if (crc16Ccitt(withoutCrc) !== crc) {
    return false;
  }

  let cursor = 0;

  while (cursor < crcIndex) {
    const id = payload.slice(cursor, cursor + 2);
    const lenText = payload.slice(cursor + 2, cursor + 4);
    const length = Number.parseInt(lenText, 10);

    if (!/^\d{2}$/.test(id) || !/^\d{2}$/.test(lenText) || !Number.isFinite(length) || length < 0) {
      return false;
    }

    cursor += 4 + length;
  }

  return cursor === crcIndex;
}

/**
 * Validação do gerador PIX EMV (CRC-16/CCITT-FALSE).
 * Uso: node scripts/test-pix-emv-payload.mjs
 */

function crc16Ccitt(payload) {
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

function tlv(id, value) {
  if (value.length > 99) {
    throw new Error(`Campo ${id} com ${value.length} caracteres`);
  }

  return `${id}${String(value.length).padStart(2, '0')}${value}`;
}

const crcVector = crc16Ccitt('123456789');
if (crcVector !== '29B1') {
  throw new Error(`CRC do vetor ISO falhou: ${crcVector}`);
}

const official =
  '00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***6304';
if (crc16Ccitt(official) !== '1D3D') {
  throw new Error(`CRC do exemplo Bacen falhou: ${crc16Ccitt(official)}`);
}

function buildMerchantAccount(pixKey) {
  return tlv('00', 'br.gov.bcb.pix') + tlv('01', pixKey);
}

const uuid = '123e4567-e89b-12d3-a456-426614174000';
const maiSafe = buildMerchantAccount(uuid);
if (maiSafe.length > 99) {
  throw new Error(`Campo 26 ainda estoura: ${maiSafe.length}`);
}

const amount = 100 + 60 / 100;
const payloadWithoutCrc =
  tlv('00', '01') +
  tlv('01', '11') +
  tlv('26', maiSafe) +
  tlv('52', '0000') +
  tlv('53', '986') +
  tlv('54', amount.toFixed(2)) +
  tlv('58', 'BR') +
  tlv('59', 'IGREJA TESTE') +
  tlv('60', 'SAO PAULO') +
  tlv('62', tlv('05', '***')) +
  '6304';

const payload = payloadWithoutCrc + crc16Ccitt(payloadWithoutCrc);

if (!payload.startsWith('000201010211')) {
  throw new Error(`QR estático sem 010211: ${payload}`);
}

if (!payload.includes('5406100.60')) {
  throw new Error(`Valor 100.60 não embutido: ${payload}`);
}

if (/260\d{2}.*020\d{2}REFORMA/.test(payload)) {
  throw new Error('Descrição não deve entrar no campo 26 do QR estático.');
}

if (!payload.endsWith(crc16Ccitt(payloadWithoutCrc))) {
  throw new Error('CRC16 do payload inconsistente.');
}

console.log('OK Pix Copia e Cola:', payload);

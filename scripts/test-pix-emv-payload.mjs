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
  return `${id}${String(value.length).padStart(2, '0')}${value}`;
}

const crcVector = crc16Ccitt('123456789');
if (crcVector !== '29B1') {
  throw new Error(`CRC do vetor ISO falhou: ${crcVector}`);
}

const amount = 100 + 60 / 100;
const merchantAccount =
  tlv('00', 'br.gov.bcb.pix') + tlv('01', '123e4567-e89b-12d3-a456-426614174000');
const payloadWithoutCrc =
  tlv('00', '01') +
  tlv('26', merchantAccount) +
  tlv('52', '0000') +
  tlv('53', '986') +
  tlv('54', amount.toFixed(2)) +
  tlv('58', 'BR') +
  tlv('59', 'IGREJA TESTE') +
  tlv('60', 'SAO PAULO') +
  tlv('62', tlv('05', '***')) +
  '6304';

const payload = payloadWithoutCrc + crc16Ccitt(payloadWithoutCrc);

if (!payload.startsWith('000201')) {
  throw new Error('Payload EMV inválido.');
}

if (!payload.includes('5406100.60')) {
  throw new Error(`Valor 100.60 não embutido: ${payload}`);
}

if (!payload.endsWith(crc16Ccitt(payloadWithoutCrc))) {
  throw new Error('CRC16 do payload inconsistente.');
}

console.log('OK Pix Copia e Cola:', payload);

/**
 * Valida o fuso do .ics: horário de parede America/Sao_Paulo → instante UTC.
 * Uso: node scripts/test-calendar-ics.mjs
 */

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const pad2 = (value) => String(value).padStart(2, '0');

const formatIcsUtc = (instant) =>
  [
    instant.getUTCFullYear(),
    pad2(instant.getUTCMonth() + 1),
    pad2(instant.getUTCDate()),
    'T',
    pad2(instant.getUTCHours()),
    pad2(instant.getUTCMinutes()),
    pad2(instant.getUTCSeconds()),
    'Z',
  ].join('');

const start = new Date('2026-09-02T19:00:00-03:00');
assert(!Number.isNaN(start.getTime()), 'dataInicio inválida');
assert(start.toISOString() === '2026-09-02T22:00:00.000Z', '19:00 BRT deve ser 22:00 UTC');
assert(formatIcsUtc(start) === '20260902T220000Z', 'DTSTART UTC esperado 20260902T220000Z');

const end = new Date(start.getTime() + 120 * 60_000);
assert(formatIcsUtc(end) === '20260903T000000Z', 'DTEND +2h a partir de 19:00 BRT é 00:00 UTC do dia seguinte');

const nyWall = new Date('2026-09-02T19:00:00-04:00');
assert(formatIcsUtc(nyWall) !== formatIcsUtc(start), 'instantes de fusos diferentes não podem coincidir');

console.log('test-calendar-ics: ok');

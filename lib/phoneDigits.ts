/** Extração de dígitos de telefone — módulo-folha para evitar ciclos de require. */

export const normalizePhoneDigits = (value: string | null | undefined) =>
  (value ?? '').replace(/\D/g, '');

/** Dígitos locais BR (DDD + número), sem prefixo 55. */
export const canonicalPhoneDigits = (value: string | null | undefined) => {
  let digits = normalizePhoneDigits(value);

  if (digits.startsWith('55') && digits.length >= 12) {
    digits = digits.slice(2);
  }

  if (digits.length > 11) {
    digits = digits.slice(-11);
  }

  return digits.length >= 10 ? digits : '';
};

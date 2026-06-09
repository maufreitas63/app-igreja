export const getPhoneDigitCount = (phone: string) => phone.replace(/\D/g, '').length;

/** Celular (11) ou fixo (10) com DDD — independente da máscara. */
export const isBrazilianPhoneComplete = (phone: string) => {
  const digits = getPhoneDigitCount(phone);
  return digits === 10 || digits === 11;
};

/** Celular brasileiro com DDD — exatamente 11 dígitos. */
export const isBrazilianMobilePhoneComplete = (phone: string) =>
  getPhoneDigitCount(phone) === 11;

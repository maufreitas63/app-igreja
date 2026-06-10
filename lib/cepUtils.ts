export const normalizeCepDigits = (cep: string | null | undefined) => {
  const digits = (cep ?? '').replace(/\D/g, '');
  if (digits.length !== 8) {
    return null;
  }
  return digits;
};

export const formatCep = (cepDigits: string) => `${cepDigits.slice(0, 5)}-${cepDigits.slice(5)}`;

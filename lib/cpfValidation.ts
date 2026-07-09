/** Remove caracteres não numéricos do CPF. */
export function normalizeCpfDigits(cpf: string | null | undefined): string {
  return (cpf ?? '').replace(/\D/g, '');
}

/** Formata CPF como 000.000.000-00 */
export function formatCpf(cpf: string | null | undefined): string {
  const digits = normalizeCpfDigits(cpf).slice(0, 11);

  if (digits.length <= 3) {
    return digits;
  }

  if (digits.length <= 6) {
    return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  }

  if (digits.length <= 9) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  }

  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
}

/** Valida dígitos verificadores do CPF (Módulo 11). */
export function validateCPF(cpf: string): boolean {
  const normalized = normalizeCpfDigits(cpf);

  if (normalized.length !== 11) {
    return false;
  }

  if (/^(\d)\1{10}$/.test(normalized)) {
    return false;
  }

  const digits = normalized.split('').map((value) => Number(value));

  let sum = 0;
  for (let index = 0; index < 9; index += 1) {
    sum += digits[index] * (10 - index);
  }

  let remainder = (sum * 10) % 11;
  if (remainder === 10) {
    remainder = 0;
  }

  if (remainder !== digits[9]) {
    return false;
  }

  sum = 0;
  for (let index = 0; index < 10; index += 1) {
    sum += digits[index] * (11 - index);
  }

  remainder = (sum * 10) % 11;
  if (remainder === 10) {
    remainder = 0;
  }

  return remainder === digits[10];
}

export function cpfValidationMessage(cpf: string): string | null {
  const normalized = normalizeCpfDigits(cpf);

  if (!normalized) {
    return 'Informe o CPF.';
  }

  if (normalized.length < 11) {
    return 'CPF incompleto.';
  }

  if (!validateCPF(normalized)) {
    return 'CPF inválido.';
  }

  return null;
}

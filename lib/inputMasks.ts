import { formatCep } from '@/lib/cepUtils';
import { formatPhoneDisplay } from '@/lib/familyRegistration';

/** Telefone BR — `(DD) NNNNN-NNNN` enquanto digita. */
export const formatBrazilPhoneInput = (value: string) => formatPhoneDisplay(value);

/** CEP — `NNNNN-NNN` enquanto digita. */
export const formatBrazilCepInput = (value: string) => {
  const cleaned = value.replace(/\D/g, '').slice(0, 8);

  if (cleaned.length <= 5) {
    return cleaned;
  }

  return formatCep(cleaned);
};

/** Data — `DD/MM/AAAA` (8 dígitos). */
export const formatBrazilDateInput = (value: string) => {
  const cleaned = value.replace(/\D/g, '').slice(0, 8);

  if (cleaned.length <= 2) {
    return cleaned;
  }

  if (cleaned.length <= 4) {
    return `${cleaned.slice(0, 2)}/${cleaned.slice(2)}`;
  }

  return `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}/${cleaned.slice(4)}`;
};

/** Data curta — `DD/MM/AA` (6 dígitos). */
export const formatBrazilDateShortInput = (value: string) => {
  const cleaned = value.replace(/\D/g, '').slice(0, 6);

  if (cleaned.length <= 2) {
    return cleaned;
  }

  if (cleaned.length <= 4) {
    return `${cleaned.slice(0, 2)}/${cleaned.slice(2)}`;
  }

  return `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}/${cleaned.slice(4, 6)}`;
};

/** Horário — `HH:MM` enquanto digita. */
export const formatBrazilTimeInput = (value: string) => {
  const cleaned = value.replace(/\D/g, '').slice(0, 4);

  if (cleaned.length <= 2) {
    return cleaned;
  }

  return `${cleaned.slice(0, 2)}:${cleaned.slice(2)}`;
};

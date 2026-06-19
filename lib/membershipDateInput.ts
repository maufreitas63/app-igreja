/** Máscara dd/mm/aa para data de filiação. */
export function formatMembershipDateInput(value: string): string {
  const cleaned = value.replace(/\D/g, '').slice(0, 6);

  if (cleaned.length <= 2) {
    return cleaned;
  }

  if (cleaned.length <= 4) {
    return `${cleaned.slice(0, 2)}/${cleaned.slice(2)}`;
  }

  return `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}/${cleaned.slice(4, 6)}`;
}

/** Converte ISO (YYYY-MM-DD) para dd/mm/aa. */
export function formatMembershipDateFromIso(value: string | null | undefined): string {
  const match = value?.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (!match) {
    return '';
  }

  const [, year, month, day] = match;
  return `${day}/${month}/${year.slice(2)}`;
}

/** Converte dd/mm/aa para ISO (YYYY-MM-DD) ou null se inválido. */
export function parseMembershipDateInputToIso(value: string): string | null {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const match = /^(\d{2})\/(\d{2})\/(\d{2})$/.exec(trimmed);

  if (!match) {
    return null;
  }

  const day = Number(match[1]);
  const month = Number(match[2]);
  const shortYear = Number(match[3]);
  const currentYear = new Date().getFullYear();
  let year = Math.floor(currentYear / 100) * 100 + shortYear;

  if (year > currentYear + 1) {
    year -= 100;
  }

  const date = new Date(year, month - 1, day);

  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

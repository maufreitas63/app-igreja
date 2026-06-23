/** Espelha `public.normalize_location_key()` em geo-checkin-automatic.sql */
export const normalizeLocationKey = (value: string | null | undefined) =>
  (value ?? '')
    .trim()
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

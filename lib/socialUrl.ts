/** Normaliza URL opcional: acrescenta https:// se faltar o esquema. */
export function normalizeOptionalHttpsUrl(raw: string | null | undefined): string | null {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) {
    return null;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  if (trimmed.startsWith('//')) {
    return `https:${trimmed}`;
  }

  return `https://${trimmed}`;
}

export function isValidOptionalHttpsUrl(raw: string | null | undefined): boolean {
  const normalized = normalizeOptionalHttpsUrl(raw);
  if (!normalized) {
    return true;
  }

  try {
    const parsed = new URL(normalized);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

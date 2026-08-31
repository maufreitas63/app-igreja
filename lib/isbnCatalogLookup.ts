export type IsbnCatalogHit = {
  found: true;
  isbn: string;
  titulo: string;
  autor: string;
  editora: string;
  ano: string;
  capa: string;
  source: 'google' | 'brasil-api' | 'open-library';
  message: string;
};

export type IsbnCatalogMiss = {
  found: false;
  isbn: string;
  quotaExceeded: boolean;
};

export type IsbnCatalogResult = IsbnCatalogHit | IsbnCatalogMiss;

const GOOGLE_BOOKS = 'https://www.googleapis.com/books/v1/volumes';
const BRASIL_API = 'https://brasilapi.com.br/api/isbn/v1';
const OPEN_LIBRARY = 'https://openlibrary.org/api/books';
const FETCH_MS = 10_000;

const SOURCE_MESSAGE: Record<IsbnCatalogHit['source'], string> = {
  google: 'Dados preenchidos pela Google Books.',
  'brasil-api': 'Dados preenchidos pelo cadastro brasileiro de ISBN.',
  'open-library': 'Dados preenchidos pela Open Library.',
};

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asHttps(url: string): string {
  return url.replace(/^http:\/\//i, 'https://');
}

function yearFrom(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const year = String(Math.trunc(value));
    return /^\d{4}$/.test(year) ? year : '';
  }
  const match = asText(value).match(/\d{4}/);
  return match?.[0] ?? '';
}

function isbn13To10(isbn: string): string | null {
  if (isbn.length !== 13 || !isbn.startsWith('978') || !/^\d{13}$/.test(isbn)) {
    return null;
  }
  const core = isbn.slice(3, 12);
  let sum = 0;
  for (let index = 0; index < 9; index += 1) {
    sum += Number(core[index]) * (10 - index);
  }
  const check = (11 - (sum % 11)) % 11;
  return `${core}${check === 10 ? 'X' : String(check)}`;
}

async function fetchJson(
  url: string,
  init?: RequestInit
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_MS);
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: { Accept: 'application/json', ...(init?.headers ?? {}) },
    });
    const text = await response.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = null;
    }
    return { ok: response.ok, status: response.status, body };
  } finally {
    clearTimeout(timer);
  }
}

function hit(
  isbn: string,
  source: IsbnCatalogHit['source'],
  fields: { titulo: string; autor: string; editora: string; ano: string; capa: string }
): IsbnCatalogHit {
  return {
    found: true,
    isbn,
    ...fields,
    source,
    message: SOURCE_MESSAGE[source],
  };
}

async function lookupGoogle(
  isbn: string,
  apiKey?: string
): Promise<IsbnCatalogHit | 'quota' | null> {
  const isbn10 = isbn13To10(isbn);
  const queries = [`isbn:${isbn}`, isbn10 ? `isbn:${isbn10}` : '', isbn].filter(Boolean);

  for (const query of queries) {
    const params = new URLSearchParams({ q: query });
    if (apiKey) {
      params.set('key', apiKey);
    }
    try {
      const result = await fetchJson(`${GOOGLE_BOOKS}?${params.toString()}`);
      if (result.status === 429 || result.status === 403) {
        return 'quota';
      }
      if (!result.ok || !result.body || typeof result.body !== 'object') {
        continue;
      }
      const payload = result.body as Record<string, unknown>;
      const items = Array.isArray(payload.items) ? payload.items : [];
      const first =
        items[0] && typeof items[0] === 'object' ? (items[0] as Record<string, unknown>) : null;
      const info =
        first?.volumeInfo && typeof first.volumeInfo === 'object'
          ? (first.volumeInfo as Record<string, unknown>)
          : null;
      const titulo = asText(info?.title);
      if (!Number(payload.totalItems ?? 0) || !info || !titulo) {
        continue;
      }
      const authors = Array.isArray(info.authors)
        ? info.authors.map((name) => asText(name)).filter(Boolean)
        : [];
      const imageLinks =
        info.imageLinks && typeof info.imageLinks === 'object'
          ? (info.imageLinks as Record<string, unknown>)
          : null;
      const capaRaw = asText(imageLinks?.thumbnail) || asText(imageLinks?.smallThumbnail);
      return hit(isbn, 'google', {
        titulo,
        autor: authors.join(', '),
        editora: asText(info.publisher),
        ano: yearFrom(info.publishedDate),
        capa: capaRaw ? asHttps(capaRaw) : '',
      });
    } catch {
      continue;
    }
  }

  return quota ? 'quota' : null;
}

async function lookupBrasilApi(isbn: string): Promise<IsbnCatalogHit | null> {
  const candidates = [isbn, isbn13To10(isbn)].filter((value): value is string => Boolean(value));
  for (const code of candidates) {
    try {
      const result = await fetchJson(`${BRASIL_API}/${encodeURIComponent(code)}`);
      if (!result.ok || !result.body || typeof result.body !== 'object') {
        continue;
      }
      const payload = result.body as Record<string, unknown>;
      const titulo = asText(payload.title);
      const subtitle = asText(payload.subtitle);
      if (!titulo) {
        continue;
      }
      const authors = Array.isArray(payload.authors)
        ? payload.authors.map((name) => asText(name)).filter(Boolean)
        : [];
      const capaRaw = asText(payload.cover_url);
      return hit(isbn, 'brasil-api', {
        titulo: subtitle ? `${titulo}: ${subtitle}` : titulo,
        autor: authors.join(', '),
        editora: asText(payload.publisher),
        ano: yearFrom(payload.year),
        capa: capaRaw ? asHttps(capaRaw) : '',
      });
    } catch {
      continue;
    }
  }
  return null;
}

async function lookupOpenLibrary(isbn: string): Promise<IsbnCatalogHit | null> {
  const candidates = [isbn, isbn13To10(isbn)].filter((value): value is string => Boolean(value));
  for (const code of candidates) {
    try {
      const url = `${OPEN_LIBRARY}?bibkeys=${encodeURIComponent(`ISBN:${code}`)}&format=json&jscmd=data`;
      const result = await fetchJson(url);
      if (!result.ok || !result.body || typeof result.body !== 'object') {
        continue;
      }
      const payload = result.body as Record<string, unknown>;
      const entry = payload[`ISBN:${code}`];
      if (!entry || typeof entry !== 'object') {
        continue;
      }
      const info = entry as Record<string, unknown>;
      const titulo = asText(info.title);
      if (!titulo) {
        continue;
      }
      const authors = Array.isArray(info.authors)
        ? info.authors
            .map((row) => (row && typeof row === 'object' ? asText((row as { name?: unknown }).name) : ''))
            .filter(Boolean)
        : [];
      const publishers = Array.isArray(info.publishers)
        ? info.publishers
            .map((row) =>
              row && typeof row === 'object' ? asText((row as { name?: unknown }).name) : ''
            )
            .filter(Boolean)
        : [];
      const cover =
        info.cover && typeof info.cover === 'object'
          ? asText((info.cover as { large?: unknown; medium?: unknown }).large) ||
            asText((info.cover as { medium?: unknown }).medium)
          : '';
      return hit(isbn, 'open-library', {
        titulo,
        autor: authors.join(', '),
        editora: publishers[0] ?? '',
        ano: yearFrom(info.publish_date),
        capa: cover ? asHttps(cover) : '',
      });
    } catch {
      continue;
    }
  }
  return null;
}

/** Google Books → CBL/BrasilAPI → Open Library. Não trata 429 da Google como fim da busca. */
export async function lookupIsbnCatalog(
  isbn: string,
  options?: { googleApiKey?: string }
): Promise<IsbnCatalogResult> {
  let quotaExceeded = false;

  const google = await lookupGoogle(isbn, options?.googleApiKey?.trim() || undefined);
  if (google && google !== 'quota') {
    return google;
  }
  if (google === 'quota') {
    quotaExceeded = true;
  }

  const brasil = await lookupBrasilApi(isbn);
  if (brasil) {
    return brasil;
  }

  const openLibrary = await lookupOpenLibrary(isbn);
  if (openLibrary) {
    return openLibrary;
  }

  return { found: false, isbn, quotaExceeded };
}

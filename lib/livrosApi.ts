import { getSessionRequestIdentity } from '@/lib/sessionRequestIdentity';
import { supabase } from '@/lib/supabase';
import { isSupabaseRpcMissingError } from '@/lib/supabaseRpc';

export type LivroRecord = {
  id: string;
  tenant_id: string;
  isbn: string | null;
  titulo: string;
  autor: string | null;
  editora: string | null;
  ano: string | null;
  capa: string | null;
  criado_em: string;
};

export type LivroIsbnLookup = {
  found: boolean;
  isbn: string;
  titulo: string;
  autor: string;
  editora: string;
  ano: string;
  capa: string;
  message: string;
};

const GOOGLE_BOOKS = 'https://www.googleapis.com/books/v1/volumes';
const DEFAULT_APP_ORIGIN = 'https://app-igreja.pages.dev';

function mapGoogleBooksPayload(
  isbn: string,
  payload: Record<string, unknown>
): LivroIsbnLookup | null {
  const totalItems = Number(payload.totalItems ?? 0);
  const items = Array.isArray(payload.items) ? payload.items : [];
  const first = items[0] && typeof items[0] === 'object' ? (items[0] as Record<string, unknown>) : null;
  const info =
    first?.volumeInfo && typeof first.volumeInfo === 'object'
      ? (first.volumeInfo as Record<string, unknown>)
      : null;
  const titulo = asText(info?.title);
  if (!totalItems || !info || !titulo) {
    return null;
  }

  const authors = Array.isArray(info.authors)
    ? info.authors.map((name) => asText(name)).filter(Boolean)
    : [];
  const imageLinks =
    info.imageLinks && typeof info.imageLinks === 'object'
      ? (info.imageLinks as Record<string, unknown>)
      : null;
  const published = asText(info.publishedDate);
  const yearMatch = published.match(/\d{4}/);
  const capaRaw = asText(imageLinks?.thumbnail) || asText(imageLinks?.smallThumbnail);

  return {
    found: true,
    isbn,
    titulo,
    autor: authors.join(', '),
    editora: asText(info.publisher),
    ano: yearMatch?.[0] ?? '',
    capa: capaRaw.replace(/^http:\/\//i, 'https://'),
    message: 'Dados preenchidos pela Google Books.',
  };
}

async function lookupIsbnOnGoogleBooks(isbn: string): Promise<LivroIsbnLookup> {
  const empty: LivroIsbnLookup = {
    found: false,
    isbn,
    titulo: '',
    autor: '',
    editora: '',
    ano: '',
    capa: '',
    message: 'ISBN não encontrado. Preencha os dados manualmente.',
  };

  try {
    const response = await fetch(`${GOOGLE_BOOKS}?q=isbn:${encodeURIComponent(isbn)}`, {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      return empty;
    }
    const payload = (await response.json()) as Record<string, unknown>;
    return mapGoogleBooksPayload(isbn, payload) ?? empty;
  } catch {
    return {
      ...empty,
      message: 'Não foi possível consultar o ISBN. Preencha os dados manualmente.',
    };
  }
}

function resolveBuscarLivroEndpoint(): string {
  const configured = String(process.env.EXPO_PUBLIC_APP_URL || '')
    .trim()
    .replace(/\/$/, '');
  const configuredOk =
    configured.startsWith('https://') && !configured.includes('seu-dominio');

  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    const isLocal = host === 'localhost' || host === '127.0.0.1';
    if (!isLocal) {
      return '/api/buscar-livro';
    }
  }

  const origin = configuredOk ? configured : DEFAULT_APP_ORIGIN;
  return `${origin}/api/buscar-livro`;
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function mapLivro(row: Record<string, unknown> | null | undefined): LivroRecord | null {
  if (!row || typeof row.id !== 'string') {
    return null;
  }

  return {
    id: row.id,
    tenant_id: asText(row.tenant_id),
    isbn: asText(row.isbn) || null,
    titulo: asText(row.titulo),
    autor: asText(row.autor) || null,
    editora: asText(row.editora) || null,
    ano: asText(row.ano) || null,
    capa: asText(row.capa) || null,
    criado_em: asText(row.criado_em),
  };
}

export function normalizeIsbnInput(value: string): string {
  return value.replace(/[^0-9Xx]/g, '').toUpperCase();
}

export async function lookupLivroByIsbn(isbnRaw: string): Promise<LivroIsbnLookup> {
  const isbn = normalizeIsbnInput(isbnRaw);
  const empty: LivroIsbnLookup = {
    found: false,
    isbn,
    titulo: '',
    autor: '',
    editora: '',
    ano: '',
    capa: '',
    message: 'ISBN não encontrado. Preencha os dados manualmente.',
  };

  if (isbn.length < 10) {
    return { ...empty, message: 'Informe um ISBN com 10 ou 13 dígitos.' };
  }

  const identity = await getSessionRequestIdentity();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (identity.sessionToken) headers['x-session-token'] = identity.sessionToken;
  if (identity.profileId) headers['x-profile-id'] = identity.profileId;
  if (identity.tenantId) headers['x-tenant-id'] = identity.tenantId;

  try {
    const response = await fetch(resolveBuscarLivroEndpoint(), {
      method: 'POST',
      headers,
      body: JSON.stringify({ isbn }),
    });
    const text = await response.text();
    let payload: Record<string, unknown> = {};
    try {
      payload = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
      return empty;
    }

    if (response.status === 404) {
      return {
        ...empty,
        message: asText(payload.message) || empty.message,
      };
    }

    if (payload.success === true) {
      return {
        found: true,
        isbn: asText(payload.isbn) || isbn,
        titulo: asText(payload.titulo),
        autor: asText(payload.autor),
        editora: asText(payload.editora),
        ano: asText(payload.ano),
        capa: asText(payload.capa),
        message: 'Dados preenchidos pela Google Books.',
      };
    }

    const fallback = await lookupIsbnOnGoogleBooks(isbn);
    if (fallback.found) {
      return fallback;
    }

    return {
      ...empty,
      message: asText(payload.message) || empty.message,
    };
  } catch {
    return lookupIsbnOnGoogleBooks(isbn);
  }
}

export async function listLivros(): Promise<LivroRecord[]> {
  const { data, error } = await supabase.rpc('list_livros');

  if (error) {
    if (isSupabaseRpcMissingError(error, 'list_livros')) {
      throw new Error('SQL de livros ausente. Execute scripts/livros-doados.sql.');
    }
    throw new Error(error.message || 'Não foi possível listar os livros.');
  }

  const payload =
    data && typeof data === 'object' ? (data as { success?: boolean; rows?: unknown }) : {};
  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  return rows
    .map((row) => mapLivro(row as Record<string, unknown>))
    .filter((row): row is LivroRecord => Boolean(row));
}

export async function createLivro(input: {
  isbn?: string;
  titulo: string;
  autor?: string;
  editora?: string;
  ano?: string;
  capa?: string;
}): Promise<{ success: boolean; message: string; row?: LivroRecord }> {
  const { data, error } = await supabase.rpc('create_livro', {
    p_isbn: input.isbn?.trim() || null,
    p_titulo: input.titulo,
    p_autor: input.autor?.trim() || null,
    p_editora: input.editora?.trim() || null,
    p_ano: input.ano?.trim() || null,
    p_capa: input.capa?.trim() || null,
  });

  if (error) {
    if (isSupabaseRpcMissingError(error, 'create_livro')) {
      return { success: false, message: 'SQL de livros ausente. Execute scripts/livros-doados.sql.' };
    }
    return { success: false, message: error.message || 'Não foi possível salvar o livro.' };
  }

  const payload =
    data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  return {
    success: payload.success === true,
    message: asText(payload.message) || (payload.success === true ? 'Livro cadastrado.' : 'Não foi possível salvar.'),
    row: mapLivro(payload.row as Record<string, unknown>) ?? undefined,
  };
}

export async function deleteLivro(id: string): Promise<{ success: boolean; message: string }> {
  const { data, error } = await supabase.rpc('delete_livro', { p_id: id });

  if (error) {
    return { success: false, message: error.message || 'Não foi possível remover o livro.' };
  }

  const payload =
    data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  return {
    success: payload.success === true,
    message: asText(payload.message) || (payload.success === true ? 'Livro removido.' : 'Não foi possível remover.'),
  };
}

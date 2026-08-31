/**
 * Cloudflare Pages Function — busca metadados de livro por ISBN (Google Books).
 * POST /api/buscar-livro
 * body: { isbn: string }
 *
 * Fail-closed: exige x-session-token e RPC assert_can_manage_livros.
 * Sem JWT do Flutter — este app autentica por sessão própria (headers).
 */

import { billingCorsHeaders, jsonResponse, type BillingEnv } from './_billingShared';

type PagesContext = {
  request: Request;
  env: BillingEnv;
};

const GOOGLE_BOOKS = 'https://www.googleapis.com/books/v1/volumes';

export const onRequestOptions = async () =>
  new Response(null, { status: 204, headers: billingCorsHeaders });

const normalizeIsbn = (value: string) => value.replace(/[^0-9Xx]/g, '').toUpperCase();

const asHttps = (url: string | null | undefined) => {
  const trimmed = url?.trim() ?? '';
  if (!trimmed) return null;
  return trimmed.replace(/^http:\/\//i, 'https://');
};

const yearFromPublishedDate = (value: string | null | undefined) => {
  const match = (value ?? '').match(/\d{4}/);
  return match ? match[0] : null;
};

async function assertLivrosSession(
  env: BillingEnv,
  request: Request
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  const sessionToken = request.headers.get('x-session-token')?.trim() ?? '';
  if (!sessionToken) {
    return { ok: false, status: 401, message: 'Sessão inválida. Saia e entre novamente.' };
  }

  const base = (env.SUPABASE_URL || env.EXPO_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
  const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? '';
  if (!base || !key) {
    return { ok: false, status: 503, message: 'Supabase não configurado na Function.' };
  }

  const headers: Record<string, string> = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    'x-session-token': sessionToken,
  };
  const profileId = request.headers.get('x-profile-id')?.trim();
  const tenantId = request.headers.get('x-tenant-id')?.trim();
  if (profileId) headers['x-profile-id'] = profileId;
  if (tenantId) headers['x-tenant-id'] = tenantId;

  let response: Response;
  try {
    response = await fetch(`${base}/rest/v1/rpc/assert_can_manage_livros`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ p_actor: null }),
    });
  } catch {
    return { ok: false, status: 503, message: 'Não foi possível validar a sessão.' };
  }

  if (!response.ok) {
    const text = await response.text();
    let message = 'Você não tem permissão para buscar livros.';
    try {
      const parsed = text ? JSON.parse(text) : null;
      if (parsed && typeof parsed.message === 'string' && parsed.message.trim()) {
        message = parsed.message;
      }
    } catch {
      if (text.trim()) message = text.trim();
    }
    return { ok: false, status: response.status === 401 ? 401 : 403, message };
  }

  return { ok: true };
}

export const onRequestPost = async (context: PagesContext) => {
  try {
    const auth = await assertLivrosSession(context.env, context.request);
    if (!auth.ok) {
      return jsonResponse({ success: false, message: auth.message }, auth.status);
    }

    const body = (await context.request.json()) as { isbn?: string };
    const isbn = normalizeIsbn(body.isbn ?? '');
    if (isbn.length < 10) {
      return jsonResponse({ success: false, message: 'Informe um ISBN válido.' }, 400);
    }

    const google = await fetch(`${GOOGLE_BOOKS}?q=isbn:${encodeURIComponent(isbn)}`, {
      headers: { Accept: 'application/json' },
    });

    if (!google.ok) {
      return jsonResponse(
        { success: false, message: 'Google Books indisponível no momento.' },
        502
      );
    }

    const payload = (await google.json()) as {
      totalItems?: number;
      items?: Array<{
        volumeInfo?: {
          title?: string;
          authors?: string[];
          publisher?: string;
          publishedDate?: string;
          imageLinks?: { thumbnail?: string; smallThumbnail?: string };
        };
      }>;
    };

    const info = payload.items?.[0]?.volumeInfo;
    const titulo = info?.title?.trim() ?? '';
    if (!payload.totalItems || !info || !titulo) {
      return jsonResponse({ success: false, message: 'ISBN não encontrado.' }, 404);
    }

    return jsonResponse({
      success: true,
      isbn,
      titulo,
      autor: (info.authors ?? []).map((name) => name.trim()).filter(Boolean).join(', ') || null,
      editora: info.publisher?.trim() || null,
      ano: yearFromPublishedDate(info.publishedDate),
      capa: asHttps(info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail),
    });
  } catch {
    return jsonResponse({ success: false, message: 'Falha ao buscar o ISBN.' }, 500);
  }
};

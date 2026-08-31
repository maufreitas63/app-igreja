/**
 * Cloudflare Pages Function — busca metadados de livro por ISBN.
 * POST /api/buscar-livro
 * body: { isbn: string }
 *
 * Fail-closed: exige x-session-token e RPC assert_can_manage_livros.
 * Catálogo: Google Books, depois CBL/BrasilAPI, depois Open Library.
 */

import {
  billingCorsHeaders,
  jsonResponse,
  resolveSupabaseBaseUrl,
  type BillingEnv,
} from './_billingShared';
import { lookupIsbnCatalog } from '../../lib/isbnCatalogLookup';

type PagesContext = {
  request: Request;
  env: BillingEnv & { GOOGLE_BOOKS_API_KEY?: string };
};

export const onRequestOptions = async () =>
  new Response(null, { status: 204, headers: billingCorsHeaders });

const normalizeIsbn = (value: string) => value.replace(/[^0-9Xx]/g, '').toUpperCase();

async function assertLivrosSession(
  env: BillingEnv,
  request: Request
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  const sessionToken = request.headers.get('x-session-token')?.trim() ?? '';
  if (!sessionToken) {
    return { ok: false, status: 401, message: 'Sessão inválida. Saia e entre novamente.' };
  }

  const base = resolveSupabaseBaseUrl(env);
  const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? '';
  if (!base || !key) {
    return { ok: false, status: 503, message: 'Supabase não configurado na Function.' };
  }

  const headers: Record<string, string> = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
    Prefer: 'return=representation',
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
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'falha de rede';
    return {
      ok: false,
      status: 503,
      message: `Não foi possível validar a sessão (${detail}). Confira SUPABASE_URL no Cloudflare.`,
    };
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

    const hit = await lookupIsbnCatalog(isbn, {
      googleApiKey: context.env.GOOGLE_BOOKS_API_KEY,
    });

    if (hit.found) {
      return jsonResponse({
        success: true,
        isbn: hit.isbn,
        titulo: hit.titulo,
        autor: hit.autor || null,
        editora: hit.editora || null,
        ano: hit.ano || null,
        capa: hit.capa || null,
        source: hit.source,
        message: hit.message,
      });
    }

    return jsonResponse(
      {
        success: false,
        message: hit.quotaExceeded
          ? 'Consulta automática indisponível no momento. Preencha os dados manualmente.'
          : 'ISBN não encontrado. Preencha os dados manualmente.',
      },
      hit.quotaExceeded ? 502 : 404
    );
  } catch {
    return jsonResponse({ success: false, message: 'Falha ao buscar o ISBN.' }, 500);
  }
};

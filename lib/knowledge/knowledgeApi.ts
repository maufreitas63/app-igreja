import { supabase } from '@/lib/supabase';
import { isSupabaseRpcMissingError } from '@/lib/supabaseRpc';
import type {
  KnowledgeArticle,
  KnowledgeEditorCapabilities,
  KnowledgeListItem,
  KnowledgeMutationResult,
} from '@/lib/knowledge/types';

const MISSING_SQL =
  'Base de conhecimento ausente. Execute scripts/knowledge-base.sql.';

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asText(value: unknown): string {
  return value == null ? '' : String(value).trim();
}

function asTextOrNull(value: unknown): string | null {
  const text = asText(value);
  return text || null;
}

function asBoolean(value: unknown, fallback = false): boolean {
  if (value === true || value === 'true' || value === 1 || value === '1') return true;
  if (value === false || value === 'false' || value === 0 || value === '0') return false;
  return fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => asText(item)).filter(Boolean);
}

function mapArticle(raw: unknown): KnowledgeArticle | null {
  const row = asRecord(raw);
  if (!row) return null;
  const id = asText(row.id);
  const slug = asText(row.slug);
  const title = asText(row.title);
  if (!id || !slug || !title) return null;
  return {
    id,
    slug,
    title,
    question: asText(row.question),
    body: asText(row.body),
    route_key: asText(row.route_key),
    tenant_id: asTextOrNull(row.tenant_id),
    is_published: asBoolean(row.is_published, true),
    sort_order: asNumber(row.sort_order),
    role_codes: asStringArray(row.role_codes),
  };
}

function mapListItem(raw: unknown): KnowledgeListItem | null {
  const article = mapArticle(raw);
  if (!article) return null;
  return {
    id: article.id,
    slug: article.slug,
    title: article.title,
    question: article.question,
    body: article.body,
    route_key: article.route_key,
    sort_order: article.sort_order,
  };
}

export async function getKnowledgeArticleForRoute(
  routeKey: string
): Promise<KnowledgeArticle | null> {
  const key = routeKey.trim();
  if (!key) return null;

  const { data, error } = await supabase.rpc('get_knowledge_article_for_route', {
    p_route_key: key,
  });

  if (error) {
    if (isSupabaseRpcMissingError(error, 'get_knowledge_article_for_route')) {
      return null;
    }
    console.warn('get_knowledge_article_for_route', error.message);
    return null;
  }

  const row = asRecord(data);
  if (!row || row.success === false) return null;
  return mapArticle(row.article);
}

export async function listKnowledgeArticles(query = ''): Promise<KnowledgeListItem[]> {
  const { data, error } = await supabase.rpc('list_knowledge_articles', {
    p_query: query.trim() || null,
  });

  if (error) {
    if (isSupabaseRpcMissingError(error, 'list_knowledge_articles')) {
      return [];
    }
    console.warn('list_knowledge_articles', error.message);
    return [];
  }

  const row = asRecord(data);
  const items = Array.isArray(row?.articles) ? row.articles : [];
  return items.map(mapListItem).filter((item): item is KnowledgeListItem => item != null);
}

export async function getKnowledgeEditorCapabilities(): Promise<KnowledgeEditorCapabilities> {
  const fallback = { can_edit: false, can_edit_platform: false, can_edit_tenant: false };
  const { data, error } = await supabase.rpc('can_edit_knowledge_articles');

  if (error) {
    if (!isSupabaseRpcMissingError(error, 'can_edit_knowledge_articles')) {
      console.warn('can_edit_knowledge_articles', error.message);
    }
    return fallback;
  }

  const row = asRecord(data);
  if (!row || row.success === false) return fallback;
  return {
    can_edit: asBoolean(row.can_edit),
    can_edit_platform: asBoolean(row.can_edit_platform),
    can_edit_tenant: asBoolean(row.can_edit_tenant),
  };
}

export async function listKnowledgeArticlesAdmin(
  query = ''
): Promise<KnowledgeArticle[]> {
  const { data, error } = await supabase.rpc('list_knowledge_articles_admin', {
    p_query: query.trim() || null,
  });

  if (error) {
    if (isSupabaseRpcMissingError(error, 'list_knowledge_articles_admin')) {
      return [];
    }
    console.warn('list_knowledge_articles_admin', error.message);
    return [];
  }

  const row = asRecord(data);
  const items = Array.isArray(row?.articles) ? row.articles : [];
  return items.map(mapArticle).filter((item): item is KnowledgeArticle => item != null);
}

export async function upsertKnowledgeArticle(input: {
  id?: string | null;
  slug: string;
  title: string;
  question: string;
  body: string;
  route_key: string;
  is_platform: boolean;
  is_published: boolean;
  sort_order: number;
  role_codes: string[];
}): Promise<KnowledgeMutationResult> {
  const { data, error } = await supabase.rpc('upsert_knowledge_article', {
    p_id: input.id || null,
    p_slug: input.slug.trim(),
    p_title: input.title.trim(),
    p_question: input.question.trim(),
    p_body: input.body.trim(),
    p_route_key: input.route_key.trim(),
    p_is_platform: input.is_platform,
    p_is_published: input.is_published,
    p_sort_order: input.sort_order,
    p_role_codes: input.role_codes,
  });

  if (error) {
    if (isSupabaseRpcMissingError(error, 'upsert_knowledge_article')) {
      return { success: false, message: MISSING_SQL };
    }
    return { success: false, message: error.message || 'Não foi possível salvar o artigo.' };
  }

  const row = asRecord(data);
  return {
    success: asBoolean(row?.success),
    message: asText(row?.message) || (asBoolean(row?.success) ? 'Artigo salvo.' : 'Falha ao salvar.'),
    article: mapArticle(row?.article),
  };
}

export async function unpublishKnowledgeArticle(
  articleId: string
): Promise<KnowledgeMutationResult> {
  const { data, error } = await supabase.rpc('unpublish_knowledge_article', {
    p_id: articleId,
  });

  if (error) {
    if (isSupabaseRpcMissingError(error, 'unpublish_knowledge_article')) {
      return { success: false, message: MISSING_SQL };
    }
    return { success: false, message: error.message || 'Não foi possível arquivar o artigo.' };
  }

  const row = asRecord(data);
  return {
    success: asBoolean(row?.success),
    message: asText(row?.message) || (asBoolean(row?.success) ? 'Artigo arquivado.' : 'Falha ao arquivar.'),
  };
}

import { getCachedOrFetch, invalidateAsyncCache } from '@/lib/asyncResultCache';
import { supabase } from '@/lib/supabase';
import { isSupabaseRpcMissingError } from '@/lib/supabaseRpc';

const PUBLIC_CACHE_KEY = 'glossary:public';
const PUBLIC_CACHE_TTL_MS = 30 * 60 * 1000;

export type GlossaryTermPublic = {
  id: string;
  term: string;
  description: string;
};

export type GlossaryTermAdmin = GlossaryTermPublic & {
  is_active: boolean;
  sort_order: number;
};

export type GlossaryPublicSnapshot = {
  enabled: boolean;
  terms: GlossaryTermPublic[];
};

export type GlossaryAdminSnapshot = {
  enabled: boolean;
  terms: GlossaryTermAdmin[];
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asText(value: unknown): string {
  return value == null ? '' : String(value).trim();
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

function mapPublicTerm(raw: unknown): GlossaryTermPublic | null {
  const row = asRecord(raw);
  if (!row) return null;
  const id = asText(row.id);
  const term = asText(row.term);
  const description = asText(row.description);
  if (!id || !term || !description) return null;
  return { id, term, description };
}

function mapAdminTerm(raw: unknown): GlossaryTermAdmin | null {
  const base = mapPublicTerm(raw);
  if (!base) return null;
  const row = asRecord(raw);
  return {
    ...base,
    is_active: asBoolean(row?.is_active, true),
    sort_order: asNumber(row?.sort_order, 100),
  };
}

export function invalidateGlossaryPublicCache() {
  invalidateAsyncCache(PUBLIC_CACHE_KEY);
}

export async function fetchPlatformGlossaryPublic(
  options?: { forceRefresh?: boolean }
): Promise<GlossaryPublicSnapshot> {
  const fallback: GlossaryPublicSnapshot = { enabled: false, terms: [] };

  return getCachedOrFetch(
    PUBLIC_CACHE_KEY,
    async () => {
      const { data, error } = await supabase.rpc('list_platform_glossary_public');

      if (error) {
        if (!isSupabaseRpcMissingError(error, 'list_platform_glossary_public')) {
          console.warn('list_platform_glossary_public', error.message);
        }
        return fallback;
      }

      const row = asRecord(data);
      if (!row || row.success === false) return fallback;

      const items = Array.isArray(row.terms) ? row.terms : [];
      return {
        enabled: asBoolean(row.enabled, true),
        terms: items
          .map(mapPublicTerm)
          .filter((item): item is GlossaryTermPublic => item != null),
      };
    },
    {
      ttlMs: PUBLIC_CACHE_TTL_MS,
      scopeId: 'platform',
      forceRefresh: options?.forceRefresh === true,
    }
  );
}

export async function fetchPlatformGlossaryAdmin(): Promise<GlossaryAdminSnapshot> {
  const fallback: GlossaryAdminSnapshot = { enabled: true, terms: [] };
  const { data, error } = await supabase.rpc('list_platform_glossary_admin');

  if (error) {
    if (isSupabaseRpcMissingError(error, 'list_platform_glossary_admin')) {
      throw new Error('Dicionário ausente. Execute scripts/platform-glossary.sql.');
    }
    throw new Error(error.message);
  }

  const row = asRecord(data);
  if (!row || row.success === false) {
    throw new Error(asText(row?.message) || 'Não foi possível listar o dicionário.');
  }

  const items = Array.isArray(row.terms) ? row.terms : [];
  return {
    enabled: asBoolean(row.enabled, true),
    terms: items
      .map(mapAdminTerm)
      .filter((item): item is GlossaryTermAdmin => item != null),
  };
}

export async function setPlatformGlossaryEnabled(enabled: boolean): Promise<boolean> {
  const { data, error } = await supabase.rpc('set_platform_glossary_enabled', {
    p_enabled: enabled,
  });

  if (error) {
    throw new Error(error.message);
  }

  const row = asRecord(data);
  if (!row || row.success === false) {
    throw new Error(asText(row?.message) || 'Não foi possível atualizar a exibição dos termos.');
  }

  invalidateGlossaryPublicCache();
  return asBoolean(row.enabled, enabled);
}

export async function setPlatformGlossaryTermActive(
  id: string,
  isActive: boolean
): Promise<void> {
  const { data, error } = await supabase.rpc('set_platform_glossary_term_active', {
    p_id: id,
    p_is_active: isActive,
  });

  if (error) {
    throw new Error(error.message);
  }

  const row = asRecord(data);
  if (!row || row.success === false) {
    throw new Error(asText(row?.message) || 'Não foi possível atualizar o termo.');
  }

  invalidateGlossaryPublicCache();
}

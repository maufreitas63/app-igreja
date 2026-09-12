import type { GlossaryTermPublic } from '@/lib/glossary/glossaryApi';

export type GlossaryMatcher = {
  regex: RegExp;
  byLower: Map<string, GlossaryTermPublic>;
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Compila uma única regex (termos longos primeiro) para o grifo em sessão. */
export function compileGlossaryMatcher(terms: GlossaryTermPublic[]): GlossaryMatcher | null {
  const usable = terms
    .map((item) => ({
      ...item,
      term: item.term.trim(),
      description: item.description.trim(),
    }))
    .filter((item) => item.term.length >= 2 && item.description.length >= 8)
    .sort((left, right) => right.term.length - left.term.length || left.term.localeCompare(right.term, 'pt-BR'));

  if (!usable.length) {
    return null;
  }

  const byLower = new Map<string, GlossaryTermPublic>();
  for (const item of usable) {
    const key = item.term.toLocaleLowerCase('pt-BR');
    if (!byLower.has(key)) {
      byLower.set(key, item);
    }
  }

  const body = usable.map((item) => escapeRegExp(item.term)).join('|');

  try {
    return {
      regex: new RegExp(`(?<![\\p{L}\\p{N}_])(${body})(?![\\p{L}\\p{N}_])`, 'giu'),
      byLower,
    };
  } catch {
    try {
      return {
        regex: new RegExp(`(?:^|[^A-Za-zÀ-ÿ0-9_])(${body})(?=$|[^A-Za-zÀ-ÿ0-9_])`, 'gi'),
        byLower,
      };
    } catch {
      return null;
    }
  }
}

export function glossaryHasMatch(text: string, matcher: GlossaryMatcher): boolean {
  matcher.regex.lastIndex = 0;
  const found = matcher.regex.test(text);
  matcher.regex.lastIndex = 0;
  return found;
}

export function lookupGlossaryTerm(
  raw: string,
  matcher: GlossaryMatcher
): GlossaryTermPublic | null {
  return matcher.byLower.get(raw.toLocaleLowerCase('pt-BR')) ?? null;
}

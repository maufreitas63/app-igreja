export function normalizeInstanceCode(raw: string | null | undefined): string {
  return (raw ?? '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
}

/** Extrai o código de convite: `?tenant=`, `?igreja=`, `?codigo=` ou deep link. */
export function parseInstanceCodeFromUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) {
    return null;
  }

  const fromQueryString = (query: string) => {
    try {
      const params = new URLSearchParams(query);
      return normalizeInstanceCode(
        params.get('tenant')
          || params.get('codigo')
          || params.get('igreja')
          || params.get('code')
          || ''
      );
    } catch {
      return '';
    }
  };

  try {
    const parsed = new URL(url);
    const fromSearch = fromQueryString(parsed.search.replace(/^\?/, ''));
    if (fromSearch) {
      return fromSearch;
    }

    if (parsed.hash) {
      const hash = parsed.hash.replace(/^#/, '');
      const hashQuery = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : hash;
      const fromHash = fromQueryString(hashQuery);
      if (fromHash) {
        return fromHash;
      }
    }
  } catch {
    const match = url.match(/[?&](?:tenant|codigo|igreja|code)=([^&]+)/i);
    if (match?.[1]) {
      try {
        const decoded = normalizeInstanceCode(decodeURIComponent(match[1]));
        return decoded || null;
      } catch {
        return normalizeInstanceCode(match[1]) || null;
      }
    }
  }

  return null;
}

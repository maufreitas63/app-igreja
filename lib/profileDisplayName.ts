import { isNomeFantasiaEnabled } from '@/lib/appParameters';
import { formatShortName } from '@/lib/formatShortName';

export type ProfileNameFields = {
  full_name?: string | null;
  nome_fantasia?: string | null;
  nomeFantasia?: string | null;
  fullName?: string | null;
};

let cachedUseFantasia: boolean | null = null;
let loadPromise: Promise<boolean> | null = null;

export async function loadNomeFantasiaPreference(force = false): Promise<boolean> {
  if (!force && cachedUseFantasia !== null) {
    return cachedUseFantasia;
  }

  if (!force && loadPromise) {
    return loadPromise;
  }

  loadPromise = isNomeFantasiaEnabled()
    .then((enabled) => {
      cachedUseFantasia = enabled;
      return enabled;
    })
    .finally(() => {
      loadPromise = null;
    });

  return loadPromise;
}

export function getNomeFantasiaPreferenceSync(): boolean {
  return cachedUseFantasia === true;
}

export function resetNomeFantasiaPreferenceCache() {
  cachedUseFantasia = null;
  loadPromise = null;
}

const readNomeFantasia = (source: ProfileNameFields) =>
  (source.nome_fantasia ?? source.nomeFantasia ?? '').trim();

const readFullName = (source: ProfileNameFields | string | null | undefined) => {
  if (typeof source === 'string') {
    return source.trim();
  }

  if (!source) {
    return '';
  }

  return (source.full_name ?? source.fullName ?? '').trim();
};

export function resolveProfileDisplayName(
  source: ProfileNameFields | string | null | undefined,
  options?: { useFantasia?: boolean }
): string {
  const useFantasia = options?.useFantasia ?? getNomeFantasiaPreferenceSync();

  if (typeof source === 'string' || source == null) {
    const fullName = readFullName(source);
    return fullName || '—';
  }

  const fullName = readFullName(source);
  const nomeFantasia = readNomeFantasia(source);
  const chosen = useFantasia && nomeFantasia ? nomeFantasia : fullName;

  return chosen || '—';
}

/** Nome curto (primeiro + último token) respeitando `n_fantasia`. */
export function formatProfileShortName(
  source: ProfileNameFields | string | null | undefined,
  options?: { useFantasia?: boolean }
): string {
  const resolved = resolveProfileDisplayName(source, options);

  if (resolved === '—') {
    return resolved;
  }

  return formatShortName(resolved);
}

/** Nome completo para exibição respeitando `n_fantasia`. */
export function formatProfileFullName(
  source: ProfileNameFields | string | null | undefined,
  options?: { useFantasia?: boolean }
): string {
  return resolveProfileDisplayName(source, options);
}

/** Alias legado — mesmo comportamento de `formatProfileShortName`. */
export const formatDisplayName = formatProfileShortName;

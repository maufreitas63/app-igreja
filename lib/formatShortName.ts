/** Primeiro nome + último sobrenome (nome curto para listas). */
export function formatShortName(fullName: string | null | undefined) {
  const trimmed = (fullName ?? '').trim();
  if (!trimmed) {
    return '—';
  }

  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length <= 1) {
    return parts[0] ?? trimmed;
  }

  return `${parts[0]} ${parts[parts.length - 1]}`;
}

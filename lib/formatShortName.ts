import { formatFullName } from '@/lib/fullName';
import {
  applyIbsManualDisplayName,
  ensureIbsManualDisplayMaskStarted,
  IBS_MANUAL_DISPLAY_NAME,
} from '@/lib/ibsManualDisplayMask';

export type FormatShortNameOptions = {
  profileId?: string | null;
  /** Matching interno (escalas) — não aplica a máscara da IBS. */
  unmasked?: boolean;
};

/** Primeiro nome + último sobrenome (nome curto para listas). */
export function formatShortName(
  fullName: string | null | undefined,
  options?: FormatShortNameOptions
) {
  ensureIbsManualDisplayMaskStarted();

  if (!options?.unmasked) {
    const masked = applyIbsManualDisplayName(fullName, options?.profileId);
    if (masked === IBS_MANUAL_DISPLAY_NAME) {
      return masked;
    }
  }

  const trimmed = formatFullName(fullName);
  if (!trimmed) {
    return '—';
  }

  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length <= 1) {
    return parts[0] ?? trimmed;
  }

  return `${parts[0]} ${parts[parts.length - 1]}`;
}

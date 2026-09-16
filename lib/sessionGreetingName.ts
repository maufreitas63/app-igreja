import {
  applyIbsManualDisplayName,
  IBS_MANUAL_DISPLAY_NAME,
} from '@/lib/ibsManualDisplayMask';

/** Primeiro nome da identidade efetiva — o mesmo de «Olá, Maurício». */
export function resolveGreetingFirstName(
  fullName: string | null | undefined,
  profileId?: string | null
): string {
  const masked = applyIbsManualDisplayName(fullName, profileId);
  if (masked === IBS_MANUAL_DISPLAY_NAME) {
    return masked;
  }

  const trimmed = fullName?.trim();

  if (!trimmed) {
    return 'usuário';
  }

  return trimmed.split(/\s+/)[0]?.trim() || 'usuário';
}

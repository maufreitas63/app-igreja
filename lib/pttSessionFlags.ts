const AUTO_DIALOGUE_KEY = 'ptt_auto_dialogue_shown';

/** Uma abertura automática de diálogo por sessão de aba. */
export function hasPttAutoDialogueShown(): boolean {
  try {
    if (typeof sessionStorage === 'undefined') {
      return false;
    }
    return sessionStorage.getItem(AUTO_DIALOGUE_KEY) === '1';
  } catch {
    return false;
  }
}

export function markPttAutoDialogueShown() {
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(AUTO_DIALOGUE_KEY, '1');
    }
  } catch {
    /* ignore */
  }
}

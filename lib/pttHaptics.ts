import { Platform, Vibration } from 'react-native';

/** Dois toques curtos ao entregar mensagem PTT. */
const WEB_PATTERN = [40, 70, 40];
const NATIVE_PATTERN = [0, 40, 70, 40];

export function pulsePttDeliveryVibration() {
  try {
    if (Platform.OS === 'web') {
      const nav =
        typeof navigator !== 'undefined'
          ? (navigator as Navigator & { vibrate?: (pattern: number | number[]) => boolean })
          : null;
      if (typeof nav?.vibrate === 'function') {
        nav.vibrate(WEB_PATTERN);
        return;
      }
    }
    Vibration.vibrate(NATIVE_PATTERN);
  } catch {
    /* vibração indisponível (desktop sem API, política do browser, etc.) */
  }
}

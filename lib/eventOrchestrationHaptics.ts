import * as Haptics from 'expo-haptics';
import { Platform, Vibration } from 'react-native';

/** Padrão curto e perceptível (Android aceita array). */
const ORCHESTRATION_VIBRATE_PATTERN = [200, 80, 200] as const;

let lastUserGestureAt = 0;

/** Registra toques na tela — melhora chances de vibrar após evento Realtime (Android PWA). */
export function registerOrchestrationUserGestureListeners() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return () => undefined;
  }

  const markGesture = () => {
    lastUserGestureAt = Date.now();
  };

  window.addEventListener('pointerdown', markGesture, { passive: true, capture: true });
  window.addEventListener('touchstart', markGesture, { passive: true, capture: true });
  window.addEventListener('keydown', markGesture, { capture: true });

  return () => {
    window.removeEventListener('pointerdown', markGesture, true);
    window.removeEventListener('touchstart', markGesture, true);
    window.removeEventListener('keydown', markGesture, true);
  };
}

export function hasRecentOrchestrationUserGesture(maxAgeMs = 20_000) {
  return Date.now() - lastUserGestureAt < maxAgeMs;
}

const vibrateWithNavigator = () => {
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) {
    return false;
  }

  try {
    return navigator.vibrate([...ORCHESTRATION_VIBRATE_PATTERN]) !== false;
  } catch {
    return false;
  }
};

const vibrateWithExpoHaptics = async () => {
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    return true;
  } catch {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      return true;
    } catch {
      return false;
    }
  }
};

const vibrateWithReactNative = () => {
  try {
    if (Platform.OS === 'android') {
      Vibration.vibrate([...ORCHESTRATION_VIBRATE_PATTERN]);
    } else {
      Vibration.vibrate(ORCHESTRATION_VIBRATE_PATTERN[0]);
    }

    return true;
  } catch {
    return false;
  }
};

type TriggerOptions = {
  /** true = botão do orquestrador (gesto direto do usuário). */
  fromUserGesture?: boolean;
};

/**
 * Vibração ao guiar membros ou ao acionar rotas no orquestrador.
 * iOS Safari/PWA não suporta motor de vibração — use o pulso visual do overlay.
 */
export async function triggerOrchestrationHapticFeedback(
  options: TriggerOptions = {}
): Promise<boolean> {
  const { fromUserGesture = false } = options;
  let triggered = false;

  if (fromUserGesture) {
    triggered = (await vibrateWithExpoHaptics()) || triggered;
    triggered = vibrateWithNavigator() || triggered;
    triggered = vibrateWithReactNative() || triggered;
    return triggered;
  }

  // Realtime (sem gesto): tenta expo/RN; na web só vibra se houve toque recente na tela.
  triggered = (await vibrateWithExpoHaptics()) || triggered;
  triggered = vibrateWithReactNative() || triggered;

  if (Platform.OS === 'web') {
    if (fromUserGesture || hasRecentOrchestrationUserGesture()) {
      triggered = vibrateWithNavigator() || triggered;
    }
  } else {
    triggered = vibrateWithNavigator() || triggered;
  }

  return triggered;
}

/** Para botões — dispara no pressIn (cadeia de gesto intacta no mobile). */
export function triggerOrchestrationButtonHaptic() {
  void triggerOrchestrationHapticFeedback({ fromUserGesture: true });

  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate([...ORCHESTRATION_VIBRATE_PATTERN]);
    } catch {
      // ignore
    }
  }
}

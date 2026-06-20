import { Platform, Vibration } from 'react-native';

const ORCHESTRATION_HAPTIC_MS = 200;

/** Vibração curta ao guiar o membro ou ao acionar rota no orquestrador (PWA: Vibration API). */
export function triggerOrchestrationHapticFeedback() {
  if (Platform.OS === 'web') {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(ORCHESTRATION_HAPTIC_MS);
    }

    return;
  }

  Vibration.vibrate(ORCHESTRATION_HAPTIC_MS);
}

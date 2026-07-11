import { triggerOrchestrationHapticFeedback } from '@/lib/eventOrchestrationHaptics';

let lastDebugVibrateAt = 0;
const DEBUG_VIBRATE_COOLDOWN_MS = 1_500;

/** Vibração curta para o super admin identificar inconsistência (erro ou layout). */
export async function triggerSuperAdminDebugHaptic(): Promise<void> {
  const now = Date.now();
  if (now - lastDebugVibrateAt < DEBUG_VIBRATE_COOLDOWN_MS) {
    return;
  }
  lastDebugVibrateAt = now;
  await triggerOrchestrationHapticFeedback({ fromUserGesture: true });
}

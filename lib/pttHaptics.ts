import { Platform, Vibration } from 'react-native';

/** Dois toques (mais longos — 40ms quase não dá para sentir em muitos aparelhos). */
const WEB_PATTERN = [120, 90, 120];
const NATIVE_PATTERN = [0, 120, 90, 120];

let audioCtx: AudioContext | null = null;
let unlockBound = false;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const AC =
      window.AudioContext
      || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    if (!audioCtx) audioCtx = new AC();
    return audioCtx;
  } catch {
    return null;
  }
}

/** Desbloqueia áudio/vibração após o primeiro toque na sessão (exigência do Chrome). */
export function ensurePttDeliveryFeedbackReady() {
  if (typeof window === 'undefined' || unlockBound) return;
  unlockBound = true;

  const unlock = () => {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      void ctx.resume().catch(() => undefined);
    }
    // “Aquecimento” da Vibration API sob gesto do usuário
    try {
      const nav = navigator as Navigator & { vibrate?: (p: number | number[]) => boolean };
      if (typeof nav.vibrate === 'function') {
        nav.vibrate(1);
      }
    } catch {
      /* ignore */
    }
  };

  window.addEventListener('pointerdown', unlock, { once: true, capture: true });
  window.addEventListener('touchstart', unlock, { once: true, capture: true });
  window.addEventListener('keydown', unlock, { once: true, capture: true });
}

function playDoubleBeep() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const run = () => {
    const beep = (at: number, freq: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.18, at + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.09);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(at);
      osc.stop(at + 0.1);
    };
    const t0 = ctx.currentTime;
    beep(t0, 880);
    beep(t0 + 0.16, 880);
  };

  if (ctx.state === 'suspended') {
    void ctx.resume().then(run).catch(() => undefined);
    return;
  }
  run();
}

function vibrateHardware() {
  if (Platform.OS === 'web') {
    const nav =
      typeof navigator !== 'undefined'
        ? (navigator as Navigator & { vibrate?: (pattern: number | number[]) => boolean })
        : null;
    if (typeof nav?.vibrate === 'function') {
      const ok = nav.vibrate(WEB_PATTERN);
      // Alguns Chromium ignoram o padrão; força 2 pulsos separados.
      if (ok === false) {
        nav.vibrate(120);
        window.setTimeout(() => {
          try {
            nav.vibrate?.(120);
          } catch {
            /* ignore */
          }
        }, 210);
      }
      return;
    }
  }
  Vibration.vibrate(NATIVE_PATTERN);
}

function notifyWithVibrate() {
  if (Platform.OS !== 'web' || typeof Notification === 'undefined') return;
  if (Notification.permission !== 'granted') return;
  try {
    const options: NotificationOptions & { vibrate?: number[] } = {
      body: 'Nova mensagem recebida',
      tag: 'ptt-delivery',
      silent: false,
      vibrate: WEB_PATTERN,
    };
    const n = new Notification('Walkie-Talkie', options);
    window.setTimeout(() => {
      try {
        n.close();
      } catch {
        /* ignore */
      }
    }, 2200);
  } catch {
    /* ignore */
  }
}

/** Dois toques curtos ao entregar mensagem PTT (+ beep se vibração bloqueada). */
export function pulsePttDeliveryVibration() {
  ensurePttDeliveryFeedbackReady();
  try {
    vibrateHardware();
  } catch {
    /* vibração indisponível */
  }
  try {
    notifyWithVibrate();
  } catch {
    /* ignore */
  }
  try {
    playDoubleBeep();
  } catch {
    /* ignore */
  }
}

/** Pedir permissão de notificação (com vibrar) — chamar sob ação do usuário no Walkie. */
export async function requestPttDeliveryNotificationPermission(): Promise<void> {
  if (Platform.OS !== 'web' || typeof Notification === 'undefined') return;
  if (Notification.permission !== 'default') return;
  try {
    await Notification.requestPermission();
  } catch {
    /* ignore */
  }
}

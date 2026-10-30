/** Tons curtos pelo Web Audio API. Sem arquivos externos. */

type Tone = {
  frequency: number;
  duration: number;
  delay?: number;
  type?: OscillatorType;
  slideTo?: number;
};

let audioContext: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const BrowserAudio = window.AudioContext
    ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!BrowserAudio) {
    return null;
  }
  if (!audioContext) {
    audioContext = new BrowserAudio();
  }
  return audioContext;
}

function playTones(tones: Tone[]): void {
  const context = getContext();
  if (!context) {
    return;
  }
  if (context.state === 'suspended') {
    void context.resume();
  }
  const now = context.currentTime;
  for (const tone of tones) {
    const start = now + (tone.delay ?? 0);
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = tone.type ?? 'sine';
    oscillator.frequency.setValueAtTime(tone.frequency, start);
    if (tone.slideTo) {
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(40, tone.slideTo), start + tone.duration);
    }
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.18, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + tone.duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + tone.duration + 0.02);
  }
}

export function playWordTap(): void {
  playTones([{ frequency: 400, duration: 0.04, type: 'triangle' }]);
}

export function playCorrectChime(): void {
  playTones([
    { frequency: 523.25, duration: 0.12, delay: 0 },
    { frequency: 659.25, duration: 0.12, delay: 0.08 },
    { frequency: 783.99, duration: 0.12, delay: 0.16 },
    { frequency: 1046.5, duration: 0.22, delay: 0.24 },
  ]);
}

export function playWrongTone(): void {
  playTones([{ frequency: 320, duration: 0.28, slideTo: 200, type: 'sine' }]);
}

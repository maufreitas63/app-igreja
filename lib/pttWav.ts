/** Converte qualquer blob de áudio decodificável pelo browser em WAV PCM 16 kHz mono. */

const writeString = (view: DataView, offset: number, value: string) => {
  for (let i = 0; i < value.length; i += 1) {
    view.setUint8(offset + i, value.charCodeAt(i));
  }
};

const encodeWavPcm16 = (samples: Float32Array, sampleRate: number): ArrayBuffer => {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i += 1) {
    const s = Math.max(-1, Math.min(1, samples[i] ?? 0));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }
  return buffer;
};

const downsampleMono = (channel: Float32Array, fromRate: number, toRate: number): Float32Array => {
  if (fromRate === toRate) {
    return channel;
  }
  const ratio = fromRate / toRate;
  const length = Math.max(1, Math.round(channel.length / ratio));
  const result = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    const start = Math.floor(i * ratio);
    const end = Math.min(channel.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    let count = 0;
    for (let j = start; j < end; j += 1) {
      sum += channel[j] ?? 0;
      count += 1;
    }
    result[i] = count > 0 ? sum / count : 0;
  }
  return result;
};

export async function blobToWavBase64(blob: Blob): Promise<string> {
  if (typeof AudioContext === 'undefined' && typeof (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext === 'undefined') {
    throw new Error('AudioContext indisponível para preparar a transcrição.');
  }

  const AudioCtx =
    AudioContext
    || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioCtx();
  try {
    const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
    const channels = decoded.numberOfChannels;
    const length = decoded.length;
    const mixed = new Float32Array(length);
    for (let ch = 0; ch < channels; ch += 1) {
      const data = decoded.getChannelData(ch);
      for (let i = 0; i < length; i += 1) {
        mixed[i] = (mixed[i] ?? 0) + (data[i] ?? 0) / channels;
      }
    }
    const targetRate = 16000;
    const mono = downsampleMono(mixed, decoded.sampleRate, targetRate);
    const wav = encodeWavPcm16(mono, targetRate);
    const bytes = new Uint8Array(wav);
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  } finally {
    void ctx.close();
  }
}

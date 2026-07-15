import { Platform } from 'react-native';

export type PttRecordingSession = {
  stop: () => Promise<{ blob: Blob; mimeType: string; extension: string }>;
};

/** Caps de áudio em reprodução — param ao gravar para evitar eco no microfone. */
const activePlayback = new Set<HTMLAudioElement>();

/** Storage e Content-Type não aceitam `;codecs=...` (ex. Supabase bucket). */
export const normalizeAudioMimeType = (value: string | null | undefined) => {
  const raw = (value ?? '').trim().toLowerCase();
  if (!raw) {
    return 'audio/webm';
  }
  const base = raw.split(';')[0]?.trim() || 'audio/webm';
  if (base.includes('webm')) return 'audio/webm';
  if (base.includes('ogg')) return 'audio/ogg';
  if (base.includes('mp4') || base.includes('m4a') || base.includes('aac')) return 'audio/mp4';
  if (base.includes('mpeg') || base.includes('mp3')) return 'audio/mpeg';
  if (base.includes('wav')) return 'audio/wav';
  return base;
};

const extensionForMime = (mimeType: string) => {
  const base = normalizeAudioMimeType(mimeType);
  if (base === 'audio/mp4') return 'm4a';
  if (base === 'audio/ogg') return 'ogg';
  if (base === 'audio/mpeg') return 'mp3';
  if (base === 'audio/wav') return 'wav';
  return 'webm';
};

/** Reproduz áudio PTT e registra para pausar se outra gravação começar. */
export function playPttAudioUrl(url: string): HTMLAudioElement | null {
  if (typeof Audio === 'undefined') {
    return null;
  }
  const trimmed = url.trim();
  if (!trimmed) {
    return null;
  }
  stopAllPttPlayback();
  const audio = new Audio(trimmed);
  activePlayback.add(audio);
  const cleanup = () => {
    activePlayback.delete(audio);
  };
  audio.addEventListener('ended', cleanup);
  audio.addEventListener('error', cleanup);
  void audio.play().catch(() => {
    cleanup();
  });
  return audio;
}

export function stopAllPttPlayback() {
  activePlayback.forEach((audio) => {
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch {
      /* ignore */
    }
  });
  activePlayback.clear();
}

const getMicStream = async () => {
  const preferred: MediaStreamConstraints = {
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      channelCount: 1,
      // Vocais: estreita um pouco a faixa de ambiente/rebote
      sampleRate: { ideal: 48000 },
    },
  };

  try {
    return await navigator.mediaDevices.getUserMedia(preferred);
  } catch {
    // Fallback se o browser rejeitar constraints avançadas
    return navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
  }
};

const tightenTrackProcessing = async (stream: MediaStream) => {
  const track = stream.getAudioTracks()[0];
  if (!track || typeof track.applyConstraints !== 'function') {
    return;
  }
  try {
    await track.applyConstraints({
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      channelCount: 1,
    } as MediaTrackConstraints);
  } catch {
    /* alguns browsers ignoram pós-apply */
  }
};

const createMediaRecorder = (stream: MediaStream) => {
  if (typeof MediaRecorder === 'undefined') {
    throw new Error('Gravação de áudio não suportada neste navegador.');
  }

  // Preferir tipos sem codecs — alguns browsers reportam codecs=opus e o Storage rejeita.
  const candidates = ['audio/webm', 'audio/mp4', 'audio/ogg', ''];

  for (const candidate of candidates) {
    try {
      if (
        candidate
        && typeof MediaRecorder.isTypeSupported === 'function'
        && !MediaRecorder.isTypeSupported(candidate)
      ) {
        continue;
      }

      const withRate: MediaRecorderOptions = {
        // Taxa adequada à voz: menos captura de ruído de sala
        audioBitsPerSecond: 48_000,
      };
      if (candidate) {
        withRate.mimeType = candidate;
      }

      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(stream, withRate);
      } catch {
        recorder = candidate
          ? new MediaRecorder(stream, { mimeType: candidate })
          : new MediaRecorder(stream);
      }
      const mimeType = normalizeAudioMimeType(recorder.mimeType || candidate || 'audio/webm');
      return {
        recorder,
        mimeType,
        extension: extensionForMime(mimeType),
      };
    } catch {
      /* tenta próximo candidato */
    }
  }

  throw new Error('Nenhum formato de áudio compatível neste navegador.');
};

/** Grava áudio (web MediaRecorder). Transcrição fica a cargo do Whisper (sem Web Speech em paralelo). */
export async function startPttRecording(): Promise<{
  session: PttRecordingSession;
  getTranscript: () => string;
}> {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw new Error('Walkie-Talkie disponível na versão web. Abra o app no navegador com microfone.');
  }

  // Para qualquer áudio em alto-falante — evita feedback/eco na nova gravação.
  stopAllPttPlayback();

  const stream = await getMicStream();
  await tightenTrackProcessing(stream);

  const { recorder, mimeType, extension } = createMediaRecorder(stream);
  const chunks: BlobPart[] = [];

  recorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) {
      chunks.push(event.data);
    }
  };

  // Sem Web Speech em paralelo: a 2ª captura do mic costuma gerar “eco”/dobra no áudio.
  // A legenda vem do Whisper (Cloudflare / Edge).
  recorder.start(250);

  const session: PttRecordingSession = {
    stop: async () => {
      const blob = await new Promise<Blob>((resolve, reject) => {
        recorder.onstop = () => {
          const type = normalizeAudioMimeType(recorder.mimeType || mimeType);
          resolve(new Blob(chunks, { type }));
        };
        recorder.onerror = () => reject(new Error('Falha ao gravar áudio.'));
        try {
          if (recorder.state !== 'inactive') {
            recorder.stop();
          } else {
            resolve(new Blob(chunks, { type: mimeType }));
          }
        } catch (error) {
          reject(error instanceof Error ? error : new Error('Falha ao gravar áudio.'));
        }
      });

      stream.getTracks().forEach((track) => track.stop());

      if (!blob.size) {
        throw new Error('Nenhum áudio capturado. Toque em Gravar, fale e depois em Enviar.');
      }

      const finalMime = normalizeAudioMimeType(blob.type || mimeType);
      return {
        blob: blob.type === finalMime ? blob : new Blob([blob], { type: finalMime }),
        mimeType: finalMime,
        extension: extensionForMime(finalMime) || extension,
      };
    },
  };

  return {
    session,
    getTranscript: () => '',
  };
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  if (typeof btoa === 'function') {
    return btoa(binary);
  }
  throw new Error('Base64 indisponível neste ambiente.');
}

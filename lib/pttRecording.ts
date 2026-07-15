import { Platform } from 'react-native';

export type PttRecordingSession = {
  stop: () => Promise<{ blob: Blob; mimeType: string; extension: string }>;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript?: string }>> }) => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};

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

      const recorder = candidate
        ? new MediaRecorder(stream, { mimeType: candidate })
        : new MediaRecorder(stream);
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

const getSpeechRecognitionCtor = (): (new () => SpeechRecognitionLike) | null => {
  if (typeof window === 'undefined') {
    return null;
  }
  const w = window as Window & {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

/** Grava áudio (web MediaRecorder) e tenta legenda via Web Speech API. */
export async function startPttRecording(): Promise<{
  session: PttRecordingSession;
  getTranscript: () => string;
}> {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw new Error('Walkie-Talkie disponível na versão web. Abra o app no navegador com microfone.');
  }

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const { recorder, mimeType, extension } = createMediaRecorder(stream);
  const chunks: BlobPart[] = [];
  let transcript = '';

  recorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) {
      chunks.push(event.data);
    }
  };

  const SpeechCtor = getSpeechRecognitionCtor();
  let recognition: SpeechRecognitionLike | null = null;
  if (SpeechCtor) {
    recognition = new SpeechCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'pt-BR';
    recognition.onresult = (event) => {
      const parts: string[] = [];
      for (let i = 0; i < event.results.length; i += 1) {
        const piece = event.results[i]?.[0]?.transcript?.trim();
        if (piece) {
          parts.push(piece);
        }
      }
      transcript = parts.join(' ').trim();
    };
    recognition.onerror = () => {
      /* ignore — áudio ainda é enviado */
    };
    try {
      recognition.start();
    } catch {
      recognition = null;
    }
  }

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

      try {
        recognition?.stop();
      } catch {
        /* ignore */
      }

      stream.getTracks().forEach((track) => track.stop());

      if (!blob.size) {
        throw new Error('Nenhum áudio capturado. Segure o botão e fale antes de soltar.');
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
    getTranscript: () => transcript.trim(),
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

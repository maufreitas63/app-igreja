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

const pickMimeType = () => {
  if (typeof MediaRecorder === 'undefined') {
    return { mimeType: 'audio/webm', extension: 'webm' };
  }
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
  ];
  for (const mimeType of candidates) {
    if (MediaRecorder.isTypeSupported?.(mimeType)) {
      const extension = mimeType.includes('mp4') ? 'm4a' : mimeType.includes('ogg') ? 'ogg' : 'webm';
      return { mimeType, extension };
    }
  }
  return { mimeType: '', extension: 'webm' };
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
  const { mimeType, extension } = pickMimeType();
  const recorder = mimeType
    ? new MediaRecorder(stream, { mimeType })
    : new MediaRecorder(stream);
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
          resolve(new Blob(chunks, { type: recorder.mimeType || mimeType || 'audio/webm' }));
        };
        recorder.onerror = () => reject(new Error('Falha ao gravar áudio.'));
        try {
          if (recorder.state !== 'inactive') {
            recorder.stop();
          } else {
            resolve(new Blob(chunks, { type: recorder.mimeType || mimeType || 'audio/webm' }));
          }
        } catch (error) {
          reject(error);
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

      return {
        blob,
        mimeType: blob.type || mimeType || 'audio/webm',
        extension,
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

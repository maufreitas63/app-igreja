import { blobToBase64, startPttRecording, type PttRecordingSession } from '@/lib/pttRecording';
import { transcribePttAudioViaEdge, uploadPttAudioBlob } from '@/lib/pttApi';
import { blobToWavBase64 } from '@/lib/pttWav';

export type PreparedPttAudio = {
  audioUrl: string;
  audioPath: string;
  texto: string;
};

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Grava até stop(); upload + transcrição automática (sempre).
 * Ordem: Whisper Cloudflare/Edge → Web Speech da gravação.
 * Não há digitação manual.
 */
export async function preparePttAudioFromSession(input: {
  profileId: string;
  session: PttRecordingSession;
  getTranscript: () => string;
}): Promise<PreparedPttAudio> {
  const recorded = await input.session.stop();
  const speechText = input.getTranscript()?.trim() ?? '';

  const uploaded = await uploadPttAudioBlob(
    input.profileId,
    recorded.blob,
    recorded.extension,
    recorded.mimeType
  );

  let wavBase64: string | undefined;
  try {
    wavBase64 = await blobToWavBase64(recorded.blob);
  } catch (error) {
    console.warn('ptt wav prep', error);
  }

  const base64 = await blobToBase64(recorded.blob);

  let texto = '';
  let lastError: string | undefined;

  for (let attempt = 0; attempt < 2 && !texto; attempt += 1) {
    if (attempt > 0) {
      await wait(500);
    }
    const whisper = await transcribePttAudioViaEdge(
      uploaded.publicUrl,
      base64,
      recorded.mimeType,
      wavBase64
    );
    texto = whisper.text?.trim() ?? '';
    lastError = whisper.error;
  }

  if (!texto && speechText) {
    texto = speechText;
  }

  if (!texto) {
    throw new Error(
      lastError?.includes('OPENAI_API_KEY')
        ? 'Transcrição automática indisponível no momento. Tente de novo em alguns segundos (aguarde o deploy do Whisper).'
        : `Não foi possível transcrever o áudio automaticamente${lastError ? `: ${lastError}` : ''}. Fale um pouco mais alto e tente novamente.`
    );
  }

  return {
    audioUrl: uploaded.publicUrl,
    audioPath: uploaded.path,
    texto,
  };
}

export { startPttRecording };
export type { PttRecordingSession };

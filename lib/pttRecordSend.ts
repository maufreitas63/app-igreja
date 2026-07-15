import { blobToBase64, startPttRecording, type PttRecordingSession } from '@/lib/pttRecording';
import { transcribePttAudioViaEdge, uploadPttAudioBlob } from '@/lib/pttApi';

export type PreparedPttAudio = {
  audioUrl: string;
  audioPath: string;
  texto: string;
  sttError?: string;
};

/** Grava até stop(); upload + STT (Web Speech → Whisper). */
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

  let texto = speechText;
  let sttError: string | undefined;
  if (!texto) {
    const base64 = await blobToBase64(recorded.blob);
    const whisper = await transcribePttAudioViaEdge(
      uploaded.publicUrl,
      base64,
      recorded.mimeType
    );
    texto = whisper.text?.trim() ?? '';
    sttError = whisper.error;
  }

  return {
    audioUrl: uploaded.publicUrl,
    audioPath: uploaded.path,
    texto,
    sttError,
  };
}

export { startPttRecording };
export type { PttRecordingSession };

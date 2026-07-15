import { blobToBase64, normalizeAudioMimeType } from '@/lib/pttRecording';
import { supabase } from '@/lib/supabase';
import { decode } from 'base64-arraybuffer';

export const PTT_AUDIO_BUCKET = 'ptt-audio';
export const PTT_SQL_HINT = 'Execute no Supabase: scripts/ptt-messages-escala-dinamica.sql';

export type PttMessagePayload = {
  remetente: string;
  setor: string;
  audio_url: string;
  texto_transcrito: string;
  timestamp: string;
};

export type PttMessageRow = {
  id: string;
  sender_profile_id: string | null;
  recipient_profile_id: string;
  remetente: string;
  setor: string;
  audio_url: string | null;
  texto_transcrito: string;
  payload: PttMessagePayload | Record<string, unknown> | null;
  delivered_at: string | null;
  acked_at: string | null;
  created_at: string;
};

const brazilTimeLabel = () => {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(11, 19);
  }
};

const isMissingRpcError = (message: string) => {
  const m = message.toLowerCase();
  return (
    m.includes('send_ptt_estacionamento_message')
    || m.includes('list_pending_ptt_messages')
    || m.includes('ack_ptt_message')
    || (m.includes('could not find') && m.includes('function'))
    || m.includes('schema cache')
  );
};

export async function uploadPttAudioBlob(
  senderProfileId: string,
  blob: Blob,
  extension: string,
  mimeType: string
): Promise<{ path: string; publicUrl: string }> {
  const safeExt = extension.replace(/[^a-z0-9]/gi, '') || 'webm';
  const path = `${senderProfileId.trim()}/${Date.now()}.${safeExt}`;
  const contentType = normalizeAudioMimeType(mimeType || blob.type || 'audio/webm');
  const base64 = await blobToBase64(blob);

  const { error } = await supabase.storage.from(PTT_AUDIO_BUCKET).upload(path, decode(base64), {
    contentType,
    upsert: false,
  });

  if (error) {
    const message = (error.message ?? '').toLowerCase();
    if (message.includes('bucket') && message.includes('not found')) {
      throw new Error(`Bucket ptt-audio ausente. ${PTT_SQL_HINT}`);
    }
    if (message.includes('mime type') || message.includes('not supported')) {
      throw new Error(
        `Formato de áudio rejeitado pelo storage (${contentType}). `
        + `Reexecute scripts/ptt-messages-escala-dinamica.sql ou scripts/ptt-audio-mime-patch.sql.`
      );
    }
    throw new Error(error.message || 'Falha ao enviar áudio.');
  }

  const { data } = supabase.storage.from(PTT_AUDIO_BUCKET).getPublicUrl(path);
  const publicUrl = data?.publicUrl?.trim();
  if (!publicUrl) {
    throw new Error('Áudio enviado, mas a URL pública não foi gerada.');
  }

  return { path, publicUrl };
}

/** Whisper (Edge Function). Prefere URL pública; base64 só como reforço em blobs curtos. */
export async function transcribePttAudioViaEdge(
  audioUrl: string,
  base64?: string,
  mimeType?: string
): Promise<{ text: string | null; error?: string }> {
  try {
    const body: Record<string, string> = {
      audio_url: audioUrl,
      language: 'pt',
    };
    if (mimeType?.trim()) {
      body.mime_type = mimeType.trim();
    }
    // Payloads enormes falham no invoke; só envia base64 de áudios pequenos.
    if (base64 && base64.length > 0 && base64.length < 900_000) {
      body.audio_base64 = base64;
    }

    const { data, error } = await supabase.functions.invoke('ptt-transcribe', { body });

    if (error) {
      console.warn('ptt-transcribe:', error.message);
      return { text: null, error: error.message };
    }

    const payload = data && typeof data === 'object' ? (data as { text?: string; error?: string }) : null;
    const text = String(payload?.text ?? '').trim();
    const remoteError = String(payload?.error ?? '').trim();
    if (text) {
      return { text };
    }
    if (remoteError) {
      console.warn('ptt-transcribe:', remoteError);
      return { text: null, error: remoteError };
    }
    return { text: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao invocar ptt-transcribe';
    console.warn('ptt-transcribe invoke failed', error);
    return { text: null, error: message };
  }
}

export async function sendPttEstacionamentoMessage(input: {
  remetente: string;
  setor?: string;
  audioUrl: string;
  audioPath: string;
  textoTranscrito: string;
}): Promise<{ ok: true; payload: PttMessagePayload; recipientCount: number } | { ok: false; message: string }> {
  const timestamp = brazilTimeLabel();
  const { data, error } = await supabase.rpc('send_ptt_estacionamento_message', {
    p_remetente: input.remetente.trim(),
    p_setor: input.setor?.trim() || 'Estacionamento',
    p_audio_url: input.audioUrl,
    p_audio_path: input.audioPath,
    p_texto_transcrito: input.textoTranscrito.trim(),
    p_timestamp: timestamp,
  });

  if (error) {
    if (isMissingRpcError(error.message ?? '')) {
      return { ok: false, message: `Função PTT ausente no banco. ${PTT_SQL_HINT}` };
    }
    return { ok: false, message: error.message || 'Falha ao enviar PTT.' };
  }

  const record = (data ?? {}) as Record<string, unknown>;
  if (record.success !== true) {
    return {
      ok: false,
      message: typeof record.message === 'string' ? record.message : 'Não foi possível rotear a mensagem.',
    };
  }

  const payload = (record.payload ?? {
    remetente: input.remetente,
    setor: input.setor || 'Estacionamento',
    audio_url: input.audioUrl,
    texto_transcrito: input.textoTranscrito,
    timestamp,
  }) as PttMessagePayload;

  return {
    ok: true,
    payload,
    recipientCount: Number(record.recipient_count ?? 0),
  };
}

export async function listPendingPttMessages(): Promise<PttMessageRow[]> {
  const { data, error } = await supabase.rpc('list_pending_ptt_messages');
  if (error) {
    if (isMissingRpcError(error.message ?? '')) {
      return [];
    }
    console.warn('list_pending_ptt_messages:', error.message);
    return [];
  }
  return (data ?? []) as PttMessageRow[];
}

export async function ackPttMessage(messageId: string): Promise<void> {
  const { error } = await supabase.rpc('ack_ptt_message', { p_message_id: messageId });
  if (error) {
    console.warn('ack_ptt_message:', error.message);
  }
}

export async function markPttDelivered(messageId: string): Promise<void> {
  const { error } = await supabase.rpc('mark_ptt_message_delivered', { p_message_id: messageId });
  if (error) {
    console.warn('mark_ptt_message_delivered:', error.message);
  }
}

export function payloadFromPttRow(row: PttMessageRow): PttMessagePayload {
  const fromJson = row.payload && typeof row.payload === 'object' ? row.payload : null;
  return {
    remetente: String((fromJson as PttMessagePayload | null)?.remetente ?? row.remetente ?? ''),
    setor: String((fromJson as PttMessagePayload | null)?.setor ?? row.setor ?? 'Estacionamento'),
    audio_url: String((fromJson as PttMessagePayload | null)?.audio_url ?? row.audio_url ?? ''),
    texto_transcrito: String(
      (fromJson as PttMessagePayload | null)?.texto_transcrito ?? row.texto_transcrito ?? ''
    ),
    timestamp: String((fromJson as PttMessagePayload | null)?.timestamp ?? ''),
  };
}

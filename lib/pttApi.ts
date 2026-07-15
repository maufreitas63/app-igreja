import { blobToBase64, normalizeAudioMimeType } from '@/lib/pttRecording';
import { supabase } from '@/lib/supabase';
import { decode } from 'base64-arraybuffer';

export const PTT_AUDIO_BUCKET = 'ptt-audio';
export const PTT_SQL_HINT =
  'Execute no Supabase: scripts/ptt-messages-escala-dinamica.sql, scripts/ptt-conversations-dialogo.sql e scripts/ptt-directory-users.sql';

export type PttDirectoryPeer = {
  profile_id: string;
  full_name: string;
};

export type PttDirectoryUser = {
  id: string;
  profile_id: string;
  full_name: string;
  is_active: boolean;
  created_at: string;
};

export type PttMessagePayload = {
  remetente: string;
  setor: string;
  audio_url: string;
  texto_transcrito: string;
  timestamp: string;
  conversation_id?: string;
};

export type PttMessageRow = {
  id: string;
  sender_profile_id: string | null;
  recipient_profile_id: string;
  conversation_id?: string | null;
  remetente: string;
  setor: string;
  audio_url: string | null;
  texto_transcrito: string;
  payload: PttMessagePayload | Record<string, unknown> | null;
  delivered_at: string | null;
  acked_at: string | null;
  created_at: string;
};

export type PttConversationSummary = {
  id: string;
  initiator_profile_id: string;
  peer_profile_id: string;
  status: string;
  last_message_at: string;
  created_at: string;
  other_profile_id: string;
  other_name: string;
  last_texto: string;
  unread_count: number;
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
    || m.includes('reply_ptt_conversation')
    || m.includes('end_ptt_conversation')
    ||     m.includes('list_open_ptt_conversations')
    || m.includes('list_ptt_conversation_messages')
    || m.includes('send_ptt_directory_message')
    || m.includes('list_ptt_directory_peers')
    || m.includes('can_use_ptt_walkie')
    || (m.includes('could not find') && m.includes('function'))
    || m.includes('schema cache')
  );
};

const asUuidArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? '').trim()).filter(Boolean);
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

async function transcribeViaCloudflarePages(
  wavBase64: string
): Promise<{ text: string | null; error?: string }> {
  if (typeof window === 'undefined' || !window.location?.origin) {
    return { text: null, error: 'Ambiente sem origin para /api/ptt-transcribe' };
  }

  const origin = window.location.origin.replace(/\/$/, '');
  // Em localhost o Pages Function não existe — pula direto para o Edge Supabase.
  if (/localhost|127\.0\.0\.1/i.test(origin)) {
    return { text: null, error: 'dev-local' };
  }

  try {
    const response = await fetch(`${origin}/api/ptt-transcribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        audio_base64: wavBase64,
        language: 'pt',
      }),
    });
    const payload = (await response.json().catch(() => null)) as {
      text?: string;
      error?: string;
    } | null;
    const text = String(payload?.text ?? '').trim();
    if (text) {
      return { text };
    }
    const remoteError = String(payload?.error ?? '').trim() || `HTTP ${response.status}`;
    return { text: null, error: remoteError };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha no Whisper Cloudflare';
    return { text: null, error: message };
  }
}

/** Whisper: Cloudflare Workers AI (produção) → Edge Supabase (OPENAI_API_KEY). */
export async function transcribePttAudioViaEdge(
  audioUrl: string,
  base64?: string,
  mimeType?: string,
  wavBase64?: string
): Promise<{ text: string | null; error?: string }> {
  const errors: string[] = [];

  if (wavBase64?.trim()) {
    const cf = await transcribeViaCloudflarePages(wavBase64.trim());
    if (cf.text) {
      return cf;
    }
    if (cf.error && cf.error !== 'dev-local') {
      errors.push(cf.error);
    }
  }

  try {
    const body: Record<string, string> = {
      audio_url: audioUrl,
      language: 'pt',
    };
    if (mimeType?.trim()) {
      body.mime_type = mimeType.trim();
    }
    if (base64 && base64.length > 0 && base64.length < 900_000) {
      body.audio_base64 = base64;
    }

    const { data, error } = await supabase.functions.invoke('ptt-transcribe', { body });

    if (error) {
      errors.push(error.message);
    } else {
      const payload = data && typeof data === 'object' ? (data as { text?: string; error?: string }) : null;
      const text = String(payload?.text ?? '').trim();
      if (text) {
        return { text };
      }
      const remoteError = String(payload?.error ?? '').trim();
      if (remoteError) {
        errors.push(remoteError);
      }
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Falha ao invocar ptt-transcribe');
  }

  return { text: null, error: errors.filter(Boolean).join(' | ') || undefined };
}

export async function canUsePttWalkie(): Promise<boolean> {
  const { data, error } = await supabase.rpc('can_use_ptt_walkie');
  if (error) {
    if (isMissingRpcError(error.message ?? '')) {
      return false;
    }
    console.warn('can_use_ptt_walkie:', error.message);
    return false;
  }
  return data === true;
}

export async function listPttDirectoryPeers(): Promise<PttDirectoryPeer[]> {
  const { data, error } = await supabase.rpc('list_ptt_directory_peers');
  if (error) {
    if (isMissingRpcError(error.message ?? '')) {
      return [];
    }
    console.warn('list_ptt_directory_peers:', error.message);
    return [];
  }
  return ((data ?? []) as PttDirectoryPeer[]).map((row) => ({
    profile_id: String(row.profile_id ?? ''),
    full_name: String(row.full_name ?? 'Voluntário'),
  }));
}

export async function listPttDirectoryUsers(): Promise<PttDirectoryUser[]> {
  const { data, error } = await supabase.rpc('list_ptt_directory_users');
  if (error) {
    console.warn('list_ptt_directory_users:', error.message);
    return [];
  }
  return ((data ?? []) as PttDirectoryUser[]).map((row) => ({
    id: String(row.id ?? ''),
    profile_id: String(row.profile_id ?? ''),
    full_name: String(row.full_name ?? 'Voluntário'),
    is_active: row.is_active === true,
    created_at: String(row.created_at ?? ''),
  }));
}

export async function addPttDirectoryUser(
  profileId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data, error } = await supabase.rpc('add_ptt_directory_user', {
    p_profile_id: profileId.trim(),
  });
  if (error) {
    return { ok: false, message: error.message || 'Falha ao incluir usuário.' };
  }
  const record = (data ?? {}) as Record<string, unknown>;
  if (record.success !== true) {
    return {
      ok: false,
      message: typeof record.message === 'string' ? record.message : 'Não foi possível incluir.',
    };
  }
  return { ok: true };
}

export async function setPttDirectoryUserActive(
  profileId: string,
  isActive: boolean
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data, error } = await supabase.rpc('set_ptt_directory_user_active', {
    p_profile_id: profileId.trim(),
    p_is_active: isActive,
  });
  if (error) {
    return { ok: false, message: error.message || 'Falha ao atualizar usuário.' };
  }
  const record = (data ?? {}) as Record<string, unknown>;
  if (record.success !== true) {
    return {
      ok: false,
      message: typeof record.message === 'string' ? record.message : 'Não foi possível atualizar.',
    };
  }
  return { ok: true };
}

export async function searchProfilesForPttDirectory(
  query: string
): Promise<PttDirectoryPeer[]> {
  const q = query.trim();
  if (q.length < 2) {
    return [];
  }
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name')
    .ilike('full_name', `%${q}%`)
    .order('full_name', { ascending: true })
    .limit(20);
  if (error) {
    console.warn('searchProfilesForPttDirectory:', error.message);
    return [];
  }
  return ((data ?? []) as Array<{ id: string; full_name: string | null }>).map((row) => ({
    profile_id: String(row.id ?? ''),
    full_name: String(row.full_name ?? 'Voluntário'),
  }));
}

export async function sendPttDirectoryMessage(input: {
  remetente: string;
  setor?: string;
  audioUrl: string;
  audioPath: string;
  textoTranscrito: string;
  conversationId?: string | null;
  peerProfileId?: string | null;
}): Promise<
  | {
      ok: true;
      payload: PttMessagePayload;
      recipientCount: number;
      conversationId: string | null;
      conversationIds: string[];
    }
  | { ok: false; message: string }
> {
  const timestamp = brazilTimeLabel();
  const params: Record<string, string | null> = {
    p_remetente: input.remetente.trim(),
    p_setor: input.setor?.trim() || 'Walkie-Talkie',
    p_audio_url: input.audioUrl,
    p_audio_path: input.audioPath,
    p_texto_transcrito: input.textoTranscrito.trim(),
    p_timestamp: timestamp,
  };
  if (input.conversationId?.trim()) {
    params.p_conversation_id = input.conversationId.trim();
  }
  if (input.peerProfileId?.trim()) {
    params.p_peer_profile_id = input.peerProfileId.trim();
  }

  const { data, error } = await supabase.rpc('send_ptt_directory_message', params);

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
      message: typeof record.message === 'string' ? record.message : 'Não foi possível enviar a mensagem.',
    };
  }

  const payload = (record.payload ?? {
    remetente: input.remetente,
    setor: input.setor || 'Walkie-Talkie',
    audio_url: input.audioUrl,
    texto_transcrito: input.textoTranscrito,
    timestamp,
  }) as PttMessagePayload;

  const conversationIds = asUuidArray(record.conversation_ids);
  const conversationId =
    String(record.conversation_id ?? conversationIds[0] ?? '').trim() || null;

  return {
    ok: true,
    payload,
    recipientCount: Number(record.recipient_count ?? 0),
    conversationId,
    conversationIds,
  };
}

/** @deprecated use sendPttDirectoryMessage */
export async function sendPttEstacionamentoMessage(input: {
  remetente: string;
  setor?: string;
  audioUrl: string;
  audioPath: string;
  textoTranscrito: string;
  conversationId?: string | null;
  peerProfileId?: string | null;
}) {
  return sendPttDirectoryMessage(input);
}

export async function replyPttConversation(input: {
  conversationId: string;
  remetente: string;
  setor?: string;
  audioUrl: string;
  audioPath: string;
  textoTranscrito: string;
}): Promise<{ ok: true; conversationId: string } | { ok: false; message: string }> {
  const timestamp = brazilTimeLabel();
  const { data, error } = await supabase.rpc('reply_ptt_conversation', {
    p_conversation_id: input.conversationId.trim(),
    p_remetente: input.remetente.trim(),
    p_setor: input.setor?.trim() || null,
    p_audio_url: input.audioUrl,
    p_audio_path: input.audioPath,
    p_texto_transcrito: input.textoTranscrito.trim(),
    p_timestamp: timestamp,
  });

  if (error) {
    if (isMissingRpcError(error.message ?? '')) {
      return { ok: false, message: `Função de diálogo PTT ausente. ${PTT_SQL_HINT}` };
    }
    return { ok: false, message: error.message || 'Falha ao responder PTT.' };
  }

  const record = (data ?? {}) as Record<string, unknown>;
  if (record.success !== true) {
    return {
      ok: false,
      message: typeof record.message === 'string' ? record.message : 'Não foi possível responder.',
    };
  }

  return {
    ok: true,
    conversationId: String(record.conversation_id ?? input.conversationId).trim(),
  };
}

export async function endPttConversation(
  conversationId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data, error } = await supabase.rpc('end_ptt_conversation', {
    p_conversation_id: conversationId.trim(),
  });
  if (error) {
    if (isMissingRpcError(error.message ?? '')) {
      return { ok: false, message: `Função de diálogo PTT ausente. ${PTT_SQL_HINT}` };
    }
    return { ok: false, message: error.message || 'Falha ao encerrar conversa.' };
  }
  const record = (data ?? {}) as Record<string, unknown>;
  if (record.success !== true) {
    return {
      ok: false,
      message: typeof record.message === 'string' ? record.message : 'Não foi possível encerrar.',
    };
  }
  return { ok: true };
}

export async function listOpenPttConversations(): Promise<PttConversationSummary[]> {
  const { data, error } = await supabase.rpc('list_open_ptt_conversations');
  if (error) {
    if (isMissingRpcError(error.message ?? '')) {
      return [];
    }
    console.warn('list_open_ptt_conversations:', error.message);
    return [];
  }
  return ((data ?? []) as PttConversationSummary[]).map((row) => ({
    ...row,
    unread_count: Number(row.unread_count ?? 0),
  }));
}

export async function listPttConversationMessages(conversationId: string): Promise<PttMessageRow[]> {
  const { data, error } = await supabase.rpc('list_ptt_conversation_messages', {
    p_conversation_id: conversationId.trim(),
  });
  if (error) {
    console.warn('list_ptt_conversation_messages:', error.message);
    return [];
  }
  return (data ?? []) as PttMessageRow[];
}

export async function getPttConversation(conversationId: string): Promise<{
  id: string;
  status: string;
  other_name: string;
  other_profile_id: string;
  initiator_profile_id: string;
  peer_profile_id: string;
} | null> {
  const { data, error } = await supabase.rpc('get_ptt_conversation', {
    p_conversation_id: conversationId.trim(),
  });
  if (error) {
    console.warn('get_ptt_conversation:', error.message);
    return null;
  }
  const record = (data ?? {}) as Record<string, unknown>;
  if (record.success !== true || !record.conversation || typeof record.conversation !== 'object') {
    return null;
  }
  const c = record.conversation as Record<string, unknown>;
  return {
    id: String(c.id ?? ''),
    status: String(c.status ?? ''),
    other_name: String(c.other_name ?? 'Contato'),
    other_profile_id: String(c.other_profile_id ?? ''),
    initiator_profile_id: String(c.initiator_profile_id ?? ''),
    peer_profile_id: String(c.peer_profile_id ?? ''),
  };
}

export async function ackPttConversationMessages(conversationId: string): Promise<void> {
  const { error } = await supabase.rpc('ack_ptt_conversation_messages', {
    p_conversation_id: conversationId.trim(),
  });
  if (error) {
    console.warn('ack_ptt_conversation_messages:', error.message);
  }
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
  const conversationId = String(
    (fromJson as PttMessagePayload | null)?.conversation_id
      ?? row.conversation_id
      ?? ''
  ).trim();
  return {
    remetente: String((fromJson as PttMessagePayload | null)?.remetente ?? row.remetente ?? ''),
    setor: String((fromJson as PttMessagePayload | null)?.setor ?? row.setor ?? 'Estacionamento'),
    audio_url: String((fromJson as PttMessagePayload | null)?.audio_url ?? row.audio_url ?? ''),
    texto_transcrito: String(
      (fromJson as PttMessagePayload | null)?.texto_transcrito ?? row.texto_transcrito ?? ''
    ),
    timestamp: String((fromJson as PttMessagePayload | null)?.timestamp ?? ''),
    ...(conversationId ? { conversation_id: conversationId } : {}),
  };
}

export function conversationIdFromPttRow(row: PttMessageRow): string | null {
  const fromPayload = payloadFromPttRow(row).conversation_id?.trim();
  if (fromPayload) return fromPayload;
  const fromCol = String(row.conversation_id ?? '').trim();
  return fromCol || null;
}

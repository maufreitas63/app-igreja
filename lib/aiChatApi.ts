import { getSupabaseAnonKey, getSupabaseUrl } from '@/lib/supabaseConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';

const USER_PROFILE_ID_STORAGE_KEY = 'user_profile_id';
const USER_SESSION_TOKEN_STORAGE_KEY = 'user_session_token';

export const AI_CHAT_SQL_HINT = 'Execute no Supabase: scripts/access-control-ai-curator.sql';

export type AiChatHistoryItem = {
  role: 'user' | 'assistant';
  content: string;
};

export type StreamAiChatOptions = {
  question: string;
  history?: AiChatHistoryItem[];
  signal?: AbortSignal;
  onChunk: (chunk: string) => void;
  onDone?: () => void;
};

const buildAiChatHeaders = async () => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${getSupabaseAnonKey()}`,
    apikey: getSupabaseAnonKey(),
  };

  const sessionToken = (await AsyncStorage.getItem(USER_SESSION_TOKEN_STORAGE_KEY))?.trim();

  if (sessionToken) {
    headers['x-session-token'] = sessionToken;
    return headers;
  }

  const profileId = (await AsyncStorage.getItem(USER_PROFILE_ID_STORAGE_KEY))?.trim();

  if (profileId) {
    headers['x-profile-id'] = profileId;
  }

  return headers;
};

const parseSseEvents = (buffer: string) => {
  const events: Array<Record<string, unknown>> = [];
  const parts = buffer.split('\n\n');
  const remainder = parts.pop() ?? '';

  for (const part of parts) {
    const lines = part.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();

      if (!trimmed.startsWith('data:')) {
        continue;
      }

      const payload = trimmed.slice(5).trim();

      if (!payload) {
        continue;
      }

      try {
        events.push(JSON.parse(payload) as Record<string, unknown>);
      } catch {
        // Ignora eventos malformados.
      }
    }
  }

  return { events, remainder };
};

export async function streamAiChatMessage({
  question,
  history = [],
  signal,
  onChunk,
  onDone,
}: StreamAiChatOptions) {
  const headers = await buildAiChatHeaders();
  const response = await fetch(`${getSupabaseUrl()}/functions/v1/ai-chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ question, history }),
    signal,
  });

  if (!response.ok) {
    let message = 'nao autorizado para esta funçao';

    try {
      const payload = (await response.json()) as { error?: string };
      message = payload.error?.trim() || message;
    } catch {
      message = `Erro ${response.status} ao consultar o assistente.`;
    }

    throw new Error(message);
  }

  if (!response.body) {
    throw new Error('Streaming indisponível neste navegador.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const parsed = parseSseEvents(buffer);
    buffer = parsed.remainder;

    for (const event of parsed.events) {
      if (typeof event.error === 'string' && event.error.trim()) {
        throw new Error(event.error.trim());
      }

      if (typeof event.text === 'string' && event.text) {
        onChunk(event.text);
      }

      if (event.done === true) {
        onDone?.();
      }
    }
  }

  onDone?.();
}

export async function sessionCanAccessAiAssistantPanel() {
  const { sessionHasAccess } = await import('@/lib/accessControl');
  return sessionHasAccess('screen', 'maintenance.card.ai_assistant', 'view');
}

export async function sessionCanAccessAiAuditLogsPanel() {
  const { sessionHasAccess } = await import('@/lib/accessControl');
  return sessionHasAccess('screen', 'maintenance.card.ai_audit_logs', 'view');
}

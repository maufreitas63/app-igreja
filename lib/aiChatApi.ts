import { getSupabaseAnonKey, getSupabaseUrl } from '@/lib/supabaseConfig';
import { supabaseSessionFetch } from '@/lib/supabaseSessionFetch';
import { Platform } from 'react-native';

export const AI_CHAT_SQL_HINT =
  'Execute no Supabase: scripts/access-control-ai-leadership.sql, scripts/access-control-ai-tenant-context.sql e scripts/access-control-ai-tool-calling.sql';

export const AI_CHAT_DEPLOY_HINT =
  'O super admin deve cadastrar a chave Gemini da igreja em Manutenção → Abigail → Chave API (ou via SQL scripts/configurar-gemini-api-key.sql).';

const isLocalWebDevHost = (hostname: string) =>
  hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0';

/** Produção web: mesma origem (/api/ai-chat). Dev local: Supabase Edge Function. */
export const resolveAiChatEndpoint = () => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const hostname = window.location.hostname;

    if (!isLocalWebDevHost(hostname)) {
      return `${window.location.origin}/api/ai-chat`;
    }
  }

  return `${getSupabaseUrl()}/functions/v1/ai-chat`;
};

const isNetworkFetchError = (error: unknown) =>
  error instanceof TypeError &&
  /failed to fetch|network request failed|load failed/i.test(String(error.message ?? error));

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

const buildAiChatHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${getSupabaseAnonKey()}`,
  apikey: getSupabaseAnonKey(),
});

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
  const headers = buildAiChatHeaders();
  const endpoint = resolveAiChatEndpoint();

  let response: Response;

  try {
    response = await supabaseSessionFetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ question, history }),
      signal,
      timeoutMs: 180_000,
    });
  } catch (error) {
    if (isNetworkFetchError(error)) {
      throw new Error(
        endpoint.includes('/functions/v1/')
          ? `Não foi possível conectar ao assistente de IA (Supabase Edge Function). ${AI_CHAT_DEPLOY_HINT}`
          : `Não foi possível conectar ao assistente de IA. ${AI_CHAT_DEPLOY_HINT}`
      );
    }

    throw error;
  }

  if (!response.ok) {
    let message = 'nao autorizado para esta funçao';

    try {
      const payload = (await response.json()) as { error?: string };
      message = payload.error?.trim() || message;
    } catch {
      if (response.status === 404) {
        message = `Endpoint do assistente não encontrado. ${AI_CHAT_DEPLOY_HINT}`;
      } else {
        message = `Erro ${response.status} ao consultar o assistente.`;
      }
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

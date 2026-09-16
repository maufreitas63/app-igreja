import { pickAbigailGreeting } from '@/lib/abigailPersona';
import { loadEffectiveSessionProfile } from '@/lib/loadSessionProfile';
import { resolveGreetingFirstName } from '@/lib/sessionGreetingName';
import { streamAiChatMessage, type AiChatHistoryItem } from '@/lib/aiChatApi';
import { useCallback, useEffect, useRef, useState } from 'react';

export type AiChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  localOnly?: boolean;
};

const createMessageId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const QUOTA_COOLDOWN_MS = 5 * 60 * 1000;

const isGeminiQuotaError = (message: string) =>
  /cota da chave gemini|cota da api gemini|quota|resource_exhausted|excedida/i.test(message) &&
  !/muitas consultas/i.test(message);

const remainingCooldownLabel = (untilMs: number) => {
  const remainingMinutes = Math.max(1, Math.ceil((untilMs - Date.now()) / 60_000));
  return remainingMinutes === 1 ? '1 minuto' : `${remainingMinutes} minutos`;
};

const createGreetingMessage = (firstName?: string | null): AiChatMessage => ({
  id: createMessageId(),
  role: 'assistant',
  content: pickAbigailGreeting(firstName),
  localOnly: true,
});

export function useAiChat() {
  const greetingNameRef = useRef('usuário');
  const [messages, setMessages] = useState<AiChatMessage[]>(() => [createGreetingMessage()]);
  const [draft, setDraft] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const quotaUntilRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const profile = await loadEffectiveSessionProfile();
      if (cancelled) {
        return;
      }

      const firstName = resolveGreetingFirstName(profile?.full_name, profile?.id);
      greetingNameRef.current = firstName;
      setMessages((current) => {
        if (current.length === 1 && current[0].localOnly && current[0].role === 'assistant') {
          return [{ ...current[0], content: pickAbigailGreeting(firstName) }];
        }
        return current;
      });
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const sendMessage = useCallback(async () => {
    const question = draft.trim();

    if (!question || streaming) {
      return;
    }

    if (Date.now() < quotaUntilRef.current) {
      setError(
        `A cota da chave Gemini ainda está esgotada. Aguarde ${remainingCooldownLabel(quotaUntilRef.current)} e evite reenviar a mesma pergunta.`
      );
      return;
    }

    const userMessage: AiChatMessage = {
      id: createMessageId(),
      role: 'user',
      content: question,
    };
    const assistantMessageId = createMessageId();

    const history: AiChatHistoryItem[] = messages
      .filter((message) => !message.localOnly)
      .slice(-2)
      .map((message) => ({
        role: message.role,
        content:
          message.content.length > 400 ? `${message.content.slice(0, 400)}…` : message.content,
      }));

    setMessages((current) => [
      ...current,
      userMessage,
      { id: assistantMessageId, role: 'assistant', content: '' },
    ]);
    setDraft('');
    setStreaming(true);
    setError(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await streamAiChatMessage({
        question,
        history,
        signal: controller.signal,
        onChunk: (chunk) => {
          setMessages((current) =>
            current.map((message) =>
              message.id === assistantMessageId
                ? { ...message, content: message.content + chunk }
                : message
            )
          );
        },
      });
    } catch (sendError) {
      const message =
        sendError instanceof Error
          ? sendError.message
          : 'Não foi possível falar com a Abigail.';

      if (isGeminiQuotaError(message)) {
        quotaUntilRef.current = Date.now() + QUOTA_COOLDOWN_MS;
      }

      setError(message);
      setMessages((current) =>
        current.filter((entry) => entry.id !== assistantMessageId || entry.content.trim().length > 0)
      );
    } finally {
      abortRef.current = null;
      setStreaming(false);
    }
  }, [draft, messages, streaming]);

  const clearConversation = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setMessages([createGreetingMessage(greetingNameRef.current)]);
    setDraft('');
    setError(null);
    setStreaming(false);
  }, []);

  return {
    messages,
    draft,
    setDraft,
    streaming,
    error,
    sendMessage,
    clearConversation,
  };
}

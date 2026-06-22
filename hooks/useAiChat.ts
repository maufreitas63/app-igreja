import { streamAiChatMessage, type AiChatHistoryItem } from '@/lib/aiChatApi';
import { useCallback, useRef, useState } from 'react';

export type AiChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

const createMessageId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export function useAiChat() {
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async () => {
    const question = draft.trim();

    if (!question || streaming) {
      return;
    }

    const userMessage: AiChatMessage = {
      id: createMessageId(),
      role: 'user',
      content: question,
    };
    const assistantMessageId = createMessageId();

    const history: AiChatHistoryItem[] = messages.map((message) => ({
      role: message.role,
      content: message.content,
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
          : 'Não foi possível consultar o assistente de IA.';

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
    setMessages([]);
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
